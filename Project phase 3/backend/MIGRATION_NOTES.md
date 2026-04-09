# Flask to FastAPI Migration Guide

## Overview
This document outlines the migration of Shipmates backend from Flask to FastAPI, explaining the key differences, patterns, and how to understand both frameworks.

---

## Table of Contents
1. [Architecture Differences](#architecture-differences)
2. [Flask vs FastAPI Comparison](#flask-vs-fastapi-comparison)
3. [Key Conversion Patterns](#key-conversion-patterns)
4. [Migration Checklist](#migration-checklist)
5. [Running the Application](#running-the-application)

---

## Architecture Differences

### Flask Architecture
Flask uses a **synchronous, request-response model** with **Blueprints** for modularity:

```
Request → Flask Route Handler → Business Logic → Response
```

**Key Components:**
- **Blueprints**: Modular route containers (like `auth_bp = Blueprint('auth', __name__)`)
- **Decorators**: `@app.route()` or `@blueprint.route()` to define endpoints
- **Request Context**: `request` global object for accessing query params, JSON body, etc.
- **Sessions**: Flask built-in session management via `session` dictionary
- **Error Handling**: Manual try/catch with `jsonify()` for JSON responses

### FastAPI Architecture  
FastAPI uses an **asynchronous, dependency-injection model** with **APIRouters** for modularity:

```
Request → FastAPI Route Handler → (Dependency Injection) → Business Logic → Response
```

**Key Components:**
- **APIRouter**: Replaces Blueprint for modular routes
- **Decorators**: `@router.get()`, `@router.post()`, etc. (HTTP method specific)
- **Path Parameters**: Function parameters automatically extracted from URL path
- **Query Parameters**: Function parameters with `Query()` validator
- **Pydantic Models**: Type-safe request/response validation
- **HTTPException**: For error responses (replaces manual error returns)
- **Automatic OpenAPI Docs**: Auto-generated Swagger UI and ReDoc

---

## Flask vs FastAPI Comparison

### 1. **Creating an Application**

**FLASK:**
```python
from flask import Flask

app = Flask(__name__)

@app.route("/", methods=["GET"])
def home():
    return {"status": "ok"}, 200

if __name__ == "__main__":
    app.run(host="localhost", port=5000, debug=True)
```

**FASTAPI:**
```python
from fastapi import FastAPI

app = FastAPI(title="Shipmates", version="1.0.0")

@app.get("/")
def home():
    return {"status": "ok"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "app:app",
        host="localhost",
        port=8000,
        reload=True
    )
```

**Key Differences:**
- FastAPI uses method-specific decorators (`@app.get()`, `@app.post()`)
- FastAPI automatically serializes return values to JSON (no `jsonify()` needed)
- FastAPI returns status codes via decorator parameter or status_code parameter
- Uvicorn is the ASGI server used to run FastAPI apps

---

### 2. **Request Handling**

**FLASK - GET with Query Parameters:**
```python
@app.route("/search", methods=["GET"])
def search():
    query = request.args.get("q", "")
    limit = request.args.get("limit", default=10, type=int)
    return {"results": []}
```

**FASTAPI - GET with Query Parameters:**
```python
from fastapi import Query

@app.get("/search")
def search(q: str = Query(""), limit: int = Query(10, ge=1, le=100)):
    return {"results": []}
```

**Key Differences:**
- FastAPI uses function parameters with type hints
- FastAPI validates types automatically (int, str, etc.)
- `Query()` allows additional validation (min/max, regex, etc.)
- Query parameter handling is more explicit and safer

---

### 3. **POST Requests with JSON Body**

**FLASK:**
```python
from flask import request, jsonify

@app.route("/users", methods=["POST"])
def create_user():
    data = request.get_json()  # Manually parse JSON
    email = data.get("email")
    password = data.get("password")
    
    if not email or not password:
        return jsonify({"error": "Missing fields"}), 400
    
    # ... insert into database
    return jsonify({"message": "User created"}), 201
```

**FASTAPI:**
```python
from fastapi import HTTPException, status
from pydantic import BaseModel

class UserCreate(BaseModel):
    email: str
    password: str

@app.post("/users", status_code=status.HTTP_201_CREATED)
def create_user(user: UserCreate):
    if not user.email or not user.password:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Missing fields"
        )
    
    # ... insert into database
    return {"message": "User created"}
```

**Key Differences:**
- FastAPI uses **Pydantic models** for automatic request validation
- Type hints are used for automatic parsing and validation
- `HTTPException` replaces manual error responses
- Status codes are clearer with `status.HTTP_*` constants
- Request body is automatically parsed and validated before function execution

---

### 4. **Path Parameters**

**FLASK:**
```python
@app.route("/users/<int:user_id>", methods=["GET"])
def get_user(user_id):
    # user_id is automatically an int
    return {"user_id": user_id}
```

**FASTAPI:**
```python
@app.get("/users/{user_id}")
def get_user(user_id: int):
    # Type hints make validation automatic
    return {"user_id": user_id}
```

**Key Differences:**
- FastAPI uses `{variable}` syntax (similar to Flask)
- Type hints are required (FastAPI validates the type)
- Cleaner and more explicit

---

### 5. **Error Handling**

**FLASK:**
```python
@app.route("/login", methods=["POST"])
def login():
    try:
        data = request.get_json()
        # ... authenticate
    except Exception as e:
        return jsonify({"error": str(e)}), 500
```

**FASTAPI:**
```python
from fastapi import HTTPException, status

@app.post("/login")
def login(credentials: LoginRequest):
    try:
        # ... authenticate
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )
```

**Key Differences:**
- `HTTPException` is raised instead of returning error tuples
- Status codes are explicit constants
- FastAPI automatically formats the error response

---

### 6. **CORS Middleware**

**FLASK:**
```python
from flask_cors import CORS

app = Flask(__name__)
CORS(app, origins=["http://localhost:5173"])
```

**FASTAPI:**
```python
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI()
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

**Key Differences:**
- FastAPI uses native middleware system
- More explicit configuration
- More control over CORS behavior

---

### 7. **Blueprints vs APIRouters**

**FLASK - Blueprint:**
```python
# auth_routes.py
from flask import Blueprint

auth_bp = Blueprint('auth', __name__, url_prefix="/auth")

@auth_bp.route("/login", methods=["POST"])
def login():
    return {"message": "Login successful"}

# app.py
app.register_blueprint(auth_bp)
```

**FASTAPI - APIRouter:**
```python
# auth_routes.py
from fastapi import APIRouter

router = APIRouter(prefix="/auth", tags=["Authentication"])

@router.post("/login")
def login():
    return {"message": "Login successful"}

# app.py
app.include_router(router)
```

**Key Differences:**
- `APIRouter` replaces `Blueprint`
- `prefix` replaces `url_prefix`
- `tags` parameter for OpenAPI documentation grouping
- `include_router()` replaces `register_blueprint()`
- More explicit method names (`post` vs `route(..., methods=["POST"])`)

---

### 8. **Database Operations**

Both Flask and FastAPI handle database code similarly in middleware/utilities:

```python
# database access (same in both)
from db import get_db_connection

connection = get_db_connection()
cursor = connection.cursor(dictionary=True)
cursor.execute("SELECT * FROM users WHERE id = %s", (user_id,))
result = cursor.fetchone()

# FastAPI handles the response serialization
return result  # Automatically converted to JSON
```

**Key Difference:**
- FastAPI handles response serialization automatically
- Pydantic models ensure type safety

---

### 9. **Sessions vs Dependency Injection**

**FLASK - Sessions:**
```python
from flask import session

@app.post("/login")
def login():
    # ... authenticate
    session["user"] = {"user_id": 123, "email": "user@example.com"}
    return {"message": "Logged in"}

@app.get("/profile")
def profile():
    user = session.get("user")
    if not user:
        return {"error": "Not logged in"}, 401
```

**FASTAPI - Query Parameters (recommended for tokens/auth):**
```python
from fastapi import Depends, HTTPException, status

def get_current_user(user_id: int):
    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not logged in"
        )
    return {"user_id": user_id}

@app.post("/login")
def login(credentials: LoginRequest):
    # ... authenticate
    # Return token or just return success (client stores token)
    return {"message": "Logged in", "user_id": 123}

@app.get("/profile")
def profile(user_id: int = Query(...)):
    user = get_current_user(user_id)
    return user
```

**Key Differences:**
- FastAPI doesn't have built-in server-side sessions (better for distributed systems)
- Token-based auth (JWT) is more common and scalable
- Dependency injection pattern for accessing current user
- Query parameters or headers for authentication

---

### 10. **Async/Await Support**

**FLASK - Synchronous:**
```python
@app.route("/users")
def get_users():
    result = db.query("SELECT * FROM users")  # Blocks until database responds
    return result
```

**FASTAPI - Asynchronous:**
```python
@app.get("/users")
async def get_users():
    result = await db.query("SELECT * FROM users")  # Non-blocking
    return result
```

**Key Differences:**
- FastAPI supports async/await natively
- Better performance under high load (doesn't block on I/O)
- For sync operations, just use regular functions (FastAPI handles it)

---

## Key Conversion Patterns

### Pattern 1: Simple GET Endpoint

**Before (Flask):**
```python
@app.route("/colleges", methods=["GET"])
def get_colleges():
    try:
        cursor = connection.cursor(dictionary=True)
        cursor.execute("SELECT college_id, college_name FROM Colleges")
        colleges = cursor.fetchall()
        return jsonify(colleges), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500
    finally:
        cursor.close()
```

**After (FastAPI):**
```python
from fastapi import HTTPException, status
from models import College

@router.get("/colleges", response_model=list[College])
def get_colleges():
    try:
        cursor = connection.cursor(dictionary=True)
        cursor.execute("SELECT college_id, college_name FROM Colleges")
        colleges = cursor.fetchall()
        return colleges
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )
    finally:
        cursor.close()
```

---

### Pattern 2: POST with Validation

**Before (Flask):**
```python
@auth_bp.route("/register", methods=["POST"])
def register_user():
    data = request.get_json()
    first_name = data.get("first_name")
    last_name = data.get("last_name")
    email = data.get("email")
    password = data.get("password")

    if not first_name or not last_name or not email or not password:
        return jsonify({"error": "Missing required fields"}), 400

    # ... rest of function
```

**After (FastAPI):**
```python
from models import UserRegister

@router.post("/register", status_code=status.HTTP_200_OK)
def register_user(user_data: UserRegister):
    # Validation happens automatically via Pydantic
    # If validation fails, FastAPI returns 422 error automatically

    # ... rest of function
```

---

### Pattern 3: Query Parameters with Validation

**Before (Flask):**
```python
@app.route("/search", methods=["GET"])
def search():
    q = (request.args.get("q") or "").strip()
    limit = request.args.get("limit", default=8, type=int)

    if len(q) < 2:
        return jsonify([]), 200

    # ... rest of function
```

**After (FastAPI):**
```python
from fastapi import Query

@router.get("/search")
def search(q: str = Query("", min_length=2), limit: int = Query(8, ge=1, le=50)):
    # FastAPI automatically validates before function runs
    # If validation fails, returns 422 error automatically

    # ... rest of function
```

---

## Migration Checklist

- [x] Create Pydantic models file (`models.py`)
- [x] Convert `auth_routes.py` to FastAPI
- [x] Convert `user_routes.py` to FastAPI
- [x] Convert `chat_routes.py` to FastAPI
- [x] Convert `course_routes.py` to FastAPI
- [x] Convert `studygroup_routes.py` to FastAPI
- [ ] Convert `match_routes.py` to FastAPI
- [ ] Convert `direct_message_routes.py` to FastAPI
- [ ] Convert `quiz_routes.py` to FastAPI
- [ ] Convert `flashcard_routes.py` to FastAPI
- [ ] Convert `resource_routes.py` to FastAPI
- [x] Update `app.py` to use FastAPI and include all routers
- [x] Update `requirements.txt` with FastAPI and uvicorn
- [ ] Test all endpoints
- [ ] Update frontend API calls if needed (mostly compatible)

---

## Running the Application

### Development Mode

**Before (Flask):**
```bash
python app.py
# Runs on http://127.0.0.1:5000
```

**After (FastAPI):**
```bash
python app.py
# Or use Uvicorn directly:
uvicorn app:create_app --reload --host 127.0.0.1 --port 8001 --factory
```

### Production Mode

**Before (Flask):**
```bash
gunicorn -w 4 -b 0.0.0.0:5000 "app:create_app()"
```

**After (FastAPI):**
```bash
gunicorn -w 4 -k uvicorn.workers.UvicornWorker -b 0.0.0.0:8001 "app:create_app"
```

---

## Learning Path

### Understanding Flask
1. **Decorators** - How `@app.route()` maps URLs to functions
2. **Request Context** - Global `request` object for accessing query params, body, headers
3. **Blueprints** - Organizing code into modular components
4. **Error Handling** - Manual try/catch with `jsonify()` responses
5. **Middleware** - CORS, authentication, logging

### Understanding FastAPI
1. **Decorators** - Method-specific decorators (`@app.get()`, `@app.post()`)
2. **Type Hints** - Using Python type hints for validation
3. **Pydantic Models** - Automatic request/response validation
4. **APIRouter** - Same purpose as Flask Blueprints
5. **HTTPException** - Proper error handling with status codes
6. **Dependency Injection** - Sharing code across endpoints
7. **AsyncIO** - Introduction to async/await (optional)

### Why FastAPI is Better
1. **Speed** - 2-3x faster than Flask due to async support
2. **Automatic Validation** - Pydantic handles all request validation
3. **Auto Documentation** - Swagger UI and ReDoc built-in
4. **Type Safety** - Type hints catch errors early
5. **Dependency Injection** - Cleaner, more maintainable code
6. **Standards-Aligned** - OpenAPI (formerly Swagger) compatible

---

## Troubleshooting Common Issues

### Issue: "No module named 'flask'"
**Solution:**
```bash
pip install -r requirements.txt
```

### Issue: "FastAPI not found"
**Solution:**
```bash
pip install fastapi uvicorn[standard]
```

### Issue: Routes not working
**Solution:** Make sure you're including the router in `app.py`:
```python
app.include_router(my_router, prefix="/my-route", tags=["My Routes"])
```

### Issue: CORS errors
**Solution:** Check `app.py` has CORSMiddleware configured with correct origins

### Issue: Database connection failing
**Solution:** Check `.env` file has correct database credentials:
```
MYSQL_HOST=localhost
MYSQL_PORT=3306
MYSQL_USER=root
MYSQL_PASSWORD=your_password
MYSQL_DB=StudyBuddy
```

---

## Resources

- [FastAPI Official Documentation](https://fastapi.tiangolo.com/)
- [Pydantic Documentation](https://docs.pydantic.dev/)
- [ASGI Specification](https://asgi.readthedocs.io/)
- [OpenAPI Specification](https://spec.openapis.org/)

