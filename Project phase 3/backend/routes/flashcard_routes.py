from fastapi import APIRouter, HTTPException, status, Query
from db import get_db_connection
from utils.transactions import create_flashcard_set_transaction

router = APIRouter()


# ============= CREATE FLASHCARD SET (ACID) =============
@router.post("/create", status_code=status.HTTP_201_CREATED, response_model=dict)
def create_set(
    title: str = Query(...),
    description: str = Query(None),
    course_id: int = Query(...),
    creator_id: int = Query(...),
):
    """Create a new flashcard set via transaction."""
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
        "flashcards": [],  # Would come from request body in full implementation
    }

    set_id, error = create_flashcard_set_transaction(payload)

    if error:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=error,
        )

    return {"message": "Flashcard set created", "set_id": set_id}


# ============= GET FLASHCARD SET =============
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


# ============= LIST FLASHCARD SETS =============
@router.get("", response_model=list[dict])
def list_flashcard_sets(limit: int = Query(50, ge=1, le=500)):
    """List all flashcard sets."""
    conn = get_db_connection()
    if not conn:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Database connection failed",
        )

    cursor = conn.cursor(dictionary=True)
    try:
        cursor.execute(
            "SELECT set_id, title, description, creator_id FROM flashcardset LIMIT %s",
            (limit,),
        )
        sets = cursor.fetchall()
        return sets

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
