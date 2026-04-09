import os


def _dedupe_flashcards(items: list[dict]) -> list[dict]:
    seen = set()
    deduped = []

    for item in items:
        front = (item.get("front") or "").strip()
        back = (item.get("back") or "").strip()
        key = (front.lower(), back.lower())

        if not front or not back:
            continue
        if key in seen:
            continue

        seen.add(key)
        deduped.append({
            "front": front,
            "back": back
        })

    return deduped


def _dedupe_questions(questions: list[dict]) -> list[dict]:
    seen = set()
    deduped = []

    for q in questions:
        question_text = (q.get("question_text") or "").strip()
        question_type = (q.get("question_type") or "").strip()
        answers = q.get("answers") or []

        if not question_text or not question_type:
            continue
        if len(answers) < 2:
            continue

        correct_count = sum(1 for a in answers if a.get("is_correct") is True)
        if correct_count != 1:
            continue

        key = question_text.lower()
        if key in seen:
            continue

        cleaned_answers = []
        answer_seen = set()

        for a in answers:
            answer_text = (a.get("answer_text") or "").strip()
            is_correct = bool(a.get("is_correct"))

            if not answer_text:
                continue
            if answer_text.lower() in answer_seen:
                continue

            answer_seen.add(answer_text.lower())
            cleaned_answers.append({
                "answer_text": answer_text,
                "is_correct": is_correct
            })

        if len(cleaned_answers) < 2:
            continue

        correct_count = sum(1 for a in cleaned_answers if a["is_correct"] is True)
        if correct_count != 1:
            continue

        seen.add(key)
        deduped.append({
            "question_text": question_text,
            "question_type": question_type,
            "points": q.get("points", 1),
            "answers": cleaned_answers
        })

    return deduped


def _build_mock_output(course_id: int) -> dict:
    flashcard_items = [
        {
            "front": "What does binary search require?",
            "back": "A sorted array."
        },
        {
            "front": "What is the time complexity of binary search?",
            "back": "O(log n)"
        },
        {
            "front": "What is the time complexity of binary search?",
            "back": "O(log n)"
        }
    ]

    quiz_questions = [
        {
            "question_text": "What is required before using binary search?",
            "question_type": "multiple_choice",
            "points": 1,
            "answers": [
                {"answer_text": "A sorted array", "is_correct": True},
                {"answer_text": "A linked list", "is_correct": False},
                {"answer_text": "A stack", "is_correct": False},
                {"answer_text": "An unsorted array", "is_correct": False}
            ]
        },
        {
            "question_text": "What is the time complexity of binary search?",
            "question_type": "multiple_choice",
            "points": 1,
            "answers": [
                {"answer_text": "O(log n)", "is_correct": True},
                {"answer_text": "O(n)", "is_correct": False},
                {"answer_text": "O(n log n)", "is_correct": False},
                {"answer_text": "O(1)", "is_correct": False}
            ]
        },
        {
            "question_text": "What is the time complexity of binary search?",
            "question_type": "multiple_choice",
            "points": 1,
            "answers": [
                {"answer_text": "O(log n)", "is_correct": True},
                {"answer_text": "O(n)", "is_correct": False}
            ]
        }
    ]

    flashcard_items = _dedupe_flashcards(flashcard_items)[:10]
    quiz_questions = _dedupe_questions(quiz_questions)[:10]

    return {
        "status": "ok",
        "source": "mock",
        "course_id": course_id,
        "draft": {
            "flashcard_set": {
                "title": "Generated from Notes",
                "description": "Draft flashcards generated from uploaded notes.",
                "items": flashcard_items
            },
            "quiz": {
                "title": "Generated Quiz",
                "description": "Draft quiz generated from uploaded notes.",
                "questions": quiz_questions
            }
        },
        "meta": {
            "flashcard_count": len(flashcard_items),
            "question_count": len(quiz_questions),
            "truncated": False
        }
    }


def _build_openai_output(course_id: int, raw_text: str, user_id: int | None = None) -> dict:
    """
    Placeholder for future OpenAI integration.

    Intended future behavior:
    - Read OPENAI_API_KEY from environment
    - Send cleaned note text to model
    - Request structured JSON output
    - Normalize into the same response contract used by the mock path
    - Apply validation/dedupe/caps before returning
    """
    raise NotImplementedError("OpenAI generation is not wired yet")


def generate_study_drafts(course_id: int, raw_text: str, user_id: int | None = None) -> dict:
    cleaned_text = (raw_text or "").strip()
    if not cleaned_text:
        raise ValueError("raw_text is required")

    max_input_chars = 5000
    truncated = len(cleaned_text) > max_input_chars
    cleaned_text = cleaned_text[:max_input_chars]

    use_openai = os.getenv("OPENAI_API_KEY") is not None and os.getenv("AI_GENERATE_PROVIDER") == "openai"

    if use_openai:
        result = _build_openai_output(
            course_id=course_id,
            raw_text=cleaned_text,
            user_id=user_id
        )
    else:
        result = _build_mock_output(course_id=course_id)

    result["meta"]["truncated"] = truncated
    return result