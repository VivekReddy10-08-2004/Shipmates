"""
FastAPI Pydantic models for request/response validation.
These models provide automatic validation, documentation, and type hints.
"""

from pydantic import BaseModel, EmailStr
from typing import Optional, List
from datetime import datetime


# ============= AUTH MODELS =============
class UserRegister(BaseModel):
    """Schema for user registration"""
    first_name: str
    last_name: str
    email: EmailStr
    password: str

    class Config:
        json_schema_extra = {
            "example": {
                "first_name": "John",
                "last_name": "Doe",
                "email": "john@example.com",
                "password": "securepass123"
            }
        }


class UserLogin(BaseModel):
    """Schema for user login"""
    email: EmailStr
    password: str

    class Config:
        json_schema_extra = {
            "example": {
                "email": "john@example.com",
                "password": "securepass123"
            }
        }


class UserResponse(BaseModel):
    """Schema for user data response"""
    user_id: int
    first_name: str
    last_name: str
    email: str
    college_level: Optional[str] = None
    college_name: Optional[str] = None
    major_name: Optional[str] = None
    bio: Optional[str] = None


class AuthResponse(BaseModel):
    """Schema for authentication responses"""
    message: str
    user: Optional[UserResponse] = None


# ============= USER PROFILE MODELS =============
class UserUpdate(BaseModel):
    """Schema for updating user profile"""
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    email: Optional[EmailStr] = None
    college_level: Optional[str] = None
    college_id: Optional[int] = None
    major_id: Optional[int] = None
    bio: Optional[str] = None

    class Config:
        json_schema_extra = {
            "example": {
                "first_name": "Jane",
                "last_name": "Doe",
                "bio": "Computer Science student"
            }
        }


class College(BaseModel):
    """Schema for college data"""
    college_id: int
    college_name: str


class Major(BaseModel):
    """Schema for major data"""
    major_id: int
    major_name: str


# ============= STUDY GROUP MODELS =============
class CreateStudyGroup(BaseModel):
    """Schema for creating a study group"""
    group_name: str
    max_members: int
    course_id: int
    creator_user_id: int
    is_private: bool = False

    class Config:
        json_schema_extra = {
            "example": {
                "group_name": "Python Study Group",
                "max_members": 5,
                "course_id": 420,
                "creator_user_id": 1005,
                "is_private": False
            }
        }


class StudyGroup(BaseModel):
    """Schema for study group response"""
    group_id: int
    group_name: str
    max_members: int
    course_id: int
    is_private: bool
    created_at: Optional[datetime] = None


# ============= CHAT MODELS =============
class ChatMessage(BaseModel):
    """Schema for chat message input"""
    user_id: int
    content: str

    class Config:
        json_schema_extra = {
            "example": {
                "user_id": 1005,
                "content": "Has anyone done the homework yet?"
            }
        }


class ChatMessageResponse(BaseModel):
    """Schema for chat message response"""
    message_id: int
    user_id: int
    content: str
    sent_time: str


# ============= COURSE MODELS =============
class Course(BaseModel):
    """Schema for course data"""
    course_id: int
    course_name: str
    course_code: Optional[str] = None


class Enrollment(BaseModel):
    """Schema for course enrollment"""
    user_id: int
    course_id: int


# ============= QUIZ MODELS =============
class QuizQuestion(BaseModel):
    """Schema for quiz question"""
    question_id: int
    question_text: str
    quiz_id: int


class QuizAnswer(BaseModel):
    """Schema for quiz answer input"""
    user_id: int
    question_id: int
    answer_text: str


class QuizSubmission(BaseModel):
    """Schema for quiz submission"""
    user_id: int
    quiz_id: int
    answers: List[QuizAnswer]


# ============= FLASHCARD MODELS =============
class Flashcard(BaseModel):
    """Schema for flashcard"""
    flashcard_id: int
    question: str
    answer: str
    deck_id: int


class CreateFlashcard(BaseModel):
    """Schema for creating flashcard"""
    question: str
    answer: str
    deck_id: int


class FlashcardDeck(BaseModel):
    """Schema for flashcard deck"""
    deck_id: int
    deck_name: str
    user_id: int


# ============= RESOURCE MODELS =============
class Resource(BaseModel):
    """Schema for learning resource"""
    resource_id: int
    title: str
    url: str
    course_id: int


class CreateResource(BaseModel):
    """Schema for creating resource"""
    title: str
    url: str
    course_id: int


# ============= DIRECT MESSAGE MODELS =============
class DirectMessage(BaseModel):
    """Schema for direct message"""
    sender_id: int
    recipient_id: int
    content: str

    class Config:
        json_schema_extra = {
            "example": {
                "sender_id": 1005,
                "recipient_id": 1006,
                "content": "Did you get the notes from class?"
            }
        }


class DirectMessageResponse(BaseModel):
    """Schema for direct message response"""
    dm_id: int
    sender_id: int
    recipient_id: int
    content: str
    sent_time: str


# ============= MATCH MODELS =============
class StudyBuddyMatch(BaseModel):
    """Schema for study buddy match"""
    match_id: int
    user1_id: int
    user2_id: int
    similarity_score: float
    matched_at: str


# ============= GENERIC MODELS =============
class SuccessResponse(BaseModel):
    """Generic success response"""
    message: str
    success: bool = True


class ErrorResponse(BaseModel):
    """Generic error response"""
    error: str
    detail: Optional[str] = None
