# Shipmates Backend Change Report

**Created:** 2026-02-27 16:15:16 -05:00  
**Scope:** Fix backend startup/import failures and missing dependency in Project Phase 3 backend.

## Summary
The backend initially failed to start due to:
1. Missing `email-validator` dependency required by Pydantic email validation.
2. Multiple leftover Flask blueprint routes (`bp`, `quiz_bp`, `flashcard_bp`) in FastAPI route modules, causing `NameError` during imports.

These issues were fixed so the backend can boot successfully with Uvicorn.

## Files Changed and Why

### 1) `Project phase 3/backend/requirements.txt`
- **Change:** Added `email-validator`.
- **Why:** Pydantic models using email validation require this package; without it, app import fails with `ImportError: email-validator is not installed`.

### 2) `Project phase 3/backend/routes/studygroup_routes.py`
- **Change:** Replaced invalid Flask-style `@bp.route(...)` usage with FastAPI `@router...` endpoints.
- **Change:** Converted Flask request/response patterns (`request`, `jsonify`) to FastAPI-style parameters and `HTTPException` handling where applicable.
- **Why:** `bp` was undefined in FastAPI module context and caused startup failure.

### 3) `Project phase 3/backend/routes/match_routes.py`
- **Change:** Removed legacy Flask route blocks and duplicate/dead Flask logic.
- **Change:** Added/kept FastAPI-compatible image upload endpoint (`/profile/image`) using `UploadFile`.
- **Why:** Undefined Flask blueprint references caused import-time errors and duplicate legacy code increased breakage risk.

### 4) `Project phase 3/backend/routes/direct_message_routes.py`
- **Change:** Removed remaining Flask blueprint route blocks.
- **Change:** Added/kept FastAPI route for request response action (`/requests/{request_id}/{action}`) with query param handling and proper HTTP error mapping.
- **Why:** Eliminate Flask-only code paths and keep module import-safe under FastAPI.

### 5) `Project phase 3/backend/routes/resource_routes.py`
- **Change:** Removed Flask-specific upload/resource code (`session`, `request.files`, `jsonify`, `bp`).
- **Change:** Added FastAPI `upload-file` endpoint using `UploadFile` and DB insert flow.
- **Why:** Prevent undefined Flask symbol failures and keep upload flow compatible with current FastAPI app.

### 6) `Project phase 3/backend/routes/quiz_routes.py`
- **Change:** Removed legacy Flask `@quiz_bp.route(...)` sections and dead duplicate blocks.
- **Why:** `quiz_bp` was undefined and stopped module import.

### 7) `Project phase 3/backend/routes/flashcard_routes.py`
- **Change:** Removed legacy Flask `@flashcard_bp.route(...)` sections and duplicate/dead Flask code.
- **Why:** `flashcard_bp` references were invalid in FastAPI router module and caused import-time errors.

## Result
- Backend starts successfully after these fixes (Uvicorn app startup completed).
- Route modules no longer contain Flask blueprint decorators.
- Missing Pydantic email dependency issue is resolved.

## Notes
- This repository folder is not currently recognized as a Git repository in the tool environment, so this report is based on direct file edits performed in-session.


**Created:** 2026-02-27 20:56
- Changed the colors the webpage to reflect the USM husky colors. 

#TODO for frontend: Fix the texts, make all texts an independent variable which have nothing to do with the background. Every object/component should be of its own thing so changing the color can be an easier deal. 