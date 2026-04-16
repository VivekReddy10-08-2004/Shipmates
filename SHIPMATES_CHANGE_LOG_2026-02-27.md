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

---

## 2026-04-01 — Auth (session cookies) and study groups API fixes

**Scope:** Settle a single auth approach for Phase 3, align `/user/account` with the frontend, and fix study group “my groups” / upcoming sessions endpoints that returned 404/500.

### Summary
1. **Authentication:** Server-side **signed session cookies** (Starlette `SessionMiddleware`) so `POST /auth/login` establishes a session and `POST /auth/logout` clears it. Protected profile routes use the session instead of trusting `user_id` query parameters on `/user/account`.
2. **Study groups:** Removed dead Flask-era code, registered **upcoming sessions** under the correct prefix, added a **legacy alias** for old clients, and replaced **`callproc`** for “mine” / upcoming with **parameterized SQL** matching the project schema so routes work even if MySQL stored procedures are not installed.

### Files changed and why

#### `Project phase 3/backend/deps.py` (new)
- **`get_current_user_id`:** Reads `user_id` from the session; returns **401** if missing. Used by account routes that require a logged-in user.

#### `Project phase 3/backend/app.py`
- **`SessionMiddleware`** with `SESSION_SECRET` from environment (fallback for local dev only).
- **Middleware order:** Session inner, CORS outer; `allow_credentials=True` kept for cross-port localhost with the Vite dev server.
- **Legacy route:** `GET /sessions/upcoming` registered to the same handler as `GET /groups/sessions/upcoming` for older frontend paths.

#### `Project phase 3/backend/routes/auth_routes.py`
- **Login** sets `request.session["user_id"]` after password verification.
- **`POST /auth/logout`** clears the session (pairs with frontend `logoutUser()`).

#### `Project phase 3/backend/routes/user_routes.py`
- **`GET` / `PUT` `/user/account`** use **`Depends(get_current_user_id)`** instead of a required `user_id` query parameter.

#### `Project phase 3/backend/.env.example`
- Documents **`SESSION_SECRET`** for signing session cookies (copy to `.env` for non-default setups).

#### `Project phase 3/backend/routes/studygroup_routes.py`
- **`_json_friendly`:** Normalizes MySQL values (e.g. `Decimal`, `bytes`) for JSON responses.
- **`SQL_GET_USER_GROUPS` / `SQL_GET_UPCOMING_SESSIONS`:** Inline SQL equivalent to `GetUserGroups` / `GetUpcomingSessionsForUser` procedures.
- **`GET /groups/mine`:** Uses `execute()` + `SQL_GET_USER_GROUPS` instead of `callproc`.
- **`GET /groups/sessions/upcoming`:** Uses `execute()` + `SQL_GET_UPCOMING_SESSIONS` instead of `callproc`.
- Removed unreachable Flask-style block that previously prevented a real FastAPI route for upcoming sessions.

#### `Project phase 3/frontend/src/api/auth.ts`
- Error messages prefer FastAPI’s **`detail`** (and validation error shapes) over a nonstandard `error` field.

#### `Project phase 3/frontend/src/pages/User.tsx`
- Edit-account load uses **`API_BASE`** instead of a hardcoded `127.0.0.1:8001` URL.

#### `Project phase 3/frontend/src/api/studygroups.ts`
- **`fetchUpcomingSessions`** calls **`/groups/sessions/upcoming`** (canonical backend path).
- **`joinGroup`** sends **`user_id` as a query parameter** to match `POST /groups/{id}/join?user_id=...`.
- **`apiFetch`** sends **`credentials: "include"`** so session cookies are sent on group API calls.

### Result
- Login + logout + account pages can rely on a **consistent session-based** auth story; `/user/account` matches how the frontend already used `credentials: "include"`.
- **`GET /groups/mine`** and **`GET /groups/sessions/upcoming`** return **200** with JSON lists when the DB schema/tables match the project SQL (empty list when the user has no rows).

### Notes
- Other routes may still accept **`user_id` in the query/body**; tightening those to the session user is a possible follow-up for API security.
- Set a strong **`SESSION_SECRET`** in production; do not rely on the dev default in `app.py`.