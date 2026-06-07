import { useEffect, useState } from "react";
import { NavLink } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  GiShipWheel,
  GiPirateFlag,
  GiScrollUnfurled,
  GiAnchor,
  GiBookCover,
  GiPirateHat,
  GiCompass,
} from "react-icons/gi";
import { MdChevronLeft, MdMenu } from "react-icons/md";

import ShipmatesLogo from "../assets/shipmates_logo.png";

const STORAGE_KEY = "sb_sidebar_hidden";

type NavItem = {
  to: string;
  label: string;
  Icon: React.ComponentType<{ size?: number }>;
  end?: boolean;
};

const navItems: NavItem[] = [
  { to: "/home", label: "Home", Icon: GiShipWheel, end: true },
  { to: "/groups", label: "Study Crews", Icon: GiPirateFlag },
  { to: "/quizzes", label: "Quizzes", Icon: GiScrollUnfurled },
  { to: "/match", label: "The Dock", Icon: GiAnchor },
  { to: "/flashcards", label: "Flashcards", Icon: GiBookCover },
  { to: "/user/account", label: "Account", Icon: GiPirateHat, end: true },
];

export default function NavBar() {
  const [showAbout, setShowAbout] = useState<boolean>(false);
  const [hidden, setHidden] = useState<boolean>(() => {
    try {
      return window.localStorage.getItem(STORAGE_KEY) === "1";
    } catch {
      return false;
    }
  });

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, hidden ? "1" : "0");
    } catch {
      /* ignore */
    }
    // Toggle body class so page content can adjust its padding
    document.body.classList.toggle("sidebar-hidden", hidden);
  }, [hidden]);

  return (
    <>
      {/* Tiny toggle tab that stays visible when sidebar is hidden */}
      <AnimatePresence>
        {hidden && (
          <motion.button
            key="show-tab"
            className="side-rail-show-tab"
            onClick={() => setHidden(false)}
            initial={{ x: -40, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: -40, opacity: 0 }}
            transition={{ duration: 0.25 }}
            aria-label="Show navigation"
          >
            <MdMenu size={22} />
          </motion.button>
        )}
      </AnimatePresence>

      {/* Side rail */}
      <AnimatePresence>
        {!hidden && (
          <motion.aside
            key="side-rail"
            className="side-rail"
            initial={{ x: -260, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: -260, opacity: 0 }}
            transition={{ duration: 0.3, ease: "easeInOut" }}
          >
            {/* Logo + title at top */}
            <div className="side-rail-brand">
              <img
                className="side-rail-logo"
                src={ShipmatesLogo}
                alt="Shipmates logo"
              />
              <span className="side-rail-title">Shipmates</span>
            </div>

            {/* Nav links */}
            <nav className="side-rail-nav">
              {navItems.map(({ to, label, Icon, end }) => (
                <NavLink
                  key={to}
                  to={to}
                  end={end ?? false}
                  className={({ isActive }) =>
                    "side-rail-link" + (isActive ? " side-rail-link-active" : "")
                  }
                >
                  <span className="side-rail-icon">
                    <Icon size={22} />
                  </span>
                  <span className="side-rail-label">{label}</span>
                </NavLink>
              ))}
              <button
                type="button"
                className="side-rail-link"
                style={{ background: "none", border: "none", width: "100%", textAlign: "left", cursor: "pointer" }}
                onClick={() => setShowAbout(true)}
              >
                <span className="side-rail-icon">
                  <GiCompass size={22} />
                </span>
                <span className="side-rail-label">About</span>
              </button>
            </nav>

            {/* Hide button at bottom */}
            <button
              type="button"
              className="side-rail-hide-btn"
              onClick={() => setHidden(true)}
              aria-label="Hide navigation"
            >
              <MdChevronLeft size={18} />
              <span>Hide</span>
            </button>
          </motion.aside>
        )}
      </AnimatePresence>

      {/* About Modal */}
      {showAbout && (
        <div className="modal-backdrop" onClick={() => setShowAbout(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ border: "2px solid var(--gold)" }}>
            <h2 style={{ fontFamily: "var(--font-heading)", color: "var(--gold)", textAlign: "center", borderBottom: "1px solid var(--border)", paddingBottom: "10px" }}>
              ⚔️ About Shipmates ⚔️
            </h2>
            <div style={{ padding: "10px 0", lineHeight: "1.6", color: "var(--text-main)" }}>
              <p style={{ fontStyle: "italic", textAlign: "center", marginBottom: "1.5rem" }}>
                "Find your crew. Chart your course. Set sail. Conquer the seas of knowledge."
              </p>
              <p>
                Welcome aboard, Captain! <strong>Shipmates</strong> is a study buddy matching and collaboration platform themed around nautical voyage, designed to help students navigate the challenging waters of academia together.
              </p>
              <ul style={{ paddingLeft: "20px", marginTop: "10px" }}>
                <li style={{ marginBottom: "8px" }}>
                  <strong>⚓ Find Your Crew:</strong> Match with study partners at the Dock or form Study Crews for group learning.
                </li>
                <li style={{ marginBottom: "8px" }}>
                  <strong>📜 Quizzes & Flashcards:</strong> Master course topics by charting study guides, playing quizzes, or letting the ship's AI draft practice materials for you.
                </li>
                <li style={{ marginBottom: "8px" }}>
                  <strong>📂 Cargo Hold (Resources):</strong> Share study links, notes, and PDFs with your crew mates.
                </li>
                <li style={{ marginBottom: "8px" }}>
                  <strong>🔥 Voyage Streaks:</strong> Stay consistent on your educational voyages to keep your streak burning!
                </li>
              </ul>
            </div>
            <div className="modal-actions" style={{ justifyContent: "center" }}>
              <button className="btn btn-primary" onClick={() => setShowAbout(false)}>
                Aboard!
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
