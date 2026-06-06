import json

from fastapi import APIRouter, HTTPException, Request, UploadFile
from pydantic import BaseModel
from services.ai_generate import (
    AIGenerateError,
    extract_text_from_pdf_bytes,
    generate_study_drafts,
)
from db import get_db_connection
from utils.transactions import approve_ai_draft_transaction
from utils.transactions import save_ai_draft_transaction

router = APIRouter(prefix="/generate", tags=["generate"])


class GenerateFromNotesRequest(BaseModel):
    user_id: int
    course_id: int | None = None
    raw_text: str
    kind: str = "both"   # "quiz" | "flashcards" | "both"

class ApproveDraftRequest(BaseModel):
    draft_set_id: int
    creator_id: int
    kind: str = "both"   # "quiz" | "flashcards" | "both"


def _combine_notes(raw_text: str, pdf_text: str | None) -> str:
    parts = [part.strip() for part in [raw_text or "", pdf_text or ""] if part and part.strip()]
    return "\n\n".join(parts).strip()


@router.post("/from-notes")
async def generate_from_notes(request: Request):
    try:
        content_type = request.headers.get("content-type", "")

        if "multipart/form-data" in content_type:
            form = await request.form()
            user_id_raw = form.get("user_id")
            course_id_raw = form.get("course_id")
            kind = str(form.get("kind") or "both")
            raw_text = str(form.get("raw_text") or "")
            pdf_file = form.get("pdf_file")

            if user_id_raw is None:
                raise HTTPException(status_code=400, detail="user_id is required")

            try:
                user_id = int(user_id_raw)
            except (TypeError, ValueError):
                raise HTTPException(status_code=400, detail="user_id must be an integer")

            course_id = None
            if str(course_id_raw or "").strip() != "":
                try:
                    course_id = int(course_id_raw)
                except (TypeError, ValueError):
                    raise HTTPException(status_code=400, detail="course_id must be an integer when provided")

            pdf_text = ""
            if hasattr(pdf_file, "filename") and getattr(pdf_file, "filename", ""):
                if not pdf_file.filename.lower().endswith(".pdf"):
                    raise HTTPException(status_code=400, detail="Only PDF files are supported")

                pdf_bytes = await pdf_file.read()
                if len(pdf_bytes) > 15 * 1024 * 1024:
                    raise HTTPException(status_code=413, detail="PDF file is too large")

                pdf_text = extract_text_from_pdf_bytes(pdf_bytes)

            merged_text = _combine_notes(raw_text, pdf_text)
            if not merged_text:
                raise HTTPException(status_code=400, detail="Provide notes text or a PDF file")

            payload = GenerateFromNotesRequest(
                user_id=user_id,
                course_id=course_id,
                raw_text=merged_text,
                kind=kind,
            )
        else:
            body = await request.body()
            if not body:
                raise HTTPException(status_code=400, detail="Request body is required")

            payload_data = json.loads(body)
            payload = GenerateFromNotesRequest(**payload_data)

        generated = generate_study_drafts(
            course_id=payload.course_id,
            raw_text=payload.raw_text,
            user_id=payload.user_id,
            kind=payload.kind,
        )

        conn = get_db_connection()
        try:
            draft_set_id = None
            if payload.course_id is not None:
                draft_set_id = save_ai_draft_transaction(
                    conn=conn,
                    user_id=payload.user_id,
                    course_id=payload.course_id,
                    raw_text=payload.raw_text,
                    generated=generated
                )
        finally:
            conn.close()

        generated["draft_set_id"] = draft_set_id
        return generated

    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except AIGenerateError as e:
        # 502 = upstream dependency failed (OpenAI unreachable / misconfigured)
        raise HTTPException(status_code=502, detail=f"AI generation failed: {e}")


@router.post("/approve")
def approve_generated_draft(payload: ApproveDraftRequest):
    conn = get_db_connection()
    try:
        return approve_ai_draft_transaction(
            conn=conn,
            draft_set_id=payload.draft_set_id,
            creator_id=payload.creator_id,
            kind=payload.kind,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    finally:
        conn.close()