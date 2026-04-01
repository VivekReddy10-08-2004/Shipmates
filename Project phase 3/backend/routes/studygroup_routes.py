# Jacob Craig

from fastapi import APIRouter, HTTPException, status, Query, Body
from mysql.connector import Error as MySQLError
import secrets
from datetime import datetime, date, timedelta
from decimal import Decimal
from db import get_db_connection
from models import CreateStudyGroup

router = APIRouter()


def _json_friendly(value):
    """Ensure MySQL driver values serialize to JSON (Decimal, bytes, enums)."""
    if value is None:
        return None
    if isinstance(value, Decimal):
        return int(value) if value == value.to_integral_value() else float(value)
    if isinstance(value, (bytes, bytearray)):
        return value.decode("utf-8", errors="replace")
    return value


# Same logic as stored procedures GetUserGroups / GetUpcomingSessionsForUser (SQL file may not be applied).
SQL_GET_USER_GROUPS = """
SELECT
    g.group_id,
    g.group_name,
    gm.role,
    u.user_id,
    CONCAT(u.first_name, ' ', u.last_name) AS user_name
FROM Group_Member AS gm
JOIN Study_Group AS g ON g.group_id = gm.group_id
JOIN Users AS u ON u.user_id = gm.user_id
WHERE gm.user_id = %s
ORDER BY g.group_name
"""

SQL_GET_UPCOMING_SESSIONS = """
SELECT
    g.group_name,
    s.session_date,
    s.start_time,
    s.end_time,
    s.location,
    u.user_id,
    CONCAT(u.first_name, ' ', u.last_name) AS user_name
FROM Group_Member AS gm
JOIN Study_Session AS s ON s.group_id = gm.group_id
JOIN Study_Group AS g ON g.group_id = gm.group_id
JOIN Users AS u ON u.user_id = gm.user_id
WHERE gm.user_id = %s
  AND s.session_date >= CURRENT_DATE()
ORDER BY s.session_date, s.start_time
LIMIT %s
"""


@router.post("", status_code=status.HTTP_201_CREATED, response_model=dict)
def create_group(group_data: CreateStudyGroup):
    """
    Create a new study group, then auto-join creator as owner.
    """
    conn = None
    cursor = None

    try:
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)

        cursor.callproc(
            "CreateStudyGroupWithOwner",
            (
                group_data.group_name,
                group_data.max_members,
                group_data.is_private,
                group_data.course_id,
                group_data.creator_user_id,
            ),
        )

        group_id = None
        for result in cursor.stored_results():
            row = result.fetchone()
            if row:
                group_id = row["group_id"]
                break

        conn.commit()

        if group_id is None:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to create group",
            )

        return {"group_id": group_id}

    except MySQLError as e:
        if conn is not None:
            conn.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e),
        )

    finally:
        if cursor is not None:
            cursor.close()
        if conn is not None:
            conn.close()


@router.post("/{group_id}/join", status_code=status.HTTP_201_CREATED, response_model=dict)
def request_join_group(group_id: int, user_id: int = Query(...)):
    """Join a public group via RequestJoinPublicGroup."""
    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="user_id is required",
        )

    conn = None
    cursor = None

    try:
        conn = get_db_connection()
        cursor = conn.cursor()

        cursor.callproc("RequestJoinPublicGroup", (group_id, int(user_id)))
        conn.commit()

        return {
            "status": "request_created",
            "message": "Join request sent to the group owner.",
        }

    except MySQLError as e:
        if conn is not None:
            conn.rollback()
        msg = str(e)
        
        if "GROUP_NOT_FOUND" in msg:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Group not found",
            )
        elif "GROUP_IS_PRIVATE" in msg:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="This is a private group. Use an invite code to join.",
            )
        elif "ALREADY_MEMBER" in msg:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="User already a member",
            )
        
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=msg,
        )

    finally:
        if cursor is not None:
            cursor.close()
        if conn is not None:
            conn.close()


@router.get("/public", response_model=list[dict])
def get_public_groups(course_id: int = Query(...), limit: int = Query(20, ge=1, le=100)):
    """Get public groups for a course."""
    if not course_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="course_id is required",
        )

    conn = None
    cursor = None

    try:
        conn = get_db_connection()
        cursor = conn.cursor()

        cursor.callproc("GetPublicGroupsForCourse", (course_id, limit))

        groups = []

        for result in cursor.stored_results():
            rows = result.fetchall()
            col_names = result.column_names
            for row in rows:
                row_dict = dict(zip(col_names, row))
                safe_members = row_dict.get("members") or 0
                groups.append(
                    {
                        "group_id": row_dict["group_id"],
                        "group_name": row_dict["group_name"],
                        "max_members": row_dict["max_members"],
                        "members": safe_members,
                        "last_session": row_dict.get("last_session"),
                    }
                )

        return groups

    except MySQLError as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e),
        )

    finally:
        if cursor is not None:
            cursor.close()
        if conn is not None:
            conn.close()


