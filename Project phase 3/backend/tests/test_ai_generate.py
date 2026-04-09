from services.ai_generate import generate_study_drafts


def test_generate_study_drafts_success():
    result = generate_study_drafts(
        course_id=1,
        raw_text="Binary search works on sorted arrays."
    )

    assert result["status"] == "ok"
    assert result["source"] == "mock"
    assert result["course_id"] == 1

    assert "draft" in result
    assert "flashcard_set" in result["draft"]
    assert "quiz" in result["draft"]

    assert len(result["draft"]["flashcard_set"]["items"]) > 0
    assert len(result["draft"]["quiz"]["questions"]) > 0

    assert result["meta"]["flashcard_count"] == len(result["draft"]["flashcard_set"]["items"])
    assert result["meta"]["question_count"] == len(result["draft"]["quiz"]["questions"])


def test_generate_study_drafts_rejects_empty_text():
    try:
        generate_study_drafts(course_id=1, raw_text="   ")
        assert False, "Expected ValueError for empty raw_text"
    except ValueError as e:
        assert str(e) == "raw_text is required"


def test_generate_study_drafts_dedupes_items():
    result = generate_study_drafts(
        course_id=1,
        raw_text="Binary search works on sorted arrays."
    )

    flashcards = result["draft"]["flashcard_set"]["items"]
    questions = result["draft"]["quiz"]["questions"]

    assert len(flashcards) == 2
    assert len(questions) == 2


def test_generate_study_drafts_caps_input_and_sets_truncated():
    long_text = "a" * 6000

    result = generate_study_drafts(
        course_id=1,
        raw_text=long_text
    )

    assert result["meta"]["truncated"] is True