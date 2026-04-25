// src/App.jsx
import { BrowserRouter, Routes, Route } from "react-router-dom";
import HomePage from "./pages/HomePage.js";
import StudyGroups from "./pages/StudyGroups.js";
import FlashcardsPage from "./pages/FlashcardsPage.js";
import QuizzesPage from "./pages/QuizzesPage.js";
import ResourcesPage from "./pages/ResourcesPage.js";

import { RegisterPage, LoginPage } from "./pages/Auth.js"; 
import { AccountPage, EditAccountPage } from "./pages/User.js"; 

import NavBar from "./components/NavBar.js";
import StudyBuddyMatch from "./pages/StuddyBuddyMatch.js";
import RequireAuth from "./components/RequireAuth.js";
import GlobalShipsLog from "./components/GlobalShipsLog.js";

function App() {
  return (
    <BrowserRouter>
      <NavBar />

      {/* Global Ship's Log — renders on every authed page (component self-gates) */}
      <GlobalShipsLog />

      {/* Page content — wrapper class handles shifting when sidebar is open */}
      <div className="page-content">
        <Routes>
        {/* Public — anyone can hit these */}
        <Route path="/" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/login" element={<LoginPage />} />

        {/* Protected — requires login; redirects to /login if not authed */}
        <Route path="/home" element={<RequireAuth><HomePage /></RequireAuth>} />
        <Route path="/groups" element={<RequireAuth><StudyGroups /></RequireAuth>} />
        <Route path="/match" element={<RequireAuth><StudyBuddyMatch /></RequireAuth>} />
        <Route path="/flashcards" element={<RequireAuth><FlashcardsPage /></RequireAuth>} />
        <Route path="/quizzes" element={<RequireAuth><QuizzesPage /></RequireAuth>} />
        <Route path="/user/account" element={<RequireAuth><AccountPage /></RequireAuth>} />
        <Route path="/user/account/edit" element={<RequireAuth><EditAccountPage /></RequireAuth>} />
        <Route path="/resources" element={<RequireAuth><ResourcesPage /></RequireAuth>} />
        
        {/* <Route
          path="/"
          element={<div style={{ padding: "1.5rem" }}>Home page placeholder</div>}
        /> */}
        {/* Add routes below */}
        </Routes>
      </div>

    </BrowserRouter>
  );
}

export default App;
