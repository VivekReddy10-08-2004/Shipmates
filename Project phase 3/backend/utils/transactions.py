import mysql.connector
import sys
import os

# Fix for "Import 'db' could not be resolved"
# This adds the parent directory (backend/) to the system path so we can import db.py
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from db import get_db_connection

# ==========================================
# QUIZ CREATION (ACID)
# ==========================================
def create_full_quiz_transaction(data):
    """
    Creates a Quiz, Questions, and Answers in ONE atomic transaction.
    """
    conn = get_db_connection()
    if not conn:
        return None, "Database connection failed"
    
    cursor = conn.cursor()
    
    try:
        conn.start_transaction()

        # 1. Create Quiz Header
        cursor.execute(
            "INSERT INTO Quiz (title, description, course_id, creator_id) VALUES (%s, %s, %s, %s)",
            (data['title'], data.get('description'), data['course_id'], data['creator_id'])
        )
        quiz_id = cursor.lastrowid

        # 2. Add Questions
        for q in data.get('questions', []):
            cursor.execute(
                "INSERT INTO Question (quiz_id, question_text, question_type, points) VALUES (%s, %s, %s, %s)",
                (quiz_id, q['question_text'], q.get('question_type', 'multiple_choice'), q.get('points', 1))
            )
            question_id = cursor.lastrowid

            # 3. Add Answers for this Question
            for a in q.get('answers', []):
                cursor.execute(
                    "INSERT INTO Answer (question_id, answer_text, is_correct) VALUES (%s, %s, %s)",
                    (question_id, a['answer_text'], a.get('is_correct', False))
                )

        conn.commit()
        return quiz_id, None

    except mysql.connector.Error as err:
        conn.rollback()
        print(f"Transaction Failed: {err}")
        return None, str(err)
    finally:
        cursor.close()
        conn.close()

# ==========================================
# FLASHCARD CREATION (ACID)
# ==========================================
def create_flashcard_set_transaction(data):
    """
    Creates a Flashcard Set and all cards in one transaction.
    """
    conn = get_db_connection()
    if not conn:
        return None, "Database connection failed"
    
    cursor = conn.cursor()
    
    try:
        conn.start_transaction()

        # Allow missing course_id and be tolerant of payload shapes from the frontend
        course_id = data.get('course_id')
        cursor.execute(
            "INSERT INTO flashcardset (title, description, course_id, creator_id) VALUES (%s, %s, %s, %s)",
            (data['title'], data.get('description'), course_id, data['creator_id'])
        )
        set_id = cursor.lastrowid

        # Frontend may send `cards` with keys `front_text`/`back_text` or
        # `flashcards` with `front`/`back`. Normalize both.
        raw_cards = data.get('cards') if data.get('cards') is not None else data.get('flashcards', [])
        for card in raw_cards:
            front = card.get('front_text') or card.get('front')
            back = card.get('back_text') or card.get('back')
            cursor.execute(
                "INSERT INTO flashcard (set_id, front_text, back_text) VALUES (%s, %s, %s)",
                (set_id, front, back)
            )

        conn.commit()
        return set_id, None

    except mysql.connector.Error as err:
        conn.rollback()
        return None, str(err)
    finally:
        cursor.close()
        conn.close()

# ==========================================
# QUIZ SUBMISSION (Keep existing)
# ==========================================
def submit_quiz_transaction(user_id, quiz_id, answers_dict):
    """
    Grade a quiz attempt and return per-question results so the frontend can
    show the user which questions they got wrong and the correct answer.
    """
    conn = get_db_connection()
    cursor = conn.cursor(dictionary=True)

    try:
        conn.start_transaction()

        cursor.execute(
            "SELECT question_id, question_text, points FROM Question "
            "WHERE quiz_id = %s ORDER BY question_id",
            (quiz_id,),
        )
        questions = cursor.fetchall()

        score = 0
        max_score = 0
        results = []

        for q in questions:
            qid = q["question_id"]
            points = q["points"] or 0
            max_score += points

            cursor.execute(
                "SELECT answer_id, answer_text, is_correct FROM Answer "
                "WHERE question_id = %s ORDER BY answer_id",
                (qid,),
            )
            answers = cursor.fetchall()

            correct_ans = next((a for a in answers if a["is_correct"] == 1), None)
            selected_id = answers_dict.get(qid)
            selected_ans = next(
                (a for a in answers if a["answer_id"] == selected_id), None
            ) if selected_id is not None else None

            is_correct = bool(selected_ans and selected_ans["is_correct"] == 1)
            if is_correct:
                score += points

            results.append({
                "question_id": qid,
                "question_text": q["question_text"],
                "points": points,
                "is_correct": is_correct,
                "selected_answer_id": selected_ans["answer_id"] if selected_ans else None,
                "selected_answer_text": selected_ans["answer_text"] if selected_ans else None,
                "correct_answer_id": correct_ans["answer_id"] if correct_ans else None,
                "correct_answer_text": correct_ans["answer_text"] if correct_ans else None,
            })

        cursor.execute(
            "INSERT INTO UserQuizAttempt (user_id, quiz_id, score, max_score) "
            "VALUES (%s, %s, %s, %s)",
            (user_id, quiz_id, score, max_score),
        )
        attempt_id = cursor.lastrowid

        conn.commit()
        return {
            "attempt_id": attempt_id,
            "score": score,
            "max_score": max_score,
            "results": results,
        }, None

    except mysql.connector.Error as err:
        conn.rollback()
        return None, str(err)
    finally:
        cursor.close()
        conn.close()


