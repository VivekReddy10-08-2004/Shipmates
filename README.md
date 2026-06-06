# ⛵ Shipmates — Collaborative Study & Buddy Matching Platform

Shipmates is a premium, modern academic collaboration platform that helps university students find study buddies, form course-centric groups, share learning materials, and practice with AI-generated study aids.

By automatically transforming lecture notes and course materials into interactive, shareable quizzes and flashcards, Shipmates fosters seamless peer collaboration and structured learning.

---

## 🌟 Key Features

*   **Study Buddy Matching:** Find compatible peers based on college, major, and course profiles.
*   **Course Spaces & Groups:** Join course-specific channels, coordinate study sessions, and chat in real-time.
*   **Resource Repository:** Upload, categorize, and download study guides, past exams, and notes.
*   **Interactive Study Modes:** Practice with a fluid flashcard-flipping interface and test your understanding with scored quizzes.
*   **AI-Driven Content Generation:** Generate clean flashcard decks and quiz banks dynamically from uploaded notes or text using OpenAI.
*   **Robust Database Architecture:** Engineered on MySQL with ACID transaction safety, optimized indexes, stored procedures, and triggers.

---

## 📁 Project Architecture

The codebase has been reorganized into a clean, modern software structure:

*   📂 [**database/**](./database) — MySQL schemas, stored procedures, data-cleansing scripts, and seeding notebooks.
*   📂 [**backend/**](./backend) — High-performance FastAPI (Python) server handling authentication, match algorithms, groups, and AI services.
*   📂 [**frontend/**](./frontend) — Single Page App (SPA) built with React + Vite (TypeScript), styled with premium, responsive visual patterns.

---

## 🛠️ Quick Start & Setup

### Prerequisites
- **Python 3.8+**
- **Node.js 16+**
- **MySQL 8.0+**

### 1. Database Setup
1. Ensure your MySQL server is running.
2. Build and seed the `Shipmates` database:
   ```bash
   cd database
   python build_database.py
   ```
   *(The script will walk you through your MySQL credentials, build the tables and stored procedures, and load cleaned datasets).*

### 2. Backend Setup
1. Navigate to the backend directory:
   ```bash
   cd backend
   ```
2. Create a `.env` file (copied from `.env.example`) and configure your session keys and credentials:
   ```env
   SESSION_SECRET=your_long_random_session_secret_hex
   OPENAI_API_KEY=your_openai_api_key_here
   AI_GENERATE_PROVIDER=openai
   ```
3. Run the API dev server:
   ```bash
   python -m uvicorn app:create_app --port 8001 --reload
   ```
   The API will be available at [http://127.0.0.1:8001](http://127.0.0.1:8001).

### 3. Frontend Setup
1. Navigate to the frontend directory:
   ```bash
   cd frontend
   ```
2. Install frontend dependencies:
   ```bash
   npm install
   ```
3. Start the Vite development server:
   ```bash
   npm run dev
   ```
   The web interface will be hosted at [http://127.0.0.1:5173](http://127.0.0.1:5173).

---

## 🧪 Running Automated Tests

A comprehensive unit testing suite is configured for API and AI validation. To run:

1. Navigate to the backend folder:
   ```bash
   cd backend
   ```
2. Run tests using `pytest`:
   ```bash
   pytest
   ```

---