@router.get("/mine", response_model=list[dict])
def get_my_groups(user_id: int = Query(...)):
    """Get all groups a user belongs to."""
    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="user_id is required",
        )

    conn = None
    cursor = None

    try:
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)

        cursor.execute(SQL_GET_USER_GROUPS, (user_id,))
        rows = cursor.fetchall() or []

        groups = []
        for row_dict in rows:
            groups.append(
                {
                    "group_id": _json_friendly(row_dict.get("group_id")),
                    "group_name": _json_friendly(row_dict.get("group_name")),
                    "role": _json_friendly(row_dict.get("role")),
                    "user_id": _json_friendly(row_dict.get("user_id")),
                    "user_name": _json_friendly(row_dict.get("user_name")),
                }
            )

        return groups

    except MySQLError as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e),
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e),
        )

    finally:
        if cursor is not None:
            cursor.close()
        if conn is not None:
            conn.close()


@router.get("/sessions/upcoming", response_model=list[dict])
def get_upcoming_sessions_for_user(
    user_id: int = Query(...),
    limit: int = Query(50, ge=1, le=500),
):
    """Wraps GetUpcomingSessionsForUser. Query: ?user_id=...&limit=50"""
    conn = None
    cursor = None

    try:
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)

        cursor.execute(SQL_GET_UPCOMING_SESSIONS, (user_id, limit))

        sessions = []
        for row_dict in cursor.fetchall() or []:
            if row_dict.get("session_date") is not None:
                row_dict["session_date"] = row_dict["session_date"].isoformat()
            if row_dict.get("start_time") is not None:
                row_dict["start_time"] = str(row_dict["start_time"])
            if row_dict.get("end_time") is not None:
                row_dict["end_time"] = str(row_dict["end_time"])
            row_dict["group_name"] = _json_friendly(row_dict.get("group_name"))
            row_dict["location"] = _json_friendly(row_dict.get("location"))
            row_dict["user_id"] = _json_friendly(row_dict.get("user_id"))
            row_dict["user_name"] = _json_friendly(row_dict.get("user_name"))
            sessions.append(row_dict)

        return sessions

    except MySQLError as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e),
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e),
        )

    finally:
        if cursor is not None:
            cursor.close()
        if conn is not None:
            conn.close()


@router.post("/{group_id}/sessions", status_code=status.HTTP_201_CREATED, response_model=dict)
def create_session(group_id: int, payload: dict = Body(...)):
    """
    Schedule a new study session for a specific group, via CreateStudySession.

    Expected JSON body:
    {
      "session_date": "2025-12-01",   # YYYY-MM-DD
      "start_time": "19:00",          # HH:MM (24h)
      "end_time": "20:00",            # HH:MM (24h)
      "location": "Zoom",
      "notes": "Midterm review"
    }
    """
    data = payload or {}

    required = ["session_date", "start_time", "end_time", "location"]
    missing = [k for k in required if not data.get(k)]
    if missing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Missing required fields: {', '.join(missing)}",
        )

    try:
        session_date = datetime.strptime(data["session_date"], "%Y-%m-%d").date()
        start_time = datetime.strptime(data["start_time"], "%H:%M").time()
        end_time = datetime.strptime(data["end_time"], "%H:%M").time()
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid date or time format",
        )

    if session_date < date.today():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Session date cannot be in the past",
        )
    if end_time <= start_time:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="End time must be after start time",
        )

    location = data["location"]
    notes = data.get("notes")

    conn = None
    cursor = None

    try:
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)

        try:
            cursor.callproc(
                "CreateStudySession",
                (group_id, session_date, start_time, end_time, location, notes),
            )
        except MySQLError as e:
            conn.rollback()
            msg = str(e)
            if "GROUP_NOT_FOUND" in msg:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Group not found",
                )
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=msg,
            )

        session_id = None
        for result in cursor.stored_results():
            row = result.fetchone()
            if row:
                session_id = row["session_id"]
                break

        conn.commit()
        if session_id is None:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to create session",
            )

        return {"session_id": session_id}

    except MySQLError as e:
        if conn is not None:
            conn.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e),
        )

    finally:
        if cursor is not None:
            cursor.close()
        if conn is not None:
            conn.close()


