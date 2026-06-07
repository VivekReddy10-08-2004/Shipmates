from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from starlette.middleware.sessions import SessionMiddleware
import os
from dotenv import load_dotenv

# Import FastAPI routers
from routes.auth_routes import router as auth_router
from routes.user_routes import router as user_router
from routes.studygroup_routes import (
    get_upcoming_sessions_for_user,
    router as studygroup_router,
)
from routes.chat_routes import router as chat_router
from routes.course_routes import router as course_router
from routes.match_routes import router as match_router
from routes.direct_message_routes import router as dm_router
from routes.quiz_routes import router as quiz_router
from routes.flashcard_routes import router as flashcard_router
from routes.resource_routes import router as resource_router
from routes.generate_routes import router as generate_router

from db import get_db_connection as get_db

# Load environment variables from the .env that sits next to this file,
# not just the current working directory (which may be the project root).
_here = os.path.dirname(os.path.abspath(__file__))
load_dotenv(os.path.join(_here, ".env"), override=False)

# Signed cookie session (same-site with Vite dev server + credentials: include)
SESSION_SECRET = os.getenv("SESSION_SECRET")
if not SESSION_SECRET:
    raise RuntimeError(
        "SESSION_SECRET is not set. Copy backend/.env.example to backend/.env "
        "and fill in a long random hex string for SESSION_SECRET."
    )


def seed_admin_user():
    """Auto-create admin user on first run if it doesn't exist."""
    admin_username = os.getenv("ADMIN_USERNAME")
    admin_password = os.getenv("ADMIN_PASSWORD")

    if not admin_username or not admin_password:
        # No admin creds configured — skip silently (normal for contributor setups).
        return

    conn = get_db()
    if not conn:
        print("[SEED] Database connection failed; skipping admin user seed.")
        return

    cursor = conn.cursor(dictionary=True)
    try:
        cursor.execute("SELECT user_id FROM users WHERE email = %s", (admin_username,))
        existing = cursor.fetchone()

        if not existing:
            import bcrypt
            hashed = bcrypt.hashpw(admin_password.encode(), bcrypt.gensalt()).decode()
            cursor.execute(
                """
                INSERT INTO users (first_name, last_name, email, password_hash, bio)
                VALUES (%s, %s, %s, %s, %s)
                """,
                ("Admin", "User", admin_username, hashed, "Default admin account"),
            )
            conn.commit()
            print(f"[SEED] Admin user created: {admin_username}")
        else:
            print(f"[SEED] Admin user already exists: {admin_username}")
    except Exception as e:
        print(f"[SEED] Error seeding admin user: {e}")
    finally:
        cursor.close()
        conn.close()
                  

def create_app():
    # Seed admin user on startup if credentials configured
    seed_admin_user()

    app = FastAPI(title="Shipmates", version="1.0.0", description="Study buddy matching and collaboration platform")

    # Where we store uploaded profile images
    base_dir = os.path.dirname(os.path.abspath(__file__))
    upload_folder = os.path.join(base_dir, "uploads")
    os.makedirs(upload_folder, exist_ok=True)

    # Serve uploaded files statically
    app.mount("/uploads", StaticFiles(directory=upload_folder), name="uploads")

    # Session first (inner); CORS outer — browser sends session cookie on cross-port localhost
    app.add_middleware(
        SessionMiddleware,
        secret_key=SESSION_SECRET,
        same_site="lax",
        https_only=False,
    )
    # Allow vite dev server to talk to the backend
    app.add_middleware(
        CORSMiddleware,
        allow_origins=[
            "http://localhost:5173",
            "http://127.0.0.1:5173",
            "http://localhost:5176",
            "http://127.0.0.1:5176"
        ],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    @app.get("/", tags=["Health"])
    def health():
        return {"status": "backend running"}

    # Include all routers
    app.include_router(auth_router, prefix="/auth", tags=["Authentication"])
    app.include_router(user_router, prefix="/user", tags=["User Profile"])
    app.include_router(studygroup_router, prefix="/groups", tags=["Study Groups"])
    # Legacy path (older frontend); canonical: GET /groups/sessions/upcoming
    app.add_api_route(
        "/sessions/upcoming",
        get_upcoming_sessions_for_user,
        methods=["GET"],
        tags=["Study Groups"],
    )
    app.include_router(chat_router, prefix="/groups", tags=["Chat"])
    app.include_router(course_router, prefix="/courses", tags=["Courses"])
    app.include_router(match_router, prefix="/match", tags=["Study Buddy Matching"])
    app.include_router(dm_router, prefix="/messages", tags=["Direct Messages"])
    app.include_router(quiz_router, prefix="/quiz", tags=["Quizzes"])
    app.include_router(flashcard_router, prefix="/flashcards", tags=["Flashcards"])
    app.include_router(resource_router, prefix="/resources", tags=["Resources"])
    app.include_router(generate_router)
    
    return app

app = create_app()

if __name__ == "__main__":
    import uvicorn
    
    # Run FastAPI app with Uvicorn
    uvicorn.run(
        "app:app",
        host="127.0.0.1",
        port=8001,
        reload=True
    )
