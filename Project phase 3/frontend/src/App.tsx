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

function App() {
  return (
    <BrowserRouter>
      <NavBar />

      {/* Page content */}
            <Routes>
        {/* Default entry now points to Login page */}
        <Route path="/" element={<LoginPage />} />
        <Route path="/groups" element={<StudyGroups />} />
        <Route path="/match" element={<StudyBuddyMatch />} />

        {/* Keep Home accessible at an explicit route if needed */}
        <Route path="/home" element={<HomePage />} />

        <Route path="/flashcards" element={<FlashcardsPage />} />
        <Route path="/quizzes" element={<QuizzesPage />} />

        <Route path="/register" element={<RegisterPage />} />
        <Route path="/login" element={<LoginPage />} />

        <Route path="/user/account" element={<AccountPage />} />
        <Route path="/user/account/edit" element={<EditAccountPage />} />
        <Route path="/resources" element={<ResourcesPage />} />

        {/* <Route
          path="/"
          element={<div style={{ padding: "1.5rem" }}>Home page placeholder</div>}
        /> */}
        {/* Add routes below */}
      </Routes>

    </BrowserRouter>
  );
}

export default App;
