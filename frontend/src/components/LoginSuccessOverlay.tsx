import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Wave from "react-wavify";

import ShipmatesLogo from "../assets/shipmates_logo.png";

interface Props {
  show: boolean;
  captainName?: string;
  onComplete: () => void;
}

/*
 * Full-screen "rising tide" login success animation:
 *  - Tide rises from the bottom with foam + bubbles + gold sparkles
 *  - Logo fades/scales in with a gold glow pulse
 *  - "Welcome aboard, Captain ___!" types in
 *  - Holds briefly, then onComplete() fires (navigate to /home)
 */
export default function LoginSuccessOverlay({
  show,
  captainName,
  onComplete,
}: Props) {
  const [phase, setPhase] = useState<"tide" | "logo" | "welcome" | "done">(
    "tide",
  );

  useEffect(() => {
    if (!show) return;
    setPhase("tide");

    const t1 = setTimeout(() => setPhase("logo"), 1200); // tide mostly up
    const t2 = setTimeout(() => setPhase("welcome"), 2000); // logo settled
    const t3 = setTimeout(() => setPhase("done"), 4200); // hold then leave
    const t4 = setTimeout(() => onComplete(), 4600); // after exit anim

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
      clearTimeout(t4);
    };
  }, [show, onComplete]);

  const welcomeText = captainName
    ? `Welcome aboard, Captain ${captainName}!`
    : "Welcome aboard, Captain!";

  // Bubble positions — static random positions so they don't reshuffle each render
  const bubbles = [
    { x: 8, size: 6, delay: 0 },
    { x: 18, size: 4, delay: 0.3 },
    { x: 28, size: 8, delay: 0.7 },
    { x: 38, size: 5, delay: 0.1 },
    { x: 48, size: 7, delay: 0.5 },
    { x: 58, size: 4, delay: 0.9 },
    { x: 68, size: 6, delay: 0.2 },
    { x: 78, size: 5, delay: 0.6 },
    { x: 88, size: 7, delay: 0.4 },
    { x: 14, size: 3, delay: 1.0 },
    { x: 34, size: 4, delay: 0.8 },
    { x: 54, size: 3, delay: 1.2 },
    { x: 74, size: 5, delay: 0.55 },
    { x: 92, size: 4, delay: 1.1 },
  ];

  // Gold sparkle positions
  const sparkles = [
    { x: 12, delay: 0.2, size: 4 },
    { x: 24, delay: 0.5, size: 3 },
    { x: 36, delay: 0.8, size: 5 },
    { x: 45, delay: 0.3, size: 3 },
    { x: 58, delay: 0.6, size: 4 },
    { x: 70, delay: 0.9, size: 3 },
    { x: 82, delay: 0.4, size: 5 },
    { x: 90, delay: 0.7, size: 3 },
  ];

  return (
    <AnimatePresence>
      {show && phase !== "done" && (
        <motion.div
          className="login-success-overlay"
          initial={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.4 }}
        >
          {/* Rising water column */}
          <motion.div
            className="tide-water"
            initial={{ height: 0 }}
            animate={{ height: "100%" }}
            transition={{ duration: 1.6, ease: [0.4, 0, 0.2, 1] }}
          >
            {/* Top wave foam */}
            <Wave
              fill="rgba(255, 255, 255, 0.6)"
              paused={false}
              style={{ position: "absolute", top: -18, width: "100%", height: 30 }}
              options={{ height: 8, amplitude: 12, speed: 0.3, points: 5 }}
            />
            {/* Secondary foam */}
            <Wave
              fill="rgba(255, 255, 255, 0.3)"
              paused={false}
              style={{ position: "absolute", top: -10, width: "100%", height: 24 }}
              options={{ height: 6, amplitude: 14, speed: 0.4, points: 4 }}
            />

            {/* Bubbles rising inside the water */}
            <div className="bubbles">
              {bubbles.map((b, i) => (
                <motion.div
                  key={i}
                  className="bubble"
                  style={{
                    left: `${b.x}%`,
                    width: `${b.size}px`,
                    height: `${b.size}px`,
                  }}
                  initial={{ y: 0, opacity: 0 }}
                  animate={{ y: -400, opacity: [0, 0.8, 0.6, 0] }}
                  transition={{
                    duration: 3,
                    delay: b.delay,
                    repeat: Infinity,
                    ease: "easeOut",
                  }}
                />
              ))}
            </div>

            {/* Gold sparkles floating up */}
            <div className="sparkles">
              {sparkles.map((s, i) => (
                <motion.div
                  key={i}
                  className="sparkle"
                  style={{
                    left: `${s.x}%`,
                    width: `${s.size}px`,
                    height: `${s.size}px`,
                  }}
                  initial={{ y: 0, opacity: 0, scale: 0 }}
                  animate={{
                    y: -500,
                    opacity: [0, 1, 1, 0],
                    scale: [0, 1, 1, 0.5],
                  }}
                  transition={{
                    duration: 3.5,
                    delay: s.delay,
                    repeat: Infinity,
                    ease: "easeOut",
                  }}
                />
              ))}
            </div>
          </motion.div>

          {/* Logo + welcome text */}
          <div className="login-success-content">
            <AnimatePresence>
              {(phase === "logo" || phase === "welcome") && (
                <motion.div
                  key="logo"
                  className="login-logo-wrap"
                  initial={{ opacity: 0, scale: 0.6, y: 20 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.8, ease: [0.34, 1.56, 0.64, 1] }}
                >
                  <div className="login-logo-glow" />
                  <img
                    className="login-logo-img"
                    src={ShipmatesLogo}
                    alt="Shipmates"
                  />
                </motion.div>
              )}
            </AnimatePresence>

            {/* Slot reserves vertical space so the logo doesn't shift when text appears */}
            <div className="login-welcome-text-slot">
              <AnimatePresence>
                {phase === "welcome" && (
                  <motion.div
                    key="welcome"
                    className="login-welcome-text"
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 1.0, ease: "easeOut" }}
                  >
                    {welcomeText}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
