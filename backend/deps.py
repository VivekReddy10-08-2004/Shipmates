"""Shared FastAPI dependencies."""

from fastapi import HTTPException, Request, status


def get_current_user_id(request: Request) -> int:
    """Require a logged-in user (session cookie set at /auth/login)."""
    uid = request.session.get("user_id")
    if uid is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
        )
    return int(uid)