@router.get("/{group_id}/requests", response_model=list[dict])
def get_group_join_requests(group_id: int, owner_id: int = Query(...)):
    """
    List PENDING join requests for a group (owner only).
    Wraps GetGroupJoinRequestsForOwner.

    Query param:
      ?owner_id=1005
    """
    conn = None
    cursor = None

    try:
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)

        try:
            cursor.callproc("GetGroupJoinRequestsForOwner", (group_id, owner_id))
        except MySQLError as e:
            msg = str(e)
            if "NOT_OWNER" in msg:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Only group owners can view requests.",
                )
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=msg,
            )

        results = []
        for result in cursor.stored_results():
            rows = result.fetchall()
            for r in rows:
                req_date = r.get("request_date")
                if req_date is not None:
                    req_date = req_date.isoformat()
                results.append(
                    {
                        "user_id": r["user_id"],
                        "full_name": f'{r["first_name"]} {r["last_name"]}',
                        "request_date": req_date,
                    }
                )

        return results

    except MySQLError as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e),
        )

    finally:
        if cursor is not None:
            cursor.close()
        if conn is not None:
            conn.close()


@router.post("/{group_id}/requests/{target_user_id}/approve", response_model=dict)
def approve_join_request(
    group_id: int,
    target_user_id: int,
    owner_id: int = Body(..., embed=True),
):
    """
    Approve a pending join request via ApproveJoinRequest.

    Body JSON:
      { "owner_id": 1005 }
    """
    conn = None
    cursor = None

    try:
        conn = get_db_connection()
        cursor = conn.cursor()

        try:
            cursor.callproc(
                "ApproveJoinRequest",
                (group_id, target_user_id, int(owner_id)),
            )
            conn.commit()
        except MySQLError as e:
            conn.rollback()
            msg = str(e)
            if "NOT_OWNER" in msg:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Only group owners can approve requests.",
                )
            if "NO_PENDING_REQUEST" in msg:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="No pending request for this user.",
                )
            if "GROUP_FULL" in msg:
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail="Group is full",
                )
            if "ALREADY_MEMBER" in msg:
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail="User already a member",
                )
            if "GROUP_NOT_FOUND" in msg:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Group not found",
                )
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=msg,
            )

        return {"status": "approved"}

    except MySQLError as e:
        if conn is not None:
            conn.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e),
        )

    finally:
        if cursor is not None:
            cursor.close()
        if conn is not None:
            conn.close()


@router.post("/{group_id}/requests/{target_user_id}/reject", response_model=dict)
def reject_join_request(
    group_id: int,
    target_user_id: int,
    owner_id: int = Body(..., embed=True),
):
    """
    Reject a pending join request via RejectJoinRequest.

    Body JSON:
      { "owner_id": 1005 }
    """
    conn = None
    cursor = None

    try:
        conn = get_db_connection()
        cursor = conn.cursor()

        try:
            cursor.callproc(
                "RejectJoinRequest",
                (group_id, target_user_id, int(owner_id)),
            )
            conn.commit()
        except MySQLError as e:
            conn.rollback()
            msg = str(e)
            if "NOT_OWNER" in msg:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Only group owners can reject requests.",
                )
            if "NO_PENDING_REQUEST" in msg:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="No pending request to reject.",
                )
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=msg,
            )

        return {"status": "rejected"}

    except MySQLError as e:
        if conn is not None:
            conn.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e),
        )

    finally:
        if cursor is not None:
            cursor.close()
        if conn is not None:
            conn.close()


@router.get("/{group_id}/members", response_model=list[dict])
def get_group_members(group_id: int):
    """
    Return all members of a group.
    Wraps GetGroupMembers(p_group_id).
    """
    conn = None
    cursor = None

    try:
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)

        cursor.callproc("GetGroupMembers", (group_id,))

        members = []
        for result in cursor.stored_results():
            rows = result.fetchall()
            for r in rows:
                joined_at = r.get("joined_at")
                if joined_at is not None:
                    joined_at = joined_at.isoformat()
                members.append(
                    {
                        "user_id": r["user_id"],
                        "user_name": r["user_name"],
                        "role": r["role"],
                        "joined_at": joined_at,
                    }
                )

        return members

    except MySQLError as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e),
        )

    finally:
        if cursor is not None:
            cursor.close()
        if conn is not None:
            conn.close()


