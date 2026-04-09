# Jacob Craig

from fastapi import APIRouter, HTTPException, status, Query
from mysql.connector import Error as MySQLError
from datetime import datetime
from db import get_db_connection
from models import ChatMessage, ChatMessageResponse

router = APIRouter()


@router.get("/{group_id}/chat", response_model=list[ChatMessageResponse])
def get_chat_messages(group_id: int, limit: int = Query(50, ge=1, le=500)):
    """
    Returns latest chat messages for a group.
    Wraps GetChatMessagesForGroup stored procedure.
    """
    conn = None
    cursor = None

    try:
        conn = get_db_connection()
        cursor = conn.cursor()

        cursor.callproc("GetChatMessagesForGroup", (group_id, limit))

        messages = []

        for result in cursor.stored_results():
            rows = result.fetchall()
            col_names = result.column_names
            for row in rows:
                row_dict = dict(zip(col_names, row))
                sent = row_dict["sent_time"]
                messages.append(
                    {
                        "message_id": row_dict["message_id"],
                        "user_id": row_dict["user_id"],
                        "content": row_dict["content"],
                        "sent_time": sent.isoformat()
                        if isinstance(sent, datetime)
                        else sent,
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

