# Jacob Craig

from fastapi import APIRouter, HTTPException, status, Query, UploadFile, File, Request
from pydantic import BaseModel
from typing import Optional, List
from mysql.connector import Error as MySQLError
from db import get_db_connection
import uuid
import os

router = APIRouter()


@router.get("/profile", response_model=dict)
def get_match_profile(user_id: int = Query(...)):
    """Fetch existing StudyBuddy Match profile + courses for a user."""
    conn = None
    cur = None

    try:
        conn = get_db_connection()
        cur = conn.cursor(dictionary=True)

        cur.execute(
            """
            SELECT
              user_id, study_style, meeting_pref, study_goal,
              focus_time_pref, noise_pref, age,
              preferred_min_age, preferred_max_age, bio, profile_image_url
            FROM Match_Profile
            WHERE user_id = %s
            """,
            (user_id,),
        )
        profile = cur.fetchone()

        if not profile:
            return {"exists": False, "profile": None, "courses": []}

        cur.execute(
            """
            SELECT mpc.course_id, c.course_code, c.course_name, col.college_name
            FROM Match_Profile_Course AS mpc
            JOIN Courses AS c ON c.course_id = mpc.course_id
            LEFT JOIN Colleges AS col ON col.college_id = c.college_id
            WHERE mpc.user_id = %s
            ORDER BY c.course_code, c.course_name
            """,
            (user_id,),
        )
        courses = cur.fetchall() or []

        return {"exists": True, "profile": profile, "courses": courses}

    except MySQLError as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e),
        )

    finally:
        if cur is not None:
            cur.close()
        if conn is not None:
            conn.close()


class MatchProfilePayload(BaseModel):
    user_id: int
    study_style: Optional[str] = None
    meeting_pref: Optional[str] = None
    bio: Optional[str] = None
    profile_image_url: Optional[str] = None
    study_goal: Optional[str] = None
    focus_time_pref: Optional[str] = None
    noise_pref: Optional[str] = None
    age: Optional[int] = None
    preferred_min_age: Optional[int] = None
    preferred_max_age: Optional[int] = None
    course_ids: Optional[List[int]] = None


@router.post("/profile", response_model=dict)
def upsert_match_profile(payload: MatchProfilePayload):
    """Create/Update a user's StudyBuddy match profile and selected courses."""
    conn = None
    cur = None

    try:
        conn = get_db_connection()
        cur = conn.cursor(dictionary=True)

        cur.execute(
            "CALL UpsertMatchProfile(%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)",
            (
                payload.user_id,
                payload.study_style,
                payload.meeting_pref,
                payload.bio,
                payload.profile_image_url,
                payload.study_goal,
                payload.focus_time_pref,
                payload.noise_pref,
                payload.age,
                payload.preferred_min_age,
                payload.preferred_max_age,
            ),
        )

        while cur.nextset():
            pass

        # Replace the user's course selections
        if payload.course_ids is not None:
            cur.execute(
                "DELETE FROM Match_Profile_Course WHERE user_id = %s",
                (payload.user_id,),
            )
            if payload.course_ids:
                cur.executemany(
                    "INSERT INTO Match_Profile_Course (user_id, course_id) VALUES (%s, %s)",
                    [(payload.user_id, cid) for cid in payload.course_ids],
                )

        conn.commit()

        return {"status": "ok"}

    except MySQLError as e:
        if conn:
            conn.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e),
        )

    finally:
        if cur is not None:
            cur.close()
        if conn is not None:
            conn.close()


@router.get("/suggestions", response_model=list[dict])
def get_study_buddy_matches(user_id: int = Query(...), limit: int = Query(20, ge=1, le=50)):
    """Get match suggestions for a user."""
    conn = None
    cur = None

    try:
        conn = get_db_connection()
        cur = conn.cursor(dictionary=True)

        cur.execute("CALL GetStudyBuddyMatches(%s, %s)", (user_id, limit))
        rows = cur.fetchall() or []

        while cur.nextset():
            pass

        formatted = []
        for r in rows:
            r["shared_courses"] = int(r.get("shared_courses", 0) or 0)
            r["match_score"] = int(r.get("match_score", 0) or 0)
            formatted.append(r)

        return formatted

    except MySQLError as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e),
        )

    finally:
        if cur is not None:
            cur.close()
        if conn is not None:
            conn.close()
@router.get("/groups", response_model=list[dict])
def get_matching_groups(user_id: int = Query(...), limit: int = Query(20, ge=1, le=50)):
    """Compatible study groups for a user (Compatible Crews on the match page)."""
    conn = None
    cur = None

    try:
        conn = get_db_connection()
        cur = conn.cursor(dictionary=True)

        cur.execute("CALL GetMatchingGroupsForUser(%s, %s)", (user_id, limit))
        rows = cur.fetchall() or []

        while cur.nextset():
            pass

        formatted = []
        for r in rows:
            r["match_score"] = int(r.get("match_score", 0) or 0)
            r["member_count"] = int(r.get("member_count", 0) or 0)
            r["max_members"] = int(r.get("max_members", 0) or 0)
            r["shared_courses_with_owner"] = int(r.get("shared_courses_with_owner", 0) or 0)
            r["user_has_group_course"] = bool(r.get("user_has_group_course", 0))
            formatted.append(r)

        return formatted

    except MySQLError as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e),
        )

    finally:
        if cur is not None:
            cur.close()
        if conn is not None:
            conn.close()


@router.post("/profile/image", status_code=status.HTTP_201_CREATED, response_model=dict)
async def upload_profile_image(request: Request, file: UploadFile = File(...)):
    """Upload a profile image and return a served URL."""
    if not file.filename:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Empty filename",
        )

    _, ext = os.path.splitext(file.filename)
    if ext.lower() not in [".png", ".jpg", ".jpeg", ".gif", ".webp"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Unsupported file type",
        )

    base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    upload_folder = os.path.join(base_dir, "uploads")
    os.makedirs(upload_folder, exist_ok=True)

    new_name = f"{uuid.uuid4().hex}{ext.lower()}"
    save_path = os.path.join(upload_folder, new_name)

    contents = await file.read()
    with open(save_path, "wb") as out:
        out.write(contents)

    file_url = str(request.base_url).rstrip("/") + f"/uploads/{new_name}"
    return {"url": file_url}
