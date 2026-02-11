# By Rise Akizaki

from fastapi import APIRouter, HTTPException, status
from db import get_db_connection
from models import UserResponse, UserUpdate

router = APIRouter()


@router.get("/account", response_model=UserResponse)
def get_account_data(user_id: int):
    """
    Get user account information including college and major details.
    Query param: user_id
    """
    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="user_id is required",
        )

    connection = get_db_connection()
    try:
        cursor = connection.cursor(dictionary=True)

        query = """
            SELECT 
                u.user_id,
                u.first_name,
                u.last_name,
                u.email,
                u.college_level,
                c.college_name,
                m.major_name,
                u.bio
            FROM Users u
            LEFT JOIN Colleges c ON u.college_id = c.college_id
            LEFT JOIN Majors m ON u.major_id = m.major_id
            WHERE u.user_id = %s
        """

        cursor.execute(query, (user_id,))
        data = cursor.fetchone()

        if not data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User not found",
            )

        return data

    except HTTPException:
        raise
    except Exception as exception:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(exception),
        )
    finally:
        cursor.close()
        connection.close()


@router.put("/account", response_model=dict, status_code=status.HTTP_200_OK)
def update_account(user_id: int, user_update: UserUpdate):
    """
    Update user account information.
    """
    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="user_id is required",
        )

    connection = get_db_connection()
    try:
        connection.start_transaction()
        cursor = connection.cursor()

        # Build update query dynamically with only provided fields
        update_fields = {}
        if user_update.first_name is not None:
            update_fields["first_name"] = user_update.first_name
        if user_update.last_name is not None:
            update_fields["last_name"] = user_update.last_name
        if user_update.email is not None:
            update_fields["email"] = user_update.email
        if user_update.college_level is not None:
            update_fields["college_level"] = user_update.college_level
        if user_update.college_id is not None:
            update_fields["college_id"] = user_update.college_id
        if user_update.major_id is not None:
            update_fields["major_id"] = user_update.major_id
        if user_update.bio is not None:
            update_fields["bio"] = user_update.bio

        if not update_fields:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No fields to update",
            )

        # Build the SET clause
        set_clause = ", ".join([f"{key} = %s" for key in update_fields.keys()])
        values = list(update_fields.values()) + [user_id]

        query = f"UPDATE Users SET {set_clause} WHERE user_id = %s"
        cursor.execute(query, values)

        connection.commit()
        return {"success": True, "message": "Account updated successfully"}

    except HTTPException:
        connection.rollback()
        raise
    except Exception as exception:
        connection.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(exception),
        )
    finally:
        cursor.close()
        connection.close()