def approve_ai_draft_transaction(
    conn,
    draft_set_id: int,
    creator_id: int,
    kind: str = "both",
):
    """
    Approve a drafted AI generation.

    `kind`:
      - "quiz"       → only create the quiz (skip flashcard set)
      - "flashcards" → only create the flashcard set (skip quiz)
      - "both"       → create both (legacy default)
    """
    if kind not in ("quiz", "flashcards", "both"):
        raise ValueError("kind must be one of: quiz, flashcards, both")

    do_cards = kind in ("flashcards", "both")
    do_quiz  = kind in ("quiz", "both")

    cursor = conn.cursor(dictionary=True)

    try:
        conn.start_transaction()

        cursor.execute("""
            SELECT draft_set_id, user_id, course_id, source_text, status
            FROM ai_draft_set
            WHERE draft_set_id = %s
        """, (draft_set_id,))
        draft_set = cursor.fetchone()

        if not draft_set:
            raise ValueError("Draft set not found")

        if draft_set["status"] != "draft":
            raise ValueError("Draft set is not in draft status")

        real_set_id = None
        if do_cards:
            cursor.execute("""
                SELECT draft_flashcard_id, front_text, back_text
                FROM ai_draft_flashcard
                WHERE draft_set_id = %s
                ORDER BY draft_flashcard_id ASC
            """, (draft_set_id,))
            draft_flashcards = cursor.fetchall()

            if draft_flashcards:
                cursor.execute("""
                    INSERT INTO flashcardset (title, description, course_id, creator_id)
                    VALUES (%s, %s, %s, %s)
                """, (
                    "AI Generated Flashcards",
                    "Approved from AI draft set",
                    draft_set["course_id"],
                    creator_id,
                ))
                real_set_id = cursor.lastrowid

                for card in draft_flashcards:
                    cursor.execute("""
                        INSERT INTO flashcard (set_id, front_text, back_text)
                        VALUES (%s, %s, %s)
                    """, (
                        real_set_id,
                        card["front_text"],
                        card["back_text"],
                    ))

        real_quiz_id = None
        if do_quiz:
            cursor.execute("""
                SELECT draft_question_id, question_text, question_type, points
                FROM ai_draft_question
                WHERE draft_set_id = %s
                ORDER BY draft_question_id ASC
            """, (draft_set_id,))
            draft_questions = cursor.fetchall()

            if draft_questions:
                cursor.execute("""
                    INSERT INTO quiz (title, description, course_id, creator_id)
                    VALUES (%s, %s, %s, %s)
                """, (
                    "AI Generated Quiz",
                    "Approved from AI draft set",
                    draft_set["course_id"],
                    creator_id,
                ))
                real_quiz_id = cursor.lastrowid

                for q in draft_questions:
                    cursor.execute("""
                        INSERT INTO question (quiz_id, question_text, question_type, points)
                        VALUES (%s, %s, %s, %s)
                    """, (
                        real_quiz_id,
                        q["question_text"],
                        q["question_type"],
                        q["points"],
                    ))
                    real_question_id = cursor.lastrowid

                    cursor.execute("""
                        SELECT answer_text, is_correct
                        FROM ai_draft_answer
                        WHERE draft_question_id = %s
                        ORDER BY draft_answer_id ASC
                    """, (q["draft_question_id"],))
                    draft_answers = cursor.fetchall()

                    for a in draft_answers:
                        cursor.execute("""
                            INSERT INTO answer (question_id, is_correct, answer_text)
                            VALUES (%s, %s, %s)
                        """, (
                            real_question_id,
                            a["is_correct"],
                            a["answer_text"],
                        ))

        cursor.execute("""
            UPDATE ai_draft_set
            SET status = 'approved'
            WHERE draft_set_id = %s
        """, (draft_set_id,))

        conn.commit()

        return {
            "status": "ok",
            "draft_set_id": draft_set_id,
            "flashcard_set_id": real_set_id,
            "quiz_id": real_quiz_id,
            "kind": kind,
        }

    except Exception:
        conn.rollback()
        raise
    finally:
        cursor.close()

    
def save_ai_draft_transaction(conn, user_id: int, course_id: int, raw_text: str, generated: dict):
    cursor = conn.cursor(dictionary=True)

    try:
        conn.start_transaction()

        cursor.execute("""
            INSERT INTO ai_draft_set (user_id, course_id, source_type, source_text, status)
            VALUES (%s, %s, %s, %s, %s)
        """, (
            user_id,
            course_id,
            "notes",
            raw_text,
            "draft"
        ))
        draft_set_id = cursor.lastrowid

        draft = generated.get("draft") or {}
        fc_block = draft.get("flashcard_set") or {}
        qz_block = draft.get("quiz") or {}

        flashcards = fc_block.get("items") or []
        for card in flashcards:
            cursor.execute("""
                INSERT INTO ai_draft_flashcard (draft_set_id, front_text, back_text)
                VALUES (%s, %s, %s)
            """, (
                draft_set_id,
                card["front"],
                card["back"]
            ))

        questions = qz_block.get("questions") or []
        for q in questions:
            cursor.execute("""
                INSERT INTO ai_draft_question (draft_set_id, question_text, question_type, points)
                VALUES (%s, %s, %s, %s)
            """, (
                draft_set_id,
                q["question_text"],
                q["question_type"],
                q["points"]
            ))
            draft_question_id = cursor.lastrowid

            for a in q["answers"]:
                cursor.execute("""
                    INSERT INTO ai_draft_answer (draft_question_id, answer_text, is_correct)
                    VALUES (%s, %s, %s)
                """, (
                    draft_question_id,
                    a["answer_text"],
                    a["is_correct"]
                ))

        conn.commit()

        return draft_set_id

    except Exception:
        conn.rollback()
        raise
    finally:
        cursor.close()