# By Rise Akizaki

import traceback
from fastapi import APIRouter, HTTPException, Request, status
import bcrypt
from db import get_db_connection
from models import (
    UserRegister,
    UserLogin,
    AuthResponse,
    UserResponse,
    College,
    Major,
)

router = APIRouter()


# ============= USER REGISTRATION =============
@router.post("/register", response_model=dict, status_code=status.HTTP_200_OK)
def register_user(user_data: UserRegister):
    """Register a new user with email and password."""
    try:
        # Hash password
        hashed_password = bcrypt.hashpw(
            user_data.password.encode(), bcrypt.gensalt()
        ).decode()

        connection = get_db_connection()
        cursor = connection.cursor()

        # Check for duplicate email
        cursor.execute(
            "SELECT * FROM Users WHERE email = %s",
            (user_data.email,),
        )
        if cursor.fetchone():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Email already registered",
            )

        # Insert user into database
        cursor.execute(
            """
            INSERT INTO Users 
            (email, password_hash, first_name, last_name, college_level, college_id, major_id)
            VALUES (%s, %s, %s, %s, %s, %s, %s)
            """,
            (
                user_data.email,
                hashed_password,
                user_data.first_name,
                user_data.last_name,
                None,
                None,
                None,
            ),
        )

        connection.commit()
        cursor.close()
        connection.close()

        return {"message": "Registration successful! You should be redirected shortly"}

    except HTTPException:
        raise
    except Exception as exception:
        traceback.print_exc()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(exception),
        )


# ============= USER LOGIN =============
@router.post("/login", response_model=dict)
def login_user(user_data: UserLogin, request: Request):
    """Authenticate user, set session cookie, return user info."""
    try:
        connection = get_db_connection()
        cursor = connection.cursor()

        # Fetch user by email
        cursor.execute(
            "SELECT user_id, password_hash FROM Users WHERE email = %s",
            (user_data.email,),
        )
        user_row = cursor.fetchone()

        if user_row is None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Account with given email doesn't exist",
            )

        user_id, hashed_password = user_row

        # Verify password
        if not bcrypt.checkpw(user_data.password.encode(), hashed_password.encode()):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Incorrect password",
            )

        user_info = {"user_id": user_id, "email": user_data.email}

        cursor.close()
        connection.close()

        request.session["user_id"] = int(user_id)

        return {
            "message": "Login successful! You should be redirected shortly",
            "user": user_info,
        }

    except HTTPException:
        raise
    except Exception as exception:
        traceback.print_exc()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(exception),
        )


@router.post("/logout", response_model=dict)
def logout_user(request: Request):
    """Clear session cookie (client should still call with credentials: include)."""
    request.session.clear()
    return {"message": "Logged out"}


# ============= DATA RETRIEVAL =============
@router.get("/colleges", response_model=list[College])
def get_colleges():
    """Retrieve all colleges from database."""
    connection = get_db_connection()
    try:
        cursor = connection.cursor(dictionary=True)
        cursor.execute("SELECT college_id, college_name FROM Colleges")
        colleges = cursor.fetchall()
        return colleges
    except Exception as exception:
        traceback.print_exc()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(exception),
        )
    finally:
        cursor.close()
        connection.close()


@router.get("/majors", response_model=list[Major])
def get_majors():
    """Retrieve all majors from database."""
    connection = get_db_connection()
    try:
        cursor = connection.cursor(dictionary=True)
        cursor.execute("SELECT major_id, major_name FROM Majors")
        majors = cursor.fetchall()
        return majors
    except Exception as exception:
        traceback.print_exc()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(exception),
        )
    finally:
        cursor.close()
        connection.close()




