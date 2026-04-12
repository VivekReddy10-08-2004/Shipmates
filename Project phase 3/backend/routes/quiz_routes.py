from fastapi import APIRouter, HTTPException, status, Body, Query
from pydantic import BaseModel
from typing import Optional, List
from db import get_db_connection
from utils.transactions import create_full_quiz_transaction, submit_quiz_transaction

router = APIRouter()


# ---- Pydantic models for JSON body ----

class AnswerInput(BaseModel):
    answer_text: str
    is_correct: bool = False

class QuestionInput(BaseModel):
    question_text: str
    question_type: str = "multiple_choice"
    points: int = 1
    answers: List[AnswerInput] = []

class CreateQuizRequest(BaseModel):
    title: str
    description: Optional[str] = None
    course_id: int
    creator_id: int
    questions: List[QuestionInput] = []

class SubmitQuizRequest(BaseModel):
    user_id: int
    quiz_id: int
    answers: dict = {}   # { "question_id": answer_id, ... }


@router.post("/create", status_code=status.HTTP_201_CREATED, response_model=dict)
def create_quiz(payload: CreateQuizRequest):
    """Create a new quiz with questions and answers via transaction."""
    if not payload.title.strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Title is required",
        )

    data = {
        "title": payload.title.strip(),
        "description": payload.description,
        "course_id": payload.course_id,
        "creator_id": payload.creator_id,
        "questions": [
            {
                "question_text": q.question_text,
                "question_type": q.question_type,
                "points": q.points,
                "answers": [
                    {"answer_text": a.answer_text, "is_correct": a.is_correct}
                    for a in q.answers
                ],
            }
            for q in payload.questions
        ],
    }

    quiz_id, error = create_full_quiz_transaction(data)

    if error:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=error,
        )

    return {"message": "Quiz created successfully", "quiz_id": quiz_id}


@router.get("/quizzes", response_model=dict)
def list_quizzes(
    page: int = 1,
    limit: int = 20,
    creator_id: Optional[int] = Query(None),
):
    if page < 1:
        page = 1
    if limit < 1:
        limit = 1
    if limit > 100:
        limit = 100

    conn = get_db_connection()
    if not conn:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Database connection failed",
        )

    cursor = conn.cursor(dictionary=True)
    try:
        offset = (page - 1) * limit

        if creator_id is not None:
            cursor.execute(
                "SELECT COUNT(*) AS total FROM quiz WHERE creator_id = %s",
                (creator_id,),
            )
            total = cursor.fetchone()["total"]
            cursor.execute(
                """
                SELECT quiz_id, title, description, course_id, creator_id, created_at
                FROM quiz
                WHERE creator_id = %s
                ORDER BY quiz_id DESC
                LIMIT %s OFFSET %s
                """,
                (creator_id, limit, offset),
            )
        else:
            cursor.execute("SELECT COUNT(*) AS total FROM quiz")
            total = cursor.fetchone()["total"]
            cursor.execute(
                """
                SELECT quiz_id, title, description, course_id, creator_id, created_at
                FROM quiz
                ORDER BY quiz_id DESC
                LIMIT %s OFFSET %s
                """,
                (limit, offset),
            )
        items = cursor.fetchall()

        return {
            "items": items,
            "page": page,
            "limit": limit,
            "total": total,
        }

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

        for question in questions:
            cursor.execute(
                "SELECT * FROM answer WHERE question_id = %s ORDER BY answer_id",
                (question["question_id"],),
            )
            question["answers"] = cursor.fetchall()

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


@router.post("/submit", status_code=status.HTTP_200_OK, response_model=dict)
def submit_quiz(payload: SubmitQuizRequest):
    """Submit a completed quiz with answers as JSON body."""
    if not payload.answers:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No answers provided",
        )

    # Convert string keys to int (JSON keys are always strings)
    answers_dict = {}
    for k, v in payload.answers.items():
        answers_dict[int(k)] = int(v)

    result, error = submit_quiz_transaction(
        user_id=payload.user_id,
        quiz_id=payload.quiz_id,
        answers_dict=answers_dict,
    )

    if error:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=error,
        )

    return {"message": "Quiz submitted", **result}
