# Shipmates — Team task split (3 devs)

**Roles**

| Person | Focus |
|--------|--------|
| **R** | Frontend (React/Vite, UX, API integration, polish) |
| **V** | Backend — APIs, DB procedures, auth/session, deployment glue |
| **J** | Backend / core logic — matching, AI pipeline, transactions, algorithms |

Use this doc as a working checklist. Adjust owners if V/J prefer to swap specific items; keep **one owner per bullet** to avoid duplicate work.

---

## Shared (everyone)

- [ ] Agree on **API contracts** (request/response shapes) before large features; document in `readme.md` or OpenAPI stubs.
- [ ] **Branch strategy**: `main` + short-lived feature branches; PR review before merge.
- [ ] **Definition of done**: feature works locally, basic happy-path tested, no console errors on touched pages.

---

## R — Frontend

**Owns:** UI/UX, components, hooks, calling backend, loading/error states, accessibility basics.

### Near-term (foundation)

- [ ] **API base & env**: Ensure `VITE_API_BASE` is documented; consistent error handling in `api/*.ts`.
- [ ] **Auth flow**: Login/register/account pages aligned with backend session or token strategy (whatever V finalizes).
- [ ] **Navigation**: Routes in `App.tsx` + `NavBar` — clear paths for courses, groups, match, quizzes, flashcards, resources.

### Product (direction-aligned)

- [ ] **Notes input UI**: Paste + optional file upload for a **selected course** (wire to J’s generate endpoint when ready).
- [ ] **AI review screen**: List generated flashcards/quizzes; edit, delete, approve/reject before save (pairs with J’s draft model).
- [ ] **Study modes**: Polish `TakeQuiz`, `PracticeFlashcards` — empty states, scoring feedback, mobile-friendly layout.
- [ ] **Study groups**: `StudyGroups.tsx` — keep in sync with group/member/invite APIs (coordinate with V).
- [ ] **Matching UI**: `StuddyBuddyMatch` — surfaces schedule, subjects, commitment (copy + fields) per direction doc; emphasize goals over photos.

### Polish & course deliverables

- [ ] **Loading/skeleton** states on list-heavy pages.
- [ ] **Tailwind or design system** (if team adopts): migrate critical screens consistently.
- [ ] **Screenshots / demo script** for final presentation.

---

## V — Backend (APIs, DB, infra)

**Owns:** FastAPI routes, MySQL, stored procedures coordination, security basics, server config.

### Near-term

- [ ] **Environment**: `.env.example` with DB, CORS origins, secrets; document run commands (`uvicorn`, `py -m pip`).
- [ ] **Auth**: Solidify login/register/session or JWT — one approach; document for R.
- [ ] **CORS & static uploads**: Confirm `uploads/` and origins for Vite dev ports.
- [ ] **Routers health**: Ensure all included routers import cleanly; fix any broken routes after refactors.

### Data & APIs

- [ ] **Course & user endpoints**: Stable CRUD or read endpoints R needs for dropdowns and profile.
- [ ] **Study groups**: Endpoints for members, invites, join requests — match frontend `studygroups.ts` contracts.
- [ ] **Quizzes / flashcards**: CRUD + list/detail aligned with `quiz_routes` / `flashcard_routes` and R’s forms.
- [ ] **Resources**: If in scope, list/upload metadata endpoints.

### Ops & quality

- [ ] **Requirements**: Keep `requirements.txt` in sync with actual imports.
- [ ] **Error responses**: Consistent `{ "detail": "..." }` and status codes for R to parse.
- [ ] **Deployment notes**: How to run backend + DB for demo (even if local-only).

---

## J — Backend / core logic

**Owns:** Algorithms, AI integration, heavy business rules, transactions that span multiple tables.

### Matching (direction doc)

- [ ] **Scoring model**: Weight schedule overlap, shared courses/subjects, commitment vs. lightweight profile fields.
- [ ] **Group size**: Support suggesting pairs and groups of 2–4 where data allows.
- [ ] **API surface**: Inputs/outputs for match endpoints; document edge cases (no matches, ties).

### Generative AI (core differentiator)

- [ ] **Service design**: Module that accepts **raw note text** (+ `course_id`, optional `user_id`) and returns **draft** flashcards and/or quiz questions.
- [ ] **Provider**: OpenAI (or similar) with env API key; timeouts, token limits, cost-conscious defaults.
- [ ] **Persistence**: Draft vs. approved content — either new tables or flags; coordinate with V on migrations.
- [ ] **Quality guardrails**: Post-process (dedupe, max items per request), validation before DB insert.

### Transactions & integrity

- [ ] **Reuse/extend** `utils/transactions.py` for any new multi-step writes (e.g. approve AI batch → insert sets).
- [ ] **Stored procedures**: New or updated procedures for group/match/AI flows as needed.

### Evaluation (course requirement)

- [ ] **Test plan** for AI output: sample notes, rubric (accuracy, relevance), 1–2 page summary for report.
- [ ] **Automated tests** where feasible: unit tests for scoring/parsing; smoke test for generate endpoint (mocked provider).

---

## Suggested milestones (team)

| Milestone | R | V | J |
|-----------|---|---|---|
| **M1 — Stable vertical slice** | Auth + one course-scoped page calling real API | Auth + DB stable; CORS/env docs | Stub “generate” endpoint returning mock JSON |
| **M2 — AI path** | Notes UI + review/approve flow | Tables/endpoints for drafts + approve | Real LLM integration + persistence |
| **M3 — Matching v2** | Matching UI reflects new fields | APIs store schedule/subjects | Scoring + group suggestions |
| **M4 — Demo** | Polish + demo script | Deploy/runbook | Evaluation writeup + tests |

---

## Communication

- **Daily (async)**: Short standup — what I did, what’s next, blockers.
- **Blockers**: Post in team channel with API route name + request/response example.
- **API changes**: V posts updated shape; R updates `api/*.ts` same day.

---

*Generated for Shipmates (COS430). Update this file as scope changes.*
