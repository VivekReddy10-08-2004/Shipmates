# Jacob Craig

from fastapi import APIRouter, HTTPException, status, Query
from mysql.connector import Error as MySQLError
from db import get_db_connection
from models import Course

router = APIRouter()


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