@router.post("/{group_id}/members/{target_user_id}/kick", response_model=dict)
def kick_member(
    group_id: int,
    target_user_id: int,
    owner_id: int = Body(..., embed=True),
):
    """
    Owner-only: remove a member from the group via KickGroupMember.

    Body JSON: { "owner_id": 1005 }
    """
    conn = None
    cursor = None

    try:
        conn = get_db_connection()
        cursor = conn.cursor()

        try:
            cursor.callproc(
                "KickGroupMember",
                (group_id, int(owner_id), target_user_id),
            )
            conn.commit()
        except MySQLError as e:
            conn.rollback()
            msg = str(e)
            if "NOT_OWNER" in msg:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Only owner can remove members",
                )
            if "OWNER_CANNOT_REMOVE_SELF" in msg:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Owner cannot remove themselves",
                )
            if "MEMBER_NOT_FOUND" in msg:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Member not found in this group",
                )
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=msg,
            )

        return {"status": "removed"}

    except MySQLError as e:
        if conn is not None:
            conn.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e),
        )

    finally:
        if cursor is not None:
            cursor.close()
        if conn is not None:
            conn.close()


@router.post("/{group_id}/invite-code", response_model=dict)
def generate_invite_code(group_id: int, owner_id: int = Body(..., embed=True)):
    """
    Owner-only: generate a short-lived invite code for a PRIVATE group.

    Body JSON: { "owner_id": 1005 }
    """
    conn = None
    cursor = None

    try:
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)

        # Check group + private flag
        cursor.execute(
            "SELECT group_id, is_private FROM Study_Group WHERE group_id = %s",
            (group_id,),
        )
        g = cursor.fetchone()
        if not g:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Group not found",
            )

        if not g["is_private"]:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invite codes are only for private groups.",
            )

        # Verify owner
        cursor.execute(
            """
            SELECT role
            FROM Group_Member
            WHERE group_id = %s AND user_id = %s
            """,
            (group_id, int(owner_id)),
        )
        role_row = cursor.fetchone()
        if not role_row or role_row["role"] != "owner":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only group owners can generate invite codes.",
            )

        alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
        invite_code = "".join(secrets.choice(alphabet) for _ in range(8))
        expires_at = datetime.utcnow() + timedelta(minutes=10)

        cursor.execute(
            """
            UPDATE Study_Group
            SET invite_code = %s,
                invite_expires_at = %s
            WHERE group_id = %s
            """,
            (invite_code, expires_at, group_id),
        )

        conn.commit()
        return {
            "invite_code": invite_code,
            "expires_at": expires_at.isoformat() + "Z",
        }

    except MySQLError as e:
        if conn is not None:
            conn.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e),
        )

    finally:
        if cursor is not None:
            cursor.close()
        if conn is not None:
            conn.close()


@router.post("/join-with-code", response_model=dict)
def join_with_code(payload: dict = Body(...)):
    """
    Join a PRIVATE group using an invite code, via JoinPrivateGroupWithCode.

    Body JSON:
      { "user_id": 1006, "invite_code": "AB12CD34" }
    """
    data = payload or {}
    user_id = data.get("user_id")
    invite_code = (data.get("invite_code") or "").strip().upper()

    if not user_id or not invite_code:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="user_id and invite_code are required",
        )

    conn = None
    cursor = None

    try:
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)

        try:
            cursor.callproc("JoinPrivateGroupWithCode", (int(user_id), invite_code))
        except MySQLError as e:
            conn.rollback()
            msg = str(e)
            if "INVALID_CODE" in msg:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Invalid invite code",
                )
            if "NOT_PRIVATE_GROUP" in msg:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Invite code is not for a private group",
                )
            if "CODE_EXPIRED" in msg:
                raise HTTPException(
                    status_code=status.HTTP_410_GONE,
                    detail="Invite code has expired",
                )
            if "ALREADY_MEMBER" in msg:
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail="User already a member",
                )
            if "GROUP_NOT_FOUND" in msg:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Group not found",
                )
            if "GROUP_FULL" in msg:
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail="Group is full",
                )
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=msg,
            )

        group_id = None
        for result in cursor.stored_results():
            row = result.fetchone()
            if row:
                group_id = row["group_id"]
                break

        conn.commit()

        if group_id is None:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to join group",
            )

        return {
            "status": "joined",
            "group_id": group_id,
        }

    except MySQLError as e:
        if conn is not None:
            conn.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e),
        )

    finally:
        if cursor is not None:
            cursor.close()
        if conn is not None:
            conn.close()
