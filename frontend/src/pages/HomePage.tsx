// src/pages/HomePage.tsx
import { useEffect, useState } from "react";
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
  const { user, loading: userLoading } = useCurrentUser();
  const userId = user?.user_id ?? null;

  const [activeGroups, setActiveGroups] = useState(0);
  const [nextSession, setNextSession] = useState<Session | null>(null);
  const [streakDays, setStreakDays] = useState(0);

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

  useEffect(() => {
    if (!userId) {
      setActiveGroups(0);
      setNextSession(null);
      return;
    }
    async function loadDashboard() {
      try {
        const [myGroups, sessions] = await Promise.all([
          fetchMyGroups(userId),
          fetchUpcomingSessions(userId, 1),
        ]);
        setActiveGroups(Array.isArray(myGroups) ? myGroups.length : 0);
        const s: Session | null =
          Array.isArray(sessions) && sessions.length > 0 ? sessions[0]! : null;
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

  const formatSession = (session: Session | null) => {
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
    <div className="home-new">
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
        </div>
      </motion.section>

      <TreasureMap />

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
    </div>
  );
}
