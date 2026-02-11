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


    conn = None
    cur = None

    try:
        conn = get_db_connection()
        cur = conn.cursor(dictionary=True)

        try:
            cur.callproc(
                "StartDirectConversation",
                (int(requester_id), int(target_id)),
            )
        except MySQLError as e:
            conn.rollback()
            msg = str(e)
            if "CANNOT_MESSAGE_SELF" in msg:
                return jsonify({"detail": "Cannot start a conversation with yourself."}), 400
            return jsonify({"detail": msg}), 500

        conversation_id = None
        for result in cur.stored_results():
            row = result.fetchone()
            if row:
                conversation_id = row["conversation_id"]
                break

        conn.commit()

        if conversation_id is None:
            return jsonify({"detail": "Failed to start conversation"}), 500

        return jsonify({"conversation_id": conversation_id}), 200

    except MySQLError as e:
        if conn:
            conn.rollback()
        return jsonify({"detail": str(e)}), 500

    finally:
        if cur:
            cur.close()
        if conn:
            conn.close()


@bp.route("/<int:conversation_id>/messages", methods=["GET"])
def get_messages(conversation_id: int):
    """
    Get latest messages for a 1-1 conversation.
    Wraps GetDirectMessages(p_conversation_id, p_limit).
    """
    limit = request.args.get("limit", default=50, type=int)

    conn = None
    cur = None
    try:
        conn = get_db_connection()
        cur = conn.cursor(dictionary=True)

        cur.callproc("GetDirectMessages", (conversation_id, limit))

        rows = []
        for result in cur.stored_results():
            for r in result.fetchall():
                # r already includes sent_time aliased in the proc
                if r.get("sent_time") is not None:
                    r["sent_time"] = r["sent_time"].isoformat()
                rows.append(r)

        return jsonify(rows), 200

    except MySQLError as e:
        return jsonify({"detail": str(e)}), 500

    finally:
        if cur:
            cur.close()
        if conn:
            conn.close()


@bp.route("/<int:conversation_id>/messages", methods=["POST"])
def send_message(conversation_id: int):
    """
    Send a message in a 1-1 conversation.
    Wraps SendDirectMessage(p_conversation_id, p_sender_id, p_content).
    """
    data = request.get_json(silent=True) or {}
    sender_id = data.get("sender_user_id")
    content = (data.get("content") or "").strip()

    if not sender_id:
        return jsonify({"detail": "sender_user_id is required"}), 400
    if not content:
        return jsonify({"detail": "Message content cannot be empty."}), 400

    conn = None
    cur = None
    try:
        conn = get_db_connection()
        cur = conn.cursor(dictionary=True)

        cur.callproc(
            "SendDirectMessage",
            (conversation_id, int(sender_id), content),
        )

        message_id = None
        for result in cur.stored_results():
            row = result.fetchone()
            if row:
                message_id = row["message_id"]
                break

        conn.commit()

        if message_id is None:
            return jsonify({"detail": "Failed to send message"}), 500

        return jsonify({"status": "ok", "message_id": message_id}), 201

    except MySQLError as e:
        if conn:
            conn.rollback()
        return jsonify({"detail": str(e)}), 500

    finally:
        if cur:
            cur.close()
        if conn:
            conn.close()


@bp.route("/inbox", methods=["GET"])
def get_inbox():
    """
    All conversations for a user + last message + request status.
    Wraps GetDmInboxForUser(p_user_id, p_limit).
    """
    user_id = request.args.get("user_id", type=int)
    limit = request.args.get("limit", default=50, type=int)

    if not user_id:
        return jsonify({"detail": "user_id is required"}), 400

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

        return jsonify(rows), 200

    except MySQLError as e:
        return jsonify({"detail": str(e)}), 500
    finally:
        if cur:
            cur.close()
        if conn:
            conn.close()


@bp.route("/requests", methods=["GET"])
def get_message_requests():
    """
    Pending message requests for a user.
    Wraps GetMessageRequestsForUser.
    """
    user_id = request.args.get("user_id", type=int)
    limit = request.args.get("limit", default=50, type=int)

    if not user_id:
        return jsonify({"detail": "user_id is required"}), 400

    conn = None
    cur = None

    try:
        conn = get_db_connection()
        cur = conn.cursor(dictionary=True)

        cur.callproc("GetMessageRequestsForUser", (user_id, limit))

        rows = []
        for result in cur.stored_results():
            rows.extend(result.fetchall())

        return jsonify(rows or []), 200

    except MySQLError as e:
        return jsonify({"detail": str(e)}), 500

    finally:
        if cur:
            cur.close()
        if conn:
            conn.close()


@bp.route("/requests/<int:request_id>/<action>", methods=["POST"])
def respond_to_request(request_id: int, action: str):
    """
    POST /dm/requests/<id>/accept or /reject
    body: { "user_id": <target_user_id> }

    Wraps RespondToMessageRequest(p_request_id, p_action, p_user_id).
    """
    data = request.get_json(silent=True) or {}
    user_id = data.get("user_id")

    if not user_id:
        return jsonify({"detail": "user_id is required"}), 400
    if action not in ("accept", "reject"):
        return jsonify({"detail": "Invalid action"}), 400

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
                return jsonify({"detail": "Request not found"}), 404
            if "NOT_YOUR_REQUEST" in msg:
                return jsonify({"detail": "Not your request"}), 403
            if "INVALID_ACTION" in msg:
                return jsonify({"detail": "Invalid action"}), 400
            return jsonify({"detail": msg}), 500

        new_status = None
        for result in cur.stored_results():
            row = result.fetchone()
            if row:
                new_status = row["request_status"]
                break

        conn.commit()

        if new_status is None:
            return jsonify({"status": "ok"}), 200

        return jsonify({"status": "ok", "request_status": new_status}), 200

    except MySQLError as e:
        if conn:
            conn.rollback()
        return jsonify({"detail": str(e)}), 500

    finally:
        if cur is not None:
            cur.close()
        if conn is not None:
            conn.close()
