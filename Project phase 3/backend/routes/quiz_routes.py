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


    raw_questions = data.get("questions") or []
    normalized_questions = []

    for idx, q in enumerate(raw_questions):
        # Try multiple possible keys for the question text
        q_text = (
            q.get("question_text")
            or q.get("text")
            or q.get("question")
            or q.get("prompt")
        )

        if not q_text:
            return jsonify({
                "error": f"Question {idx + 1} is missing text"
            }), 400

        q_type = q.get("question_type") or q.get("type") or "multiple_choice"
        points = q.get("points", 1)

        # Normalize answers/options
        raw_answers = (
            q.get("answers")
            or q.get("options")
            or []
        )
        normalized_answers = []
        for a in raw_answers:
            a_text = (
                a.get("answer_text")
                or a.get("text")
                or a.get("label")
                or a.get("option")
            )
            if not a_text:
                # skip answer with no text
                continue

            is_correct = None
            if "is_correct" in a:
                is_correct = a.get("is_correct")
            elif "correct" in a:
                is_correct = a.get("correct")
            elif "isCorrect" in a:
                is_correct = a.get("isCorrect")

            is_correct = 1 if is_correct else 0

            normalized_answers.append({
                "answer_text": a_text,
                "is_correct": is_correct,
            })

        normalized_questions.append({
            "question_text": q_text,
            "question_type": q_type,
            "points": points,
            "answers": normalized_answers,
        })

    payload = {
        "title": title,
        "description": data.get("description"),
        "course_id": data.get("course_id"),
        "creator_id": user["user_id"],
        "questions": normalized_questions,
    }

    quiz_id, error = create_full_quiz_transaction(payload)

    if error:
        print("QUIZ CREATE ERROR:", error)
        return jsonify({"error": error}), 500

    return jsonify({"message": "Quiz created successfully", "quiz_id": quiz_id}), 201


# ------------------------------
# List Quizzes
# ------------------------------
@quiz_bp.route("/quizzes", methods=["GET"])
def list_quizzes():
    conn = get_db_connection()
    if not conn:
        return jsonify({"error": "Database connection failed"}), 500

    cursor = conn.cursor(dictionary=True)
    try:
        # Pagination: defaults page=1, limit=20, max limit=100
        try:
            page = max(1, int(request.args.get("page", 1)))
            limit = int(request.args.get("limit", 20))
        except ValueError:
            return jsonify({"error": "Invalid pagination parameters"}), 400
        limit = min(max(limit, 1), 100)
        offset = (page - 1) * limit

        cursor.execute(
            """
            SELECT quiz_id AS id, title, description, creator_id, created_at
            FROM Quiz
            ORDER BY quiz_id DESC
            LIMIT %s OFFSET %s
            """,
            (limit, offset),
        )
        quizzes = cursor.fetchall()
        return jsonify({"page": page, "limit": limit, "items": quizzes})
    except Exception as e:
        print("LIST_QUIZZES ERROR:", e)
        return jsonify({"error": str(e)}), 500
    finally:
        try:
            cursor.close()
        except Exception:
            pass
        try:
            conn.close()
        except Exception:
            pass


# ------------------------------
# Get Quiz (Read-Only)
# ------------------------------
@quiz_bp.route("/<int:quiz_id>", methods=["GET"])
def get_quiz(quiz_id):
    conn = get_db_connection()
    if not conn:
        return jsonify({"error": "Database connection failed"}), 500

    cursor = conn.cursor(dictionary=True)
    try:
        cursor.execute("SELECT * FROM Quiz WHERE quiz_id = %s", (quiz_id,))
        quiz = cursor.fetchone()

        if not quiz:
            return jsonify({"error": "Quiz not found"}), 404

        cursor.execute("SELECT * FROM Question WHERE quiz_id = %s", (quiz_id,))
        questions = cursor.fetchall()

        # Batch fetch all answers to avoid N+1 query pattern
        question_ids = [q["question_id"] for q in questions]
        answers_by_qid = {qid: [] for qid in question_ids}
        if question_ids:
            placeholders = ",".join(["%s"] * len(question_ids))
            cursor.execute(f"SELECT * FROM Answer WHERE question_id IN ({placeholders})", tuple(question_ids))
            for ans in cursor.fetchall():
                answers_by_qid[ans["question_id"]].append(ans)

        for q in questions:
            q["answers"] = answers_by_qid.get(q["question_id"], [])

        quiz["questions"] = questions
        return jsonify(quiz)
    except Exception as e:
        print("GET_QUIZ ERROR:", e)
        return jsonify({"error": str(e)}), 500
    finally:
        try:
            cursor.close()
        except Exception:
            pass
        try:
            conn.close()
        except Exception:
            pass


# ------------------------------
# Submit Quiz
# ------------------------------
@quiz_bp.route("/submit", methods=["POST"])
def submit_quiz():
    user = session.get("user")
    if not user:
        return jsonify({"error": "Not logged in"}), 401

    data = request.get_json() or {}

    quiz_id = data.get("quiz_id")
    answers = data.get("answers")

    if not quiz_id or answers is None:
        return jsonify({"error": "quiz_id and answers are required"}), 400

    result, error = submit_quiz_transaction(
        user_id=user["user_id"],
        quiz_id=quiz_id,
        answers_dict=answers,
    )

    if error:
        print("SUBMIT_QUIZ ERROR:", error)
        return jsonify({"error": error}), 500

    return jsonify(result), 200
