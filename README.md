# Shipmates

Shipmates is an **AI‑powered, course‑centric study app** that turns students’ notes into **shared quizzes and flashcards** they can study with classmates—plus lightweight collaboration features like **study groups**, **chat**, and **matching**.

> In one line: **Shipmates converts your course notes into collaborative flashcards and quizzes you can study with your classmates.**

---

## What’s in this repository

This repo contains multiple “project phases” (course deliverables). The most complete runnable web app lives in **Project phase 3**:

- **Phase 3 (Web App)**: FastAPI backend + Vite/React frontend (main runnable deliverable)
- **Phase 2 (Database + data tooling)**: MySQL schema, stored procedures, seed scripts, scrapers, and analysis
- **Phase 1**: early deliverables / planning artifacts

---

## Key features (direction)

Based on the product direction document in this repo, Shipmates focuses on:

- **Course spaces & study groups**: create/join course spaces and small groups
- **Notes → AI generation**: paste notes (or upload excerpts) to generate:
  - **Flashcards** (Q/A, definitions, key concepts)
  - **Quiz questions** (MCQ / short answer)
- **Collaborative decks**: review/edit/approve generated items, then share into course decks
- **Study modes**: flashcard practice + quiz taking
- **Light social**: group chat, sharing decks into groups, and simple study activity indicators

---

## Tech stack

**Primary languages in this repo**
- TypeScript (frontend and tooling)
- Python (backend + scripts)
- SQL (schema, procedures, queries)
- Jupyter Notebooks (analysis / experiments)
- CSS/HTML (frontend styling)

**Phase 3 Web App**
- **Frontend:** React + Vite
- **Backend:** **FastAPI** (Python) with:
  - CORS enabled for Vite dev server
  - **Signed session cookies** (Starlette `SessionMiddleware`)
  - Static hosting for uploaded files under `/uploads`
- **Database:** MySQL 8+

---

## Repository structure (high level)

- `Project phase 1/` — early phase materials
- `Project phase 2/` — database schema + data ingestion tooling
  - `sql/` — schema/procedures (see note below)
  - `scrapers/`, `data/`, `inserts/` — scraping + seed assets
  - `build_database.py` — script to build/seed DB (phase 2)
- `Project phase 3/` — web application (recommended starting point)
  - `backend/` — FastAPI server, routes, DB access, services, tests
  - `frontend/` — Vite/React UI

---

## Quickstart (Phase 3 web application)

### Prerequisites
- **Python 3.8+**
- **Node.js 16+**
- **MySQL 8.0+**
- (Recommended) Create a Python virtual environment

### 1) Create the database
You need a MySQL database (commonly named `StudyBuddy`) and the Phase 2 schema loaded.

From the Phase 3 README:
- Create a MySQL DB (e.g., `StudyBuddy`)
- Load schema from: `Project phase 2/sql/schema/` (see Phase 3 readme for details)

### 2) Run with the provided scripts (recommended)
From the repository root:

```bash
.\install_and_run.bat        # Windows
# OR
sh install_and_run.sh        # Linux/Mac
```

This should:
- install backend dependencies
- install frontend dependencies
- copy `.env.example` → `.env` (if present/needed)
- start backend on **http://127.0.0.1:8001**
- start frontend on **http://127.0.0.1:5173**
- seed a default admin account (if configured)

### 3) Run backend and frontend separately (optional)

**Backend**
```bash
cd "Project phase 3/backend"
.\install_and_run.bat        # Windows
# OR
sh install_and_run.sh        # Linux/Mac
```

**Frontend**
```bash
cd "Project phase 3/frontend"
.\install_and_run.bat        # Windows
# OR
sh install_and_run.sh        # Linux/Mac
```

---

## Configuration (Phase 3 backend)

### Backend environment variables
The backend loads environment variables from:

- `Project phase 3/backend/.env` (loaded relative to `backend/app.py`)

Important settings (based on `backend/app.py`):
- `SESSION_SECRET` (**required**) — used to sign session cookies  
  If missing, the backend will crash with a clear error telling you to set it.
- `ADMIN_USERNAME`, `ADMIN_PASSWORD` (optional) — if set, an admin user is auto-created on startup if it doesn’t exist.

### CORS / credentials
The backend enables CORS for Vite dev server ports (seen in `backend/app.py`), and uses cookie-based sessions, so frontend requests should include credentials.

---

## Default URLs (Phase 3)

- Frontend dev server: **http://127.0.0.1:5173**
- Backend API: **http://127.0.0.1:8001**
- Backend health check: `GET /` → `{ "status": "backend running" }`

---

## Backend API overview (Phase 3)

The FastAPI app registers routers roughly like:

- `/auth/*` — authentication (session-based)
- `/user/*` — user profile/account
- `/groups/*` — study groups + chat
  - Legacy alias: `GET /sessions/upcoming` maps to the same handler as the canonical upcoming-sessions endpoint
- `/courses/*` — course endpoints
- `/match/*` — matching endpoints
- `/messages/*` — direct messages
- `/quiz/*` — quizzes
- `/flashcards/*` — flashcards
- `/resources/*` — resource upload/listing
- (no prefix) AI generation router (see below)

### AI generation (stub)
Phase 3 documentation includes an **AI generate stub**:

- `POST /generate/from-notes`
- Example request:
```json
{
  "course_id": 1,
  "raw_text": "Binary search works on sorted arrays."
}
```

---

## Database work (Phase 2)

Phase 2 focuses on schema design, stored procedures, inserts/seeding, scraping, and performance analysis.

Notable artifacts:
- `Project phase 2/Quizzes&Flashcards.sql` — quiz/flashcard related schema
- `Project phase 2/build_database.py` — master script to create/build the DB using multiple schemas
- `Project phase 2/query_optimization_Test_Quizzes&Flashcards.py` — query optimization testing

---

## Change log / notable fixes

See:
- `SHIPMATES_CHANGE_LOG_2026-02-27.md`

This includes backend stabilization work (e.g., removing Flask-era route remnants, ensuring FastAPI routers import cleanly, adding missing deps like `email-validator`) and later notes on session-cookie auth alignment.

---

## Team / project context

See:
- `Team_tasks.md` — task split and suggested milestones
- `Shipmates-direction-2026` — product direction and key user flows

---

## Contributing

If you’re contributing locally:
1. Work inside `Project phase 3/` for the runnable app.
2. Keep DB changes documented and aligned with the Phase 2 schema organization.
3. Prefer small PRs and keep API request/response shapes documented.

---

## License

No license file is currently specified in this repository. If you plan to open-source Shipmates, add a `LICENSE` file (e.g., MIT, Apache-2.0) and update this README.
