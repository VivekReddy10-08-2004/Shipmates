from fastapi import APIRouter, HTTPException, status, Body, Query
from pydantic import BaseModel
from typing import Optional, List
from db import get_db_connection
from utils.transactions import create_flashcard_set_transaction

router = APIRouter()


# ---- Pydantic models ----

class FlashcardInput(BaseModel):
    front: Optional[str] = None
    back: Optional[str] = None
    front_text: Optional[str] = None
    back_text: Optional[str] = None

class CreateFlashcardSetRequest(BaseModel):
    title: str
    description: Optional[str] = None
    course_id: int
    creator_id: int
    flashcards: List[FlashcardInput] = []
    cards: Optional[List[FlashcardInput]] = None

class UpdateSetRequest(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None

class UpdateCardRequest(BaseModel):
    front_text: Optional[str] = None
    back_text: Optional[str] = None


@router.post("/create", status_code=status.HTTP_201_CREATED, response_model=dict)
def create_set(payload: CreateFlashcardSetRequest):
    """Create a new flashcard set with cards via transaction."""
    if not payload.title.strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Title is required",
        )

    # Normalize: accept either 'flashcards' or 'cards' key
    raw_cards = payload.cards if payload.cards is not None else payload.flashcards

    data = {
        "title": payload.title.strip(),
        "description": payload.description,
        "course_id": payload.course_id,
        "creator_id": payload.creator_id,
        "flashcards": [
            {
                "front": c.front or c.front_text or "",
                "back": c.back or c.back_text or "",
            }
            for c in raw_cards
        ],
    }

    set_id, error = create_flashcard_set_transaction(data)

    if error:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=error,
        )

    return {"message": "Flashcard set created", "set_id": set_id}


@router.get("/sets", response_model=dict)
def list_flashcard_sets(
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
                "SELECT COUNT(*) AS total FROM flashcardset WHERE creator_id = %s",
                (creator_id,),
            )
            total = cursor.fetchone()["total"]
            cursor.execute(
                """
                SELECT set_id, title, description, course_id, creator_id, created_at
                FROM flashcardset
                WHERE creator_id = %s
                ORDER BY set_id DESC
                LIMIT %s OFFSET %s
                """,
                (creator_id, limit, offset),
            )
        else:
            cursor.execute("SELECT COUNT(*) AS total FROM flashcardset")
            total = cursor.fetchone()["total"]
            cursor.execute(
                """
                SELECT set_id, title, description, course_id, creator_id, created_at
                FROM flashcardset
                ORDER BY set_id DESC
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


@router.get("/{set_id}", response_model=dict)
def get_flashcard_set(set_id: int):
    """Get a flashcard set with all cards."""
    conn = get_db_connection()
    if not conn:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Database connection failed",
        )

    cursor = conn.cursor(dictionary=True)
    try:
        cursor.execute("SELECT * FROM flashcardset WHERE set_id = %s", (set_id,))
        flashcard_set = cursor.fetchone()

        if not flashcard_set:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Set not found",
            )

        cursor.execute("SELECT * FROM flashcard WHERE set_id = %s", (set_id,))
        cards = cursor.fetchall()

        flashcard_set["cards"] = cards
        return flashcard_set

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


@router.put("/{set_id}", response_model=dict)
def update_flashcard_set(set_id: int, payload: UpdateSetRequest):
    """Update title/description of a flashcard set."""
    conn = get_db_connection()
    if not conn:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Database connection failed",
        )

    cursor = conn.cursor(dictionary=True)
    try:
        cursor.execute("SELECT set_id FROM flashcardset WHERE set_id = %s", (set_id,))
        if not cursor.fetchone():
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Set not found",
            )

        updates = {}
        if payload.title is not None:
            updates["title"] = payload.title
        if payload.description is not None:
            updates["description"] = payload.description

        if not updates:
            return {"message": "Nothing to update"}

        set_clause = ", ".join([f"{k} = %s" for k in updates.keys()])
        values = list(updates.values()) + [set_id]
        cursor.execute(
            f"UPDATE flashcardset SET {set_clause} WHERE set_id = %s",
            values,
        )

        return {"message": "Set updated"}

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


@router.delete("/{set_id}", response_model=dict)
def delete_flashcard_set(set_id: int):
    """Delete a flashcard set and all its cards."""
    conn = get_db_connection()
    if not conn:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Database connection failed",
        )

    cursor = conn.cursor(dictionary=True)
    try:
        cursor.execute("SELECT set_id FROM flashcardset WHERE set_id = %s", (set_id,))
        if not cursor.fetchone():
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Set not found",
            )

        cursor.execute("DELETE FROM flashcard WHERE set_id = %s", (set_id,))
        cursor.execute("DELETE FROM flashcardset WHERE set_id = %s", (set_id,))

        return {"message": "Set deleted"}

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


@router.put("/card/{card_id}", response_model=dict)
def update_flashcard(card_id: int, payload: UpdateCardRequest):
    """Update a single flashcard."""
    conn = get_db_connection()
    if not conn:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Database connection failed",
        )

    cursor = conn.cursor(dictionary=True)
    try:
        cursor.execute(
            "SELECT flashcard_id FROM flashcard WHERE flashcard_id = %s", (card_id,)
        )
        if not cursor.fetchone():
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Card not found",
            )

        updates = {}
        if payload.front_text is not None:
            updates["front_text"] = payload.front_text
        if payload.back_text is not None:
            updates["back_text"] = payload.back_text

        if not updates:
            return {"message": "Nothing to update"}

        set_clause = ", ".join([f"{k} = %s" for k in updates.keys()])
        values = list(updates.values()) + [card_id]
        cursor.execute(
            f"UPDATE flashcard SET {set_clause} WHERE flashcard_id = %s",
            values,
        )

        return {"message": "Card updated"}

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


@router.delete("/card/{card_id}", response_model=dict)
def delete_flashcard(card_id: int):
    """Delete a single flashcard."""
    conn = get_db_connection()
    if not conn:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Database connection failed",
        )

    cursor = conn.cursor(dictionary=True)
    try:
        cursor.execute(
            "SELECT flashcard_id FROM flashcard WHERE flashcard_id = %s", (card_id,)
        )
        if not cursor.fetchone():
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Card not found",
            )

        cursor.execute("DELETE FROM flashcard WHERE flashcard_id = %s", (card_id,))
        return {"message": "Card deleted"}

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
