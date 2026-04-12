"""
Tests for AI generate service.
All tests check response *structure* and contracts, not hardcoded content.
"""
import json
import sys
from types import SimpleNamespace
from unittest.mock import MagicMock, patch

from services.ai_generate import generate_study_drafts


SAMPLE_NOTES = """
Binary search is an efficient algorithm for finding a target value in a sorted array.
It works by repeatedly dividing the search interval in half.
The time complexity of binary search is O(log n).
A sorted array is required before using binary search.
Linear search has a time complexity of O(n) and does not require sorting.
Hash tables provide O(1) average lookup time using a hash function.
"""


def test_generate_returns_correct_structure():
    """Response must have status, source, course_id, draft, and meta keys."""
    result = generate_study_drafts(course_id=42, raw_text=SAMPLE_NOTES)

    assert result["status"] == "ok"
    assert "source" in result
    assert result["course_id"] == 42

    assert "draft" in result
    assert "flashcard_set" in result["draft"]
    assert "quiz" in result["draft"]
    assert "meta" in result


def test_generate_produces_flashcards_from_notes():
    """Flashcards should be generated from actual note content, not empty."""
    result = generate_study_drafts(course_id=1, raw_text=SAMPLE_NOTES)

    flashcards = result["draft"]["flashcard_set"]["items"]
    assert isinstance(flashcards, list)
    assert len(flashcards) > 0

    # Each flashcard has front and back
    for card in flashcards:
        assert "front" in card and len(card["front"]) > 0
        assert "back" in card and len(card["back"]) > 0

    # Meta count matches actual count
    assert result["meta"]["flashcard_count"] == len(flashcards)


def test_generate_produces_quiz_questions_from_notes():
    """Quiz questions should be generated from actual note content."""
    result = generate_study_drafts(course_id=1, raw_text=SAMPLE_NOTES)

    questions = result["draft"]["quiz"]["questions"]
    assert isinstance(questions, list)
    assert len(questions) > 0

    for q in questions:
        assert "question_text" in q and len(q["question_text"]) > 0
        assert "question_type" in q
        assert "points" in q
        assert "answers" in q and len(q["answers"]) >= 2

        # Exactly one correct answer per question
        correct = [a for a in q["answers"] if a["is_correct"] is True]
        assert len(correct) == 1

    assert result["meta"]["question_count"] == len(questions)


def test_generate_rejects_empty_text():
    """Empty or whitespace-only input should raise ValueError."""
    try:
        generate_study_drafts(course_id=1, raw_text="   ")
        assert False, "Expected ValueError for empty raw_text"
    except ValueError as e:
        assert str(e) == "raw_text is required"


def test_generate_caps_input_and_sets_truncated():
    """Input longer than 5000 chars should be truncated."""
    long_text = "This is a sentence about algorithms. " * 500

    result = generate_study_drafts(course_id=1, raw_text=long_text)

    assert result["meta"]["truncated"] is True
    assert result["status"] == "ok"


def test_generate_no_duplicates():
    """Flashcards and questions should be deduplicated."""
    # Notes with repetitive content
    notes = """
    Binary search requires a sorted array.
    Binary search requires a sorted array.
    Binary search requires a sorted array.
    The time complexity is O(log n).
    """
    result = generate_study_drafts(course_id=1, raw_text=notes)

    flashcards = result["draft"]["flashcard_set"]["items"]
    quiz_questions = result["draft"]["quiz"]["questions"]

    # Check no duplicate fronts in flashcards
    fronts = [c["front"].lower() for c in flashcards]
    assert len(fronts) == len(set(fronts)), "Duplicate flashcard fronts found"

    # Check no duplicate question texts
    qtexts = [q["question_text"].lower() for q in quiz_questions]
    assert len(qtexts) == len(set(qtexts)), "Duplicate questions found"


def test_generate_respects_max_items():
    """Output should never exceed 10 flashcards or 10 questions."""
    # Lots of varied content
    lines = [f"Concept {i} is a fundamental principle in computer science topic {i}." for i in range(30)]
    notes = "\n".join(lines)

    result = generate_study_drafts(course_id=1, raw_text=notes)

    assert len(result["draft"]["flashcard_set"]["items"]) <= 10
    assert len(result["draft"]["quiz"]["questions"]) <= 10


def test_different_notes_produce_different_output():
    """Different input notes should produce different flashcards."""
    result_a = generate_study_drafts(
        course_id=1,
        raw_text="Photosynthesis converts sunlight into chemical energy in plants."
    )
    result_b = generate_study_drafts(
        course_id=1,
        raw_text="The French Revolution began in 1789 and transformed European politics."
    )

    cards_a = result_a["draft"]["flashcard_set"]["items"]
    cards_b = result_b["draft"]["flashcard_set"]["items"]

    # At least one card should be different
    if cards_a and cards_b:
        a_backs = {c["back"].lower() for c in cards_a}
        b_backs = {c["back"].lower() for c in cards_b}
        assert a_backs != b_backs, "Different notes produced identical output"


