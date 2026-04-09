# Jacob Craig

from fastapi import APIRouter, HTTPException, status, Query
from mysql.connector import Error as MySQLError
from db import get_db_connection
from models import DirectMessage

router = APIRouter()


@router.post("/start", status_code=status.HTTP_200_OK, response_model=dict)
def start_conversation(requester_user_id: int = Query(...), target_user_id: int = Query(...)):
    """Find or create a 1-1 conversation between two users."""
    if requester_user_id == target_user_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot start a conversation with yourself.",
        )

    conn = None
    cur = None

    try:
        conn = get_db_connection()
        cur = conn.cursor(dictionary=True)

        cur.callproc("StartDirectConversation", (int(requester_user_id), int(target_user_id)))

        conversation_id = None
        for result in cur.stored_results():
            row = result.fetchone()
            if row:
                conversation_id = row["conversation_id"]
                break

        conn.commit()

        if conversation_id is None:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to start conversation",
            )

        return {"conversation_id": conversation_id}

    except MySQLError as e:
        if conn:
            conn.rollback()
        msg = str(e)
        if "CANNOT_MESSAGE_SELF" in msg:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cannot start a conversation with yourself.",
            )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=msg,
        )

    finally:
        if cur:
            cur.close()
        if conn:
            conn.close()


@router.get("/{conversation_id}/messages", response_model=list[dict])
def get_messages(conversation_id: int, limit: int = Query(50, ge=1, le=500)):
    """Get latest messages for a 1-1 conversation."""
    conn = None
    cur = None
    
    try:
        conn = get_db_connection()
        cur = conn.cursor(dictionary=True)

        cur.callproc("GetDirectMessages", (conversation_id, limit))

        rows = []
        for result in cur.stored_results():
            for r in result.fetchall():
                if r.get("sent_time") is not None:
                    r["sent_time"] = r["sent_time"].isoformat()
                rows.append(r)

        return rows

    except MySQLError as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e),
        )

    finally:
        if cur:
            cur.close()
        if conn:
            conn.close()


@router.post("/{conversation_id}/messages", status_code=status.HTTP_201_CREATED, response_model=dict)
def send_message(conversation_id: int, sender_user_id: int = Query(...), content: str = Query(...)):
    """Send a message in a 1-1 conversation."""
    if not sender_user_id or not content.strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="sender_user_id and content are required",
        )

    conn = None
    cur = None
    
    try:
        conn = get_db_connection()
        cur = conn.cursor(dictionary=True)

        cur.callproc("SendDirectMessage", (conversation_id, int(sender_user_id), content.strip()))

        message_id = None
        for result in cur.stored_results():
            row = result.fetchone()
            if row:
                message_id = row["message_id"]
                break

        conn.commit()

        if message_id is None:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to send message",
            )

        return {"status": "ok", "message_id": message_id}

    except MySQLError as e:
        if conn:
            conn.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e),
        )

    finally:
        if cur:
            cur.close()
        if conn:
            conn.close()


@router.get("/inbox", response_model=list[dict])
def get_inbox(user_id: int = Query(...), limit: int = Query(50, ge=1, le=500)):
    """Get all conversations for a user + last message."""
    conn = None
    cur = None
    
    try:
        conn = get_db_connection()
        cur = conn.cursor(dictionary=True)

        cur.callproc("GetDmInboxForUser", (user_id, limit))

        rows = []
        for result in cur.stored_results():
            for r in result.fetchall():
                if r.get("last_sent_at") is not None:
                    r["last_sent_at"] = r["last_sent_at"].isoformat()
                rows.append(r)

        return rows

    except MySQLError as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e),
        )

    finally:
        if cur:
            cur.close()
        if conn:
            conn.close()


@router.get("/requests", response_model=list[dict])
def get_message_requests(user_id: int = Query(...), limit: int = Query(50, ge=1, le=500)):
    """Get pending message requests for a user."""
    conn = None
    cur = None

    try:
        conn = get_db_connection()
        cur = conn.cursor(dictionary=True)

        cur.callproc("GetMessageRequestsForUser", (user_id, limit))

        rows = []
        for result in cur.stored_results():
            rows.extend(result.fetchall())

        return rows or []

    except MySQLError as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e),
        )

    finally:
        if cur:
            cur.close()
        if conn:
            conn.close()


@router.post("/requests/{request_id}/{action}", response_model=dict)
def respond_to_request(request_id: int, action: str, user_id: int = Query(...)):
    """Accept or reject a pending message request for a user."""
    if action not in ("accept", "reject"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid action",
        )

    conn = None
    cur = None
    try:
        conn = get_db_connection()
        cur = conn.cursor(dictionary=True)

        try:
            cur.callproc(
                "RespondToMessageRequest",
                (request_id, action, int(user_id)),
            )
        except MySQLError as e:
            conn.rollback()
            msg = str(e)
            if "REQUEST_NOT_FOUND" in msg:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Request not found",
                )
            if "NOT_YOUR_REQUEST" in msg:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Not your request",
                )
            if "INVALID_ACTION" in msg:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Invalid action",
                )
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=msg,
            )

        new_status = None
        for result in cur.stored_results():
            row = result.fetchone()
            if row:
                new_status = row["request_status"]
                break

        conn.commit()

        if new_status is None:
            return {"status": "ok"}

        return {"status": "ok", "request_status": new_status}

    except MySQLError as e:
        if conn:
            conn.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e),
        )

    finally:
        if cur is not None:
            cur.close()
        if conn is not None:
            conn.close()
