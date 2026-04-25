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

import ShipmatesLogo from "../assets/shipmates_logo.png";

export default function NavBar() {
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
<<<<<<< HEAD
    <header className="navbar">
      <div className="nav-left">
        {/* <span className="nav-logo-dot" /> */}
        <img className="nav-logo-img" src={ShipmatesLogo} alt="Shipmates logo"/>
        <span className="nav-title">Shipmates</span>
      </div>
=======
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
>>>>>>> ed7381045efd822ddca9b9363bc01a31b568ef21

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
            </nav>

<<<<<<< HEAD
        <NavLink
          to="/quizzes"
          className={({ isActive }) =>
            "nav-link" + (isActive ? " nav-link-active" : "")
          }
        >
          Quizzes
        </NavLink>

        <NavLink
          to="/match"
          className={({ isActive }) =>
            "nav-link" + (isActive ? " nav-link-active" : "")
          }
        >
          Shipmates Match
        </NavLink>

        <NavLink
          to="/flashcards"
          className={({ isActive }) =>
            "nav-link" + (isActive ? " nav-link-active" : "")
          }
        >
          Flashcards
        </NavLink>


        <NavLink
          to="/user/account"
          className={({ isActive }) =>
            "nav-link" + (isActive ? " nav-link-active" : "")
          }
          end
        >
          Account
        </NavLink>

      </nav>
    </header>
=======
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
    </>
>>>>>>> ed7381045efd822ddca9b9363bc01a31b568ef21
  );
}
