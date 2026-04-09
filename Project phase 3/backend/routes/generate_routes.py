from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from services.ai_generate import generate_study_drafts
from db import get_db_connection
from utils.transactions import approve_ai_draft_transaction
from utils.transactions import save_ai_draft_transaction

router = APIRouter(prefix="/generate", tags=["generate"])


class GenerateFromNotesRequest(BaseModel):
    user_id: int
    course_id: int
    raw_text: str

class ApproveDraftRequest(BaseModel):
    draft_set_id: int
    creator_id: int


@router.post("/from-notes")
def generate_from_notes(payload: GenerateFromNotesRequest):
    try:
        generated = generate_study_drafts(
            course_id=payload.course_id,
            raw_text=payload.raw_text,
            user_id=payload.user_id
        )

        conn = get_db_connection()
        try:
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
    
    
@router.post("/approve")
def approve_generated_draft(payload: ApproveDraftRequest):
    conn = get_db_connection()
    try:
        return approve_ai_draft_transaction(
            conn=conn,
            draft_set_id=payload.draft_set_id,
            creator_id=payload.creator_id
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    finally:
        conn.close()