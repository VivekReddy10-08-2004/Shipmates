// src/pages/HomePage.tsx
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { TypeAnimation } from "react-type-animation";
import { motion } from "framer-motion";

import TreasureMap from "../components/TreasureMap.js";
import useCurrentUser from "../hooks/useCurrentUser.js";
import { formatSession as fmtSession } from "../utils/dateFormat.js";
import {
  fetchMyGroups,
  fetchUpcomingSessions,
  type Session,
} from "../api/studygroups.js";

export default function HomePage() {
  const navigate = useNavigate();
  const { user, loading: userLoading } = useCurrentUser();
  const userId = user?.user_id ?? null;

  const [activeGroups, setActiveGroups] = useState(0);
  const [nextSession, setNextSession] = useState<Session | null>(null);
  const [streakDays, setStreakDays] = useState(0);

  // ---- streak tracker (per user, localStorage) ----
  useEffect(() => {
    if (!userId) {
      setStreakDays(0);
      return;
    }
    try {
      const today = new Date();
      const todayStr = today.toISOString().slice(0, 10);
      const key = `sb_streak_${userId}`;
      const raw = window.localStorage.getItem(key);

      let newCount = 1;
      let payload = { lastDate: todayStr, count: 1 };

      if (raw) {
        const parsed = JSON.parse(raw);
        const lastDate = parsed.lastDate;
        const prevCount = parsed.count || 1;

        if (lastDate === todayStr) {
          newCount = prevCount;
        } else {
          const last = new Date(lastDate);
          const diffMs = today.getTime() - last.getTime();
          const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
          newCount = diffDays === 1 ? prevCount + 1 : 1;
        }
        payload = { lastDate: todayStr, count: newCount };
      }

      window.localStorage.setItem(key, JSON.stringify(payload));
      setStreakDays(newCount);
    } catch (err) {
      console.error("Failed to update streak", err);
    }
  }, [userId]);

  // ---- load groups + next session ----
  useEffect(() => {
    if (!userId) {
      setActiveGroups(0);
      setNextSession(null);
      return;
    }
    async function loadDashboard() {
      try {
        const [myGroups, sessions] = await Promise.all([
          fetchMyGroups(userId!),
          fetchUpcomingSessions(userId, 1),
        ]);
        setActiveGroups(Array.isArray(myGroups) ? myGroups.length : 0);
        const s: Session | null =
          Array.isArray(sessions) && sessions.length > 0
            ? sessions[0]!
            : null;
        setNextSession(s);
      } catch (err) {
        console.error("Failed to load dashboard stats", err);
      }
    }
    loadDashboard();
  }, [userId]);

  const streakLabel =
    streakDays > 0
      ? `${streakDays} day${streakDays === 1 ? "" : "s"}`
      : "0 days";

  const formatSession = (session: any) => {
    if (!session) return { title: "No upcoming sessions", time: "" };
    const name = session.group_name || "Study session";
    const time = fmtSession({
      date: session.session_date,
      start_time: session.start_time,
      end_time: session.end_time,
    });
    return { title: name, time };
  };

  const sessionInfo = formatSession(nextSession);

  return (
<<<<<<< HEAD
    <div className="app-shell home-page">
      {/* floating background spheres */}
      <div className="home-floating-shapes" aria-hidden="true">
        <span className="shape-orb shape-orb-1" />
        <span className="shape-orb shape-orb-2" />
        <span className="shape-orb shape-orb-3" />
        <span className="shape-orb shape-orb-4" />
        <span className="shape-orb shape-orb-5" />
      </div>

      {/* top section */}
      <section className="hero hero-gamified">
        <div className="hero-left">
          <h1 className="page-title">Shipmates</h1>

          {/* description */}
          <p className="hero-subtitle">Study how you want.</p>

          <p className="hero-body-text">Welcome to Shipmates! Shipmates makes it
            easier for students to study. We offer many features such as study groups,
            quizzes, flashcards, and more! If you are a student looking for academic
            resources, click resources below. If you are looking to get started on studying,
            click view features below!</p>

          <div className="hero-actions">
            <button
              className="btn btn-primary"
              type="button"
              onClick={() => navigate("/resources")}
            >
              Go to Resources
            </button>

            <button
              className="btn btn-ghost btn-sm"
              type="button"
              onClick={() => {
                const el = document.getElementById("feature-grid");
                if (el) {
                  el.scrollIntoView({ behavior: "smooth", block: "start" });
                }
              }}
            >
              View features
            </button>
          </div>

          <div className="hero-badges">
            {/* Streak badge */}
            <div className="hero-badge">
              <span className="hero-badge-label">Streak</span>
              <span className="hero-badge-value">{streakLabel}</span>
            </div>

            {/* Active groups badge */}
            <div className="hero-badge">
              <span className="hero-badge-label">Active groups</span>
              <span className="hero-badge-value">{activeGroupsLabel}</span>
            </div>
          </div>
        </div>

        {/* status card */}
        <div className="hero-right">
          <div className="hero-orb">
            <div className="hero-orb-glow" />
            <div className="hero-orb-ring hero-orb-ring-outer" />
            <div className="hero-orb-ring hero-orb-ring-inner" />

            <div className="hero-status-card">
              <div className="hero-status-title">Next study session</div>

              <div className="hero-status-main">
                <div className="hero-status-course">{sessionTitle}</div>
                <div className="hero-status-time">{sessionTime}</div>
              </div>

              {/* Focus streak always shown, even if there is no session */}
              <div className="hero-progress-row">
                <span className="hero-progress-label">Focus streak</span>
                <span className="hero-progress-value">{streakLabel}</span>
              </div>
              <div className="hero-progress-bar">
                <span className="hero-progress-fill" />
              </div>

              <div className="hero-status-footer">
                <span>{sessionLocation}</span>
                <button
                  type="button"
                  className="btn btn-sm btn-primary hero-status-btn"
                  onClick={() => navigate("/groups")}
                >
                  View groups
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section
        id="feature-grid"
        style={{ marginTop: "2.5rem" }}
        aria-label="StudyBuddy Hub features"
      >
        <div className="feature-grid-header">
          <h2 className="feature-grid-title">Choose your path</h2>
          <p className="feature-grid-subtitle"> {/*p2 doesn't exist, so had to change it to jsut p - Rise*/}
            We offer many features in Shipmates. You can create your owner
            quizzes or flashcards, use our study tools, find or create a study
            group, or find the perfect sutdy partner on Shipmates Match!
          </p>
=======
    <div className="home-new">
      {/* Hero */}
      <motion.section
        className="home-hero"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
      >
        <h1 className="home-hero-title">Shipmates</h1>
        <div className="home-hero-subtitle">
          <TypeAnimation
            sequence={[
              "Find your crew.",
              2000,
              "Chart your course.",
              2000,
              "Set sail.",
              2000,
              "Conquer the seas of knowledge.",
              2500,
            ]}
            repeat={Infinity}
            speed={40}
            style={{ display: "inline-block" }}
          />
>>>>>>> ed7381045efd822ddca9b9363bc01a31b568ef21
        </div>
      </motion.section>

      {/* Treasure Map */}
      <TreasureMap />

      {/* Stats */}
      <div className="home-stats">
        <motion.div
          className="home-stat"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.0, duration: 0.4 }}
        >
          <span className="home-stat-icon">🔥</span>
          <div className="home-stat-info">
            <span className="home-stat-label">Voyage Streak</span>
            <span className="home-stat-value">{streakLabel}</span>
          </div>
        </motion.div>

        <motion.div
          className="home-stat"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.2, duration: 0.4 }}
        >
          <span className="home-stat-icon">⚓</span>
          <div className="home-stat-info">
            <span className="home-stat-label">Active Crews</span>
            <span className="home-stat-value">
              {userLoading || !userId ? "--" : String(activeGroups)}
            </span>
          </div>
        </motion.div>

<<<<<<< HEAD
            {/* keep card size but no description/list */}
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "0.5rem",
                marginTop: "1rem",
              }}
            >
              <button
                className="btn btn-primary feature-card-btn"
                type="button"
                disabled
              >
                Coming soon
              </button>
            </div>
          </section>

          {/* Study Groups & Collaboration */}
          <section
            className="card feature-card feature-card-gamified"
            style={{ minHeight: "260px" }}
          >
            <div className="feature-card-header">
              <div className="feature-card-title-row">
                <div className="feature-card-icon-placeholder">
                  <img src={NetworkIcon} alt="Study Groups logo" />
                </div>
                <div className="card-title">
                  Study Groups
                </div>
              </div>
            </div>

            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "0.5rem",
                marginTop: "1rem",
              }}
            >
              <button
                className="btn btn-primary feature-card-btn"
                type="button"
                onClick={() => navigate("/groups")}
              >
                Study Groups
              </button>
            </div>
          </section>

          {/* StudyBuddy Match */}
          <section
            className="card feature-card feature-card-gamified"
            style={{ minHeight: "260px" }}
          >
            <div className="feature-card-header">
              <div className="feature-card-title-row">
                <div className="feature-card-icon-placeholder">
                  <img src={MatcherIcon} alt="StudyBuddy Match logo" />
                </div>
                <div className="card-title">Shipmates Match</div>
              </div>
            </div>

            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "0.5rem",
                marginTop: "1rem",
              }}
            >
              <button
                className="btn btn-primary feature-card-btn"
                type="button"
                onClick={() => navigate("/match")}
              >
                Shipmates Match
              </button>
            </div>
          </section>
        </div>
      </section>
=======
        <motion.div
          className="home-stat"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.4, duration: 0.4 }}
        >
          <span className="home-stat-icon">🧭</span>
          <div className="home-stat-info">
            <span className="home-stat-label">Next Session</span>
            <span className="home-stat-value">{sessionInfo.title}</span>
            {sessionInfo.time && (
              <span className="home-stat-time">{sessionInfo.time}</span>
            )}
          </div>
        </motion.div>
      </div>
>>>>>>> ed7381045efd822ddca9b9363bc01a31b568ef21
    </div>
  );
}
