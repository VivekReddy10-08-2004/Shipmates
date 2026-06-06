# Shipmates — Collaborative Study & Buddy Matching Platform

Shipmates is a premium, modern web application designed to help university students find study partners (buddies), form collaborative study groups, upload and share course resources, and practice with AI-generated quizzes and flashcards.

---

## 🚀 Key Features

- **Study Buddy Matching**: Find compatible peers based on major, colleges, and courses.
- **Study Groups & Chat**: Join study groups for specific courses, organize sessions, and chat in real-time.
- **Resource Sharing**: Upload, categorize, and download study guides, notes, and past exams.
- **Interactive Quizzes & Flashcards**: Create decks, practice with a beautiful card-flipping UI, and test knowledge with multiple-choice quizzes.
- **AI-Generated Materials**: Upload lecture notes or paste text to generate study sets automatically using OpenAI integration.
- **Robust Database Engine**: High-performance MySQL backend utilizing ACID transactions, stored procedures, and optimal query execution plans.

---

## 📁 Repository Structure

We structure this codebase cleanly separating responsibilities:

- [database/](file:///c:/Users/user/Desktop/COS430/Shipmates-main/Shipmates/database) — Relational MySQL schemas, stored procedures, data-cleansing scripts, and seeding notebooks.
- [backend/](file:///c:/Users/user/Desktop/COS430/Shipmates-main/Shipmates/backend) — FastAPI app with routes for authentication, matches, groups, chat, resources, quizzes, flashcards, and AI services.
- [frontend/](file:///c:/Users/user/Desktop/COS430/Shipmates-main/Shipmates/frontend) — Premium React & TypeScript SPA styled with HSL custom-tailored palettes, micro-interactions, and glassmorphism.

---

## 🛠️ Quick Start & Setup

### Prerequisites
- **Python 3.8+** with pip
- **Node.js 16+** with npm
- **MySQL 8.0+**

### 1. Database Setup
1. Ensure your MySQL server is running.
2. Build and populate the `Shipmates` database:
   ```bash
   cd database
   python build_database.py
   ```
   *(This script will prompt for your database port, username, password, and build the tables, stored procedures, and load initial cleaned datasets).*

### 2. Backend Setup & Run
1. Navigate to the backend directory:
   ```bash
   cd backend
   ```
2. Create your `.env` file (copy from `.env.example`) and configure your secrets:
   ```env
   SESSION_SECRET=your-session-secret-here
   OPENAI_API_KEY=your-api-key-here
   AI_GENERATE_PROVIDER=openai
   ```
3. Run the development server:
   ```bash
   python -m uvicorn app:create_app --port 8001 --reload
   ```
   The backend API will run at [http://127.0.0.1:8001](http://127.0.0.1:8001).

### 3. Frontend Setup & Run
1. Navigate to the frontend directory:
   ```bash
   cd frontend
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Run the Vite development server:
   ```bash
   npm run dev
   ```
   The frontend application will be hosted at [http://127.0.0.1:5173](http://127.0.0.1:5173).

---

## 🧪 Running Automated Tests

We maintain backend tests covering our API endpoints and AI services. To execute:

1. Navigate to the backend folder:
   ```bash
   cd backend
   ```
2. Run `pytest`:
   ```bash
   pytest
   ```

---



---