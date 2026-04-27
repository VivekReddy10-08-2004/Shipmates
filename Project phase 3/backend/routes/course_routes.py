# Jacob Craig

import re

from fastapi import APIRouter, HTTPException, status, Query
from mysql.connector import Error as MySQLError
from pydantic import BaseModel
from db import get_db_connection

router = APIRouter()


class EnsureCourseRequest(BaseModel):
    text: str


def _parse_course_text(text: str) -> tuple[str, str]:
    raw = (text or "").strip()
    if not raw:
        raise ValueError("Course text is required")

    # Accept "CODE - Name" or "CODE: Name" input, otherwise derive a code.
    parts = re.split(r"\s*[-:]\s*", raw, maxsplit=1)
    if len(parts) == 2 and parts[0].strip() and parts[1].strip():
        course_code = parts[0].strip()
        course_name = parts[1].strip()
    else:
        course_name = raw
        cleaned = re.sub(r"[^A-Za-z0-9 ]+", "", raw).upper().strip()
        course_code = re.sub(r"\s+", " ", cleaned)[:20] or "GEN COURSE"

    return course_code[:20], course_name[:255]


@router.get("/search", response_model=list[dict])
def search_courses(q: str = Query("", min_length=2, max_length=100), limit: int = Query(8, ge=1, le=50)):
    """
    Smart search over course_code / course_name.
    
    Query params:
      ?q=cos 420&limit=8

    Returns:
      [
        {
          "course_id": 123,
          "course_code": "COS 420",
          "course_name": "Database Systems",
          "college_name": "University of Southern Maine"
        },
        ...
      ]
    """
    if len(q) < 2:
        # too short – avoid spamming DB
        return []

    conn = None
    cursor = None

    try:
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)

        # CALL SearchCoursesSmart(p_query, p_limit)
        cursor.callproc("SearchCoursesSmart", (q, limit))

        results = []
        for result in cursor.stored_results():
            rows = result.fetchall()
            for r in rows:
                results.append(
                    {
                        "course_id": r["course_id"],
                        "course_code": r["course_code"],
                        "course_name": r["course_name"],
                        "college_name": r.get("college_name"),
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


@router.post("/ensure", response_model=dict)
def ensure_course(payload: EnsureCourseRequest):
    """
    Ensure a course exists based on free-typed input.
    - If an exact code/name match exists (case-insensitive), return it.
    - Otherwise create a new course row and return it.
    """
    conn = None
    cursor = None

    try:
        course_code, course_name = _parse_course_text(payload.text)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))

    try:
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)

        cursor.execute(
            """
            SELECT c.course_id, c.course_code, c.course_name, col.college_name
            FROM Courses c
            LEFT JOIN Colleges col ON col.college_id = c.college_id
            WHERE LOWER(c.course_code) = LOWER(%s)
               OR LOWER(c.course_name) = LOWER(%s)
            ORDER BY c.course_id ASC
            LIMIT 1
            """,
            (course_code, course_name),
        )
        existing = cursor.fetchone()
        if existing:
            return {**existing, "created": False}

        cursor.execute(
            """
            INSERT INTO Courses (course_code, course_name, college_id)
            VALUES (%s, %s, NULL)
            """,
            (course_code, course_name),
        )
        conn.commit()

        course_id = cursor.lastrowid
        return {
            "course_id": course_id,
            "course_code": course_code,
            "course_name": course_name,
            "college_name": None,
            "created": True,
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

