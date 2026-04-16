import { NavLink } from "react-router-dom";

import ShipmatesLogo from "../assets/shipmates_logo.png";

export default function NavBar() {
  return (
    <header className="navbar">
      <div className="nav-left">
        {/* <span className="nav-logo-dot" /> */}
        <img className="nav-logo-img" src={ShipmatesLogo} alt="Shipmates logo"/>
        <span className="nav-title">Shipmates</span>
      </div>

      <nav className="nav-right">
        <NavLink
          to="/home"
          className={({ isActive }) =>
            "nav-link" + (isActive ? " nav-link-active" : "")
          }
          end
        >
          Home
        </NavLink>

        {/* NEW: Study Groups tab */}
        <NavLink
          to="/groups"
          className={({ isActive }) =>
            "nav-link" + (isActive ? " nav-link-active" : "")
          }
        >
          Study Groups
        </NavLink>

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
  );
}