# ── OpenAI path tests (all use mocks — no real API calls) ─────────────────

SAMPLE_NOTES_OAI = (
    "Binary search is an efficient algorithm for finding a target value in a "
    "sorted array. It works by repeatedly dividing the search interval in half. "
    "The time complexity of binary search is O(log n). A sorted array is "
    "required. Linear search has O(n) complexity."
)


def _make_valid_openai_json() -> str:
    flashcards = [{"front": f"Question {i}", "back": f"Answer {i}"} for i in range(1, 11)]
    questions = [
        {
            "question_text": f"What is concept {i}?",
            "question_type": "multiple_choice",
            "points": 1,
            "answers": [
                {"answer_text": f"Correct {i}", "is_correct": True},
                {"answer_text": "Wrong A", "is_correct": False},
                {"answer_text": "Wrong B", "is_correct": False},
                {"answer_text": "Wrong C", "is_correct": False},
            ],
        }
        for i in range(1, 11)
    ]
    return json.dumps({
        "flashcard_set": {"title": "Test Flashcards", "description": "For testing.", "items": flashcards},
        "quiz": {"title": "Test Quiz", "description": "For testing.", "questions": questions},
    })


def _make_mock_openai(response_content: str) -> MagicMock:
    mock_message  = SimpleNamespace(content=response_content)
    mock_choice   = SimpleNamespace(message=mock_message)
    mock_response = SimpleNamespace(choices=[mock_choice])
    mock_client   = MagicMock()
    mock_client.chat.completions.create.return_value = mock_response
    mock_openai   = MagicMock()
    mock_openai.OpenAI.return_value = mock_client
    return mock_openai


def test_openai_path_valid_response(monkeypatch):
    """When OpenAI returns well-formed JSON, source must be 'openai' and contract intact."""
    monkeypatch.setenv("OPENAI_API_KEY", "sk-fake-key")
    monkeypatch.setenv("AI_GENERATE_PROVIDER", "openai")

    with patch.dict(sys.modules, {"openai": _make_mock_openai(_make_valid_openai_json())}):
        result = generate_study_drafts(course_id=99, raw_text=SAMPLE_NOTES_OAI)

    assert result["status"]    == "ok"
    assert result["source"]    == "openai"
    assert result["course_id"] == 99

    flashcards = result["draft"]["flashcard_set"]["items"]
    questions  = result["draft"]["quiz"]["questions"]
    assert len(flashcards) == 10
    assert len(questions)  == 10

    for card in flashcards:
        assert card["front"] and card["back"]

    for q in questions:
        assert q["question_text"]
        assert q["question_type"] == "multiple_choice"
        correct = [a for a in q["answers"] if a["is_correct"] is True]
        assert len(correct) == 1

    assert result["meta"]["flashcard_count"] == 10
    assert result["meta"]["question_count"]  == 10


def test_openai_path_malformed_json_falls_back(monkeypatch):
    """When OpenAI returns invalid JSON, service must fall back to parsed and not raise."""
    monkeypatch.setenv("OPENAI_API_KEY", "sk-fake-key")
    monkeypatch.setenv("AI_GENERATE_PROVIDER", "openai")

    with patch.dict(sys.modules, {"openai": _make_mock_openai("this is not json {{{{")}):
        result = generate_study_drafts(course_id=7, raw_text=SAMPLE_NOTES_OAI)

    assert result["status"]    == "ok"
    assert result["source"]    == "parsed_fallback"
    assert result["course_id"] == 7
    assert "draft" in result
    assert "flashcard_set" in result["draft"]
    assert "quiz"          in result["draft"]
    assert "meta"          in result


def test_openai_path_timeout_falls_back(monkeypatch):
    """When the OpenAI client raises (e.g. timeout), service must fall back and not raise."""
    monkeypatch.setenv("OPENAI_API_KEY", "sk-fake-key")
    monkeypatch.setenv("AI_GENERATE_PROVIDER", "openai")

    mock_client = MagicMock()
    mock_client.chat.completions.create.side_effect = Exception("Connection timed out")
    mock_openai = MagicMock()
    mock_openai.OpenAI.return_value = mock_client

    with patch.dict(sys.modules, {"openai": mock_openai}):
        result = generate_study_drafts(course_id=5, raw_text=SAMPLE_NOTES_OAI)

    assert result["status"]    == "ok"
    assert result["source"]    == "parsed_fallback"
    assert result["course_id"] == 5
    assert "draft" in result
    assert "meta"  in result
