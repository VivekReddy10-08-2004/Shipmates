# Jacob Craig

from fastapi import APIRouter, HTTPException, status, Query
from mysql.connector import Error as MySQLError
from datetime import datetime
from db import get_db_connection
from models import ChatMessage, ChatMessageResponse

router = APIRouter()


@router.get("/{group_id}/chat", response_model=list[dict])
def get_chat_messages(group_id: int, limit: int = Query(50, ge=1, le=500)):
    """
    Returns latest chat messages for a group, including sender's name.
    Joins Users inline so the frontend can render names instead of IDs.
    """
    conn = None
    cursor = None

    try:
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)

        cursor.execute(
            """
            SELECT c.message_id,
                   c.user_id,
                   c.content,
                   c.sent_time,
                   u.first_name,
                   u.last_name
            FROM Chat_Message AS c
            JOIN Users AS u ON u.user_id = c.user_id
            WHERE c.group_id = %s
            ORDER BY c.sent_time ASC, c.message_id ASC
            LIMIT %s
            """,
            (int(group_id), int(limit)),
        )
        rows = cursor.fetchall() or []

        messages = []
        for row in rows:
            sent = row.get("sent_time")
            messages.append(
                {
                    "message_id": row.get("message_id"),
                    "user_id": row.get("user_id"),
                    "first_name": row.get("first_name"),
                    "last_name": row.get("last_name"),
                    "content": row.get("content"),
                    "sent_time": sent.isoformat() if isinstance(sent, datetime) else sent,
                }
            )

        return messages

    except MySQLError as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e),
        )

    finally:
        if cursor is not None:
            cursor.close()
        if conn is not None:
            conn.close()


@router.post("/{group_id}/chat", response_model=dict, status_code=status.HTTP_201_CREATED)
def post_chat_message(group_id: int, message: ChatMessage):
    """
    Inserts a new chat message via AddChatMessage stored procedure.
    """
    if not message.user_id or not message.content.strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="user_id and content are required",
        )

    conn = None
    cursor = None

    try:
        conn = get_db_connection()
        cursor = conn.cursor()

        # CALL AddChatMessage(p_group_id, p_user_id, p_content)
        cursor.callproc("AddChatMessage", (group_id, message.user_id, message.content.strip()))

        message_id = None
        for result in cursor.stored_results():
            row = result.fetchone()
            if row:
                message_id = row[0] if not isinstance(row, dict) else row["message_id"]
                break

        conn.commit()

        if message_id is None:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to create message",
            )

        return {"message_id": message_id}

    except MySQLError as e:
        if conn is not None:
            conn.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e),
        )

    finally:
        if cursor is not None:
            cursor.close()
        if conn is not None:
            conn.close()

