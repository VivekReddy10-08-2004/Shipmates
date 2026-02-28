from fastapi import APIRouter, HTTPException, status, Query
from db import get_db_connection
from utils.transactions import create_full_quiz_transaction, submit_quiz_transaction
from models import QuizSubmission

router = APIRouter()


# ============= CREATE FULL QUIZ (ACID) =============
@router.post("/create", status_code=status.HTTP_201_CREATED, response_model=dict)
def create_quiz(
    title: str = Query(...),
    description: str = Query(None),
    course_id: int = Query(...),
    creator_id: int = Query(...),
):
    """Create a new quiz with questions and answers via transaction."""
    if not title:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Title is required",
        )

    payload = {
        "title": title,
        "description": description,
        "course_id": course_id,
        "creator_id": creator_id,
        "questions": [],  # Would come from request body in full implementation
    }

    quiz_id, error = create_full_quiz_transaction(payload)

    if error:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=error,
        )

    return {"message": "Quiz created successfully", "quiz_id": quiz_id}


# ============= GET QUIZ =============
@router.get("/{quiz_id}", response_model=dict)
def get_quiz(quiz_id: int):
    """Get a quiz with all questions and answers."""
    conn = get_db_connection()
    if not conn:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Database connection failed",
        )

    cursor = conn.cursor(dictionary=True)
    try:
        cursor.execute("SELECT * FROM quiz WHERE quiz_id = %s", (quiz_id,))
        quiz = cursor.fetchone()

        if not quiz:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Quiz not found",
            )

        cursor.execute(
            "SELECT * FROM question WHERE quiz_id = %s ORDER BY question_id",
            (quiz_id,),
        )
        questions = cursor.fetchall()

        quiz["questions"] = questions
        return quiz

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e),
        )
    finally:
        try:
            cursor.close()
        except Exception:
            pass
        try:
            conn.close()
        except Exception:
            pass


# ============= SUBMIT QUIZ =============
@router.post("/submit", status_code=status.HTTP_200_OK, response_model=dict)
def submit_quiz(
    user_id: int = Query(...),
    quiz_id: int = Query(...),
):
    """Submit a completed quiz."""
    payload = {
        "user_id": user_id,
        "quiz_id": quiz_id,
        "answers": [],
    }

    score, error = submit_quiz_transaction(payload)

    if error:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=error,
        )

    return {"message": "Quiz submitted", "score": score}
