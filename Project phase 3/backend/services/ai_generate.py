"""
AI Generate Service
-------------------
Accepts note text + course_id and returns structured flashcard + quiz drafts.

Current mode: keyword-extraction parser (no API key needed).
Future mode:  set AI_GENERATE_PROVIDER=openai and OPENAI_API_KEY in env to
              use OpenAI for higher-quality generation.
"""

import os
import re


# ── helpers ──────────────────────────────────────────────────────────────

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
        deduped.append({"front": front, "back": back})

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


# ── sentence / keyword extraction ────────────────────────────────────────

def _extract_sentences(text: str) -> list[str]:
    """Split text into meaningful sentences, filtering out very short ones."""
    # Split on sentence-ending punctuation or newlines
    raw = re.split(r'(?<=[.!?])\s+|\n+', text)
    sentences = []
    for s in raw:
        s = s.strip()
        # Keep sentences that are at least 8 words long
        if len(s.split()) >= 4 and len(s) > 15:
            sentences.append(s)
    return sentences


def _extract_definitions(text: str) -> list[tuple[str, str]]:
    """
    Look for patterns like:
      - "X is Y"
      - "X refers to Y"
      - "X means Y"
      - "X: Y"
      - "X – Y" / "X - Y"
    Returns list of (term, definition) tuples.
    """
    pairs = []

    # Pattern: "Term is/are/refers to/means definition"
    pattern = re.compile(
        r'(?:^|\.\s+)([A-Z][^.]{2,40}?)\s+'
        r'(?:is|are|refers?\s+to|means?|describes?)\s+'
        r'(.{10,150}?)(?:\.|$)',
        re.MULTILINE
    )
    for m in pattern.finditer(text):
        term = m.group(1).strip()
        defn = m.group(2).strip()
        if term and defn:
            pairs.append((term, defn))

    # Pattern: "Term: definition" or "Term - definition"
    colon_pattern = re.compile(
        r'(?:^|\n)\s*([A-Za-z][^:\n]{2,50})[:–—-]\s+(.{10,200})',
        re.MULTILINE
    )
    for m in colon_pattern.finditer(text):
        term = m.group(1).strip().rstrip('-–—')
        defn = m.group(2).strip()
        if term and defn and len(term.split()) <= 6:
            pairs.append((term, defn))

    return pairs


