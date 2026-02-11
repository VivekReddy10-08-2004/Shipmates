# Jacob Craig

from fastapi import APIRouter, HTTPException, status, Query
from mysql.connector import Error as MySQLError
import secrets
from datetime import datetime, date, timedelta
from db import get_db_connection
from models import CreateStudyGroup

router = APIRouter()


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
        cursor = conn.cursor()

        cursor.callproc("GetUserGroups", (user_id,))

        groups = []

        for result in cursor.stored_results():
            rows = result.fetchall()
            col_names = result.column_names
            for row in rows:
                row_dict = dict(zip(col_names, row))
                groups.append(
                    {
                        "group_id": row_dict["group_id"],
                        "group_name": row_dict["group_name"],
                        "role": row_dict["role"],
                        "user_id": row_dict["user_id"],
                        "user_name": row_dict["user_name"],
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

    """
    Wraps GetUpcomingSessionsForUser.
    Query: ?user_id=...&limit=50
    """
    user_id = request.args.get("user_id", type=int)
    limit = request.args.get("limit", default=50, type=int)

    if not user_id:
        return jsonify({"detail": "user_id is required"}), 400

    conn = None
    cursor = None

    try:
        conn = get_db_connection()
        cursor = conn.cursor()

        cursor.callproc("GetUpcomingSessionsForUser", (user_id, limit))

        sessions = []

        for result in cursor.stored_results():
            rows = result.fetchall()
            col_names = result.column_names
            for row in rows:
                row_dict = dict(zip(col_names, row))

                if row_dict.get("session_date") is not None:
                    row_dict["session_date"] = row_dict["session_date"].isoformat()
                if row_dict.get("start_time") is not None:
                    row_dict["start_time"] = str(row_dict["start_time"])
                if row_dict.get("end_time") is not None:
                    row_dict["end_time"] = str(row_dict["end_time"])

                sessions.append(row_dict)

        return jsonify(sessions), 200

    except MySQLError as e:
        return jsonify({"detail": str(e)}), 500

    finally:
        if cursor is not None:
            cursor.close()
        if conn is not None:
            conn.close()


@bp.route("/<int:group_id>/sessions", methods=["POST"])
def create_session(group_id):
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
    data = request.get_json(silent=True) or {}

    required = ["session_date", "start_time", "end_time", "location"]
    missing = [k for k in required if not data.get(k)]
    if missing:
        return jsonify({"detail": f"Missing required fields: {', '.join(missing)}"}), 400

    try:
        session_date = datetime.strptime(data["session_date"], "%Y-%m-%d").date()
        start_time = datetime.strptime(data["start_time"], "%H:%M").time()
        end_time = datetime.strptime(data["end_time"], "%H:%M").time()
    except ValueError:
        return jsonify({"detail": "Invalid date or time format"}), 400

    if session_date < date.today():
        return jsonify({"detail": "Session date cannot be in the past"}), 400
    if end_time <= start_time:
        return jsonify({"detail": "End time must be after start time"}), 400

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
                return jsonify({"detail": "Group not found"}), 404
            return jsonify({"detail": msg}), 500

        session_id = None
        for result in cursor.stored_results():
            row = result.fetchone()
            if row:
                session_id = row["session_id"]
                break

        conn.commit()
        if session_id is None:
            return jsonify({"detail": "Failed to create session"}), 500

        return jsonify({"session_id": session_id}), 201

    except MySQLError as e:
        if conn is not None:
            conn.rollback()
        return jsonify({"detail": str(e)}), 500

    finally:
        if cursor is not None:
            cursor.close()
        if conn is not None:
            conn.close()


@bp.route("/<int:group_id>/requests", methods=["GET"])
def get_group_join_requests(group_id: int):
    """
    List PENDING join requests for a group (owner only).
    Wraps GetGroupJoinRequestsForOwner.

    Query param:
      ?owner_id=1005
    """
    owner_id = request.args.get("owner_id", type=int)
    if not owner_id:
        return jsonify({"detail": "Missing owner_id"}), 400

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
                return jsonify({"detail": "Only group owners can view requests."}), 403
            return jsonify({"detail": msg}), 500

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

        return jsonify(results), 200

    except MySQLError as e:
        return jsonify({"detail": str(e)}), 500

    finally:
        if cursor is not None:
            cursor.close()
        if conn is not None:
            conn.close()


@bp.route("/<int:group_id>/requests/<int:target_user_id>/approve", methods=["POST"])
def approve_join_request(group_id: int, target_user_id: int):
    """
    Approve a pending join request via ApproveJoinRequest.

    Body JSON:
      { "owner_id": 1005 }
    """
    data = request.get_json(silent=True) or {}
    owner_id = data.get("owner_id")

    if not owner_id:
        return jsonify({"detail": "Missing owner_id"}), 400

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
                return jsonify({"detail": "Only group owners can approve requests."}), 403
            if "NO_PENDING_REQUEST" in msg:
                return jsonify({"detail": "No pending request for this user."}), 404
            if "GROUP_FULL" in msg:
                return jsonify({"detail": "Group is full"}), 409
            if "ALREADY_MEMBER" in msg:
                return jsonify({"detail": "User already a member"}), 409
            if "GROUP_NOT_FOUND" in msg:
                return jsonify({"detail": "Group not found"}), 404
            return jsonify({"detail": msg}), 500

        return jsonify({"status": "approved"}), 200

    except MySQLError as e:
        if conn is not None:
            conn.rollback()
        return jsonify({"detail": str(e)}), 500

    finally:
        if cursor is not None:
            cursor.close()
        if conn is not None:
            conn.close()


@bp.route("/<int:group_id>/requests/<int:target_user_id>/reject", methods=["POST"])
def reject_join_request(group_id: int, target_user_id: int):
    """
    Reject a pending join request via RejectJoinRequest.

    Body JSON:
      { "owner_id": 1005 }
    """
    data = request.get_json(silent=True) or {}
    owner_id = data.get("owner_id")

    if not owner_id:
        return jsonify({"detail": "Missing owner_id"}), 400

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
                return jsonify({"detail": "Only group owners can reject requests."}), 403
            if "NO_PENDING_REQUEST" in msg:
                return jsonify({"detail": "No pending request to reject."}), 404
            return jsonify({"detail": msg}), 500

        return jsonify({"status": "rejected"}), 200

    except MySQLError as e:
        if conn is not None:
            conn.rollback()
        return jsonify({"detail": str(e)}), 500

    finally:
        if cursor is not None:
            cursor.close()
        if conn is not None:
            conn.close()


@bp.route("/<int:group_id>/members", methods=["GET"])
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

        return jsonify(members), 200

    except MySQLError as e:
        return jsonify({"detail": str(e)}), 500

    finally:
        if cursor is not None:
            cursor.close()
        if conn is not None:
            conn.close()


@bp.route("/<int:group_id>/members/<int:target_user_id>/kick", methods=["POST"])
def kick_member(group_id: int, target_user_id: int):
    """
    Owner-only: remove a member from the group via KickGroupMember.

    Body JSON: { "owner_id": 1005 }
    """
    data = request.get_json(silent=True) or {}
    owner_id = data.get("owner_id")

    if not owner_id:
        return jsonify({"detail": "Missing field: owner_id"}), 400

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
                return jsonify({"detail": "Only owner can remove members"}), 403
            if "OWNER_CANNOT_REMOVE_SELF" in msg:
                return jsonify({"detail": "Owner cannot remove themselves"}), 400
            if "MEMBER_NOT_FOUND" in msg:
                return jsonify({"detail": "Member not found in this group"}), 404
            return jsonify({"detail": msg}), 500

        return jsonify({"status": "removed"}), 200

    except MySQLError as e:
        if conn is not None:
            conn.rollback()
        return jsonify({"detail": str(e)}), 500

    finally:
        if cursor is not None:
            cursor.close()
        if conn is not None:
            conn.close()


@bp.route("/<int:group_id>/invite-code", methods=["POST"])
def generate_invite_code(group_id: int):
    """
    Owner-only: generate a short-lived invite code for a PRIVATE group.

    Body JSON: { "owner_id": 1005 }
    """
    data = request.get_json(silent=True) or {}
    owner_id = data.get("owner_id")

    if not owner_id:
        return jsonify({"detail": "Missing owner_id"}), 400

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
            return jsonify({"detail": "Group not found"}), 404

        if not g["is_private"]:
            return jsonify({"detail": "Invite codes are only for private groups."}), 400

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
            return jsonify({"detail": "Only group owners can generate invite codes."}), 403

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
        return jsonify({
            "invite_code": invite_code,
            "expires_at": expires_at.isoformat() + "Z",
        }), 200

    except MySQLError as e:
        if conn is not None:
            conn.rollback()
        return jsonify({"detail": str(e)}), 500

    finally:
        if cursor is not None:
            cursor.close()
        if conn is not None:
            conn.close()


@bp.route("/join-with-code", methods=["POST"])
def join_with_code():
    """
    Join a PRIVATE group using an invite code, via JoinPrivateGroupWithCode.

    Body JSON:
      { "user_id": 1006, "invite_code": "AB12CD34" }
    """
    data = request.get_json(silent=True) or {}
    user_id = data.get("user_id")
    invite_code = (data.get("invite_code") or "").strip().upper()

    if not user_id or not invite_code:
        return jsonify({"detail": "user_id and invite_code are required"}), 400

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
                return jsonify({"detail": "Invalid invite code"}), 404
            if "NOT_PRIVATE_GROUP" in msg:
                return jsonify({"detail": "Invite code is not for a private group"}), 400
            if "CODE_EXPIRED" in msg:
                return jsonify({"detail": "Invite code has expired"}), 410
            if "ALREADY_MEMBER" in msg:
                return jsonify({"detail": "User already a member"}), 409
            if "GROUP_NOT_FOUND" in msg:
                return jsonify({"detail": "Group not found"}), 404
            if "GROUP_FULL" in msg:
                return jsonify({"detail": "Group is full"}), 409
            return jsonify({"detail": msg}), 500

        group_id = None
        for result in cursor.stored_results():
            row = result.fetchone()
            if row:
                group_id = row["group_id"]
                break

        conn.commit()

        if group_id is None:
            return jsonify({"detail": "Failed to join group"}), 500

        return jsonify({
            "status": "joined",
            "group_id": group_id,
        }), 200

    except MySQLError as e:
        if conn is not None:
            conn.rollback()
        return jsonify({"detail": str(e)}), 500

    finally:
        if cursor is not None:
            cursor.close()
        if conn is not None:
            conn.close()