def _build_parsed_output(course_id: int, raw_text: str) -> dict:
    """
    Parse user notes into flashcards and quiz questions dynamically.
    No hardcoded content - everything comes from the actual notes.
    """
    flashcard_items = []
    quiz_questions = []

    # 1. Extract definition-style pairs for flashcards
    definitions = _extract_definitions(raw_text)
    for term, defn in definitions:
        flashcard_items.append({"front": f"What is {term}?", "back": defn})

    # 2. Extract key sentences and turn them into flashcards + quiz questions
    sentences = _extract_sentences(raw_text)

    for sentence in sentences:
        # Skip if we already have a definition-based card for this
        if any(sentence.lower() in f["back"].lower() for f in flashcard_items):
            continue

        words = sentence.split()

        # Create a flashcard: use first part as context, rest as answer
        if len(words) >= 6:
            # Find a good split point (roughly halfway)
            mid = len(words) // 2
            front_part = " ".join(words[:mid])
            back_part = " ".join(words[mid:])
            flashcard_items.append({
                "front": f"Complete: {front_part}...",
                "back": back_part
            })

        # Create a quiz question from the sentence
        if len(words) >= 5:
            # Pick a key term to blank out (longest non-trivial word)
            skip_words = {
                "the", "a", "an", "is", "are", "was", "were", "be", "been",
                "being", "have", "has", "had", "do", "does", "did", "will",
                "would", "could", "should", "may", "might", "shall", "can",
                "to", "of", "in", "for", "on", "with", "at", "by", "from",
                "as", "into", "through", "during", "before", "after", "and",
                "but", "or", "nor", "not", "so", "yet", "both", "either",
                "neither", "each", "every", "all", "any", "few", "more",
                "most", "other", "some", "such", "no", "only", "own",
                "same", "than", "too", "very", "that", "this", "these",
                "those", "it", "its", "they", "them", "their", "we", "us",
                "our", "you", "your", "he", "him", "his", "she", "her",
            }

            candidates = [
                w for w in words
                if w.lower().strip(".,!?;:") not in skip_words
                and len(w) > 3
            ]

            if candidates:
                # Pick the longest candidate as the key term
                key_term = max(candidates, key=len).strip(".,!?;:")
                question_text = sentence.replace(key_term, "______", 1)

                # Build wrong answers from other candidates
                wrong_answers = [
                    c.strip(".,!?;:") for c in candidates
                    if c.strip(".,!?;:").lower() != key_term.lower()
                ][:3]

                # If we don't have enough wrong answers, add generic ones
                fillers = ["None of the above", "All of the above", "Not applicable"]
                while len(wrong_answers) < 3:
                    filler = fillers[len(wrong_answers) % len(fillers)]
                    if filler not in wrong_answers:
                        wrong_answers.append(filler)

                answers = [{"answer_text": key_term, "is_correct": True}]
                for wa in wrong_answers[:3]:
                    answers.append({"answer_text": wa, "is_correct": False})

                quiz_questions.append({
                    "question_text": question_text,
                    "question_type": "multiple_choice",
                    "points": 1,
                    "answers": answers
                })

    # If notes were too short or unstructured, provide feedback
    if not flashcard_items and not quiz_questions:
        # Fallback: split the text into chunks and make simple cards
        chunks = [s.strip() for s in raw_text.split('.') if len(s.strip()) > 10]
        for i, chunk in enumerate(chunks[:5]):
            flashcard_items.append({
                "front": f"Key point {i + 1}: Explain this concept",
                "back": chunk.strip()
            })
            if len(chunk.split()) >= 4:
                quiz_questions.append({
                    "question_text": f"Which of the following is a key concept from your notes?",
                    "question_type": "multiple_choice",
                    "points": 1,
                    "answers": [
                        {"answer_text": chunk.strip()[:80], "is_correct": True},
                        {"answer_text": "This was not in the notes", "is_correct": False},
                        {"answer_text": "None of the above", "is_correct": False},
                        {"answer_text": "All of the above", "is_correct": False},
                    ]
                })

    # Apply dedup and cap
    flashcard_items = _dedupe_flashcards(flashcard_items)[:10]
    quiz_questions = _dedupe_questions(quiz_questions)[:10]

    return {
        "status": "ok",
        "source": "parsed",
        "course_id": course_id,
        "draft": {
            "flashcard_set": {
                "title": "Generated from Notes",
                "description": "Draft flashcards generated from your uploaded notes.",
                "items": flashcard_items
            },
            "quiz": {
                "title": "Generated Quiz",
                "description": "Draft quiz generated from your uploaded notes.",
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
    Call OpenAI gpt-4o-mini to generate flashcards + quiz questions from note text.
    Returns a dict matching the same contract as _build_parsed_output.
    On any failure (API error, timeout, bad JSON, schema mismatch) falls back
    to _build_parsed_output and marks source='parsed_fallback'.
    """
    import json as _json
    try:
        import openai as _openai
    except ImportError:
        return _build_parsed_output(course_id=course_id, raw_text=raw_text)

    SYSTEM_PROMPT = (
        "You are a study-material generator. "
        "Given student notes, produce exactly 10 flashcards and exactly 10 "
        "multiple-choice quiz questions. "
        "Return ONLY a JSON object with this exact schema:\n\n"
        "{\n"
        '  "flashcard_set": {\n'
        '    "title": "<short title based on the notes>",\n'
        '    "description": "<one sentence description>",\n'
        '    "items": [{"front": "<question or prompt>", "back": "<answer or explanation>"}]\n'
        "  },\n"
        '  "quiz": {\n'
        '    "title": "<short quiz title>",\n'
        '    "description": "<one sentence description>",\n'
        '    "questions": [{\n'
        '      "question_text": "<question>",\n'
        '      "question_type": "multiple_choice",\n'
        '      "points": 1,\n'
        '      "answers": [\n'
        '        {"answer_text": "<correct option>", "is_correct": true},\n'
        '        {"answer_text": "<wrong option>", "is_correct": false},\n'
        '        {"answer_text": "<wrong option>", "is_correct": false},\n'
        '        {"answer_text": "<wrong option>", "is_correct": false}\n'
        "      ]\n"
        "    }]\n"
        "  }\n"
        "}\n\n"
        "Rules:\n"
        "- items array must have exactly 10 objects\n"
        "- questions array must have exactly 10 objects\n"
        "- every question must have exactly 4 answers, exactly 1 with is_correct=true\n"
        "- base all content strictly on the provided notes, do not invent facts\n"
        "- no markdown, no LaTeX, no code blocks inside strings"
    )

    try:
        client = _openai.OpenAI(api_key=os.getenv("OPENAI_API_KEY"), timeout=30.0)
        response = client.chat.completions.create(
            model="gpt-4o-mini",
            response_format={"type": "json_object"},
            max_tokens=2000,
            messages=[
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user",   "content": raw_text},
            ],
        )
        data = _json.loads(response.choices[0].message.content)
    except Exception:
        result = _build_parsed_output(course_id=course_id, raw_text=raw_text)
        result["source"] = "parsed_fallback"
        return result

    try:
        fc_block = data.get("flashcard_set") or data.get("flashcards") or {}
        qz_block = data.get("quiz") or data.get("quiz_set") or {}

        flashcard_items = []
        for item in (fc_block.get("items") or fc_block.get("cards") or []):
            front = str(item.get("front") or item.get("question") or "").strip()
            back  = str(item.get("back")  or item.get("answer")  or "").strip()
            if front and back:
                flashcard_items.append({"front": front, "back": back})

        quiz_questions = []
        for q in (qz_block.get("questions") or []):
            qtext = str(q.get("question_text") or q.get("question") or "").strip()
            answers = []
            for a in (q.get("answers") or q.get("options") or []):
                atext = str(a.get("answer_text") or a.get("text") or "").strip()
                raw_c = a.get("is_correct") or a.get("correct")
                is_correct = raw_c is True or str(raw_c).lower() == "true"
                if atext:
                    answers.append({"answer_text": atext, "is_correct": is_correct})
            if qtext and answers:
                quiz_questions.append({
                    "question_text": qtext,
                    "question_type": str(q.get("question_type") or "multiple_choice"),
                    "points": int(q.get("points") or 1),
                    "answers": answers,
                })

        flashcard_items = _dedupe_flashcards(flashcard_items)[:10]
        quiz_questions  = _dedupe_questions(quiz_questions)[:10]

        return {
            "status": "ok",
            "source": "openai",
            "course_id": course_id,
            "draft": {
                "flashcard_set": {
                    "title":       str(fc_block.get("title") or "Generated from Notes"),
                    "description": str(fc_block.get("description") or "AI-generated flashcards."),
                    "items":       flashcard_items,
                },
                "quiz": {
                    "title":       str(qz_block.get("title") or "Generated Quiz"),
                    "description": str(qz_block.get("description") or "AI-generated quiz."),
                    "questions":   quiz_questions,
                },
            },
            "meta": {
                "flashcard_count": len(flashcard_items),
                "question_count":  len(quiz_questions),
                "truncated":       False,
            },
        }
    except Exception:
        result = _build_parsed_output(course_id=course_id, raw_text=raw_text)
        result["source"] = "parsed_fallback"
        return result


def generate_study_drafts(course_id: int, raw_text: str, user_id: int | None = None) -> dict:
    cleaned_text = (raw_text or "").strip()
    if not cleaned_text:
        raise ValueError("raw_text is required")

    max_input_chars = 5000
    truncated = len(cleaned_text) > max_input_chars
    cleaned_text = cleaned_text[:max_input_chars]

    use_openai = (
        os.getenv("OPENAI_API_KEY") is not None
        and os.getenv("AI_GENERATE_PROVIDER") == "openai"
    )

    if use_openai:
        result = _build_openai_output(
            course_id=course_id,
            raw_text=cleaned_text,
            user_id=user_id
        )
    else:
        result = _build_parsed_output(
            course_id=course_id,
            raw_text=cleaned_text
        )

    result["meta"]["truncated"] = truncated
    return result
