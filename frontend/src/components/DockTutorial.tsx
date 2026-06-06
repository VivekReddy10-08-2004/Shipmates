import { useEffect, useLayoutEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

export interface TourStep {
  /** CSS selector for the element to highlight. Optional for intro/outro steps. */
  target?: string;
  title: string;
  body: string;
  /** Where the tooltip sits relative to the target */
  placement?: "top" | "bottom" | "left" | "right";
  /** Icon shown in the tooltip header */
  icon?: string;
}

interface Props {
  active: boolean;
  steps: TourStep[];
  onClose: () => void;
}

const PAD = 8; // padding around the highlighted element

export default function DockTutorial({ active, steps, onClose }: Props) {
  const [stepIdx, setStepIdx] = useState(0);
  const [rect, setRect] = useState<DOMRect | null>(null);

  const step = steps[stepIdx];

  // Re-measure target element whenever step changes or viewport changes.
  // Only depend on active + stepIdx (primitive) to avoid render loops from
  // `step` being a new object reference every render.
  const target = step?.target;
  useLayoutEffect(() => {
    if (!active) return;

    // Clear previous rect so stale spotlight doesn't show on new step
    setRect(null);

    let scrollCount = 0;
    function measure() {
      if (!target) {
        setRect(null);
        return;
      }
      const el = document.querySelector(target) as HTMLElement | null;
      if (!el) {
        setRect(null);
        return;
      }
      const r = el.getBoundingClientRect();

      // If the element is too close to viewport edges, scroll it into view.
      // Re-scroll a few times in case the first scroll happened before the
      // element finished laying out.
      const vh = window.innerHeight;
      const needsScroll =
        r.top < 80 || r.bottom > vh - 80 || r.width === 0 || r.height === 0;
      if (needsScroll && scrollCount < 4) {
        scrollCount++;
        el.scrollIntoView({ behavior: "smooth", block: "center" });
      }

      // Skip updating if zero-size (element not laid out yet)
      if (r.width === 0 && r.height === 0) return;

      setRect((prev) => {
        if (
          prev &&
          Math.abs(prev.top - r.top) < 0.5 &&
          Math.abs(prev.left - r.left) < 0.5 &&
          Math.abs(prev.width - r.width) < 0.5 &&
          Math.abs(prev.height - r.height) < 0.5
        ) {
          return prev;
        }
        return r;
      });
    }

    // Kick off the first measure after a small delay so the new DOM
    // (e.g. just-revealed form sections) has time to lay out.
    const kick = setTimeout(measure, 50);
    const followUp1 = setTimeout(measure, 250);
    const followUp2 = setTimeout(measure, 600);

    window.addEventListener("resize", measure);
    window.addEventListener("scroll", measure, true);
    const interval = setInterval(measure, 250);
    return () => {
      clearTimeout(kick);
      clearTimeout(followUp1);
      clearTimeout(followUp2);
      window.removeEventListener("resize", measure);
      window.removeEventListener("scroll", measure, true);
      clearInterval(interval);
    };
  }, [active, stepIdx, target]);

  // Reset step when tour activates
  useEffect(() => {
    if (active) setStepIdx(0);
  }, [active]);

  if (!active || !step) return null;

  const isLast = stepIdx === steps.length - 1;

  function handleNext() {
    if (isLast) {
      onClose();
    } else {
      setStepIdx((i) => i + 1);
    }
  }

  function handleBack() {
    setStepIdx((i) => Math.max(0, i - 1));
  }

  // Compute spotlight rectangle
  const spotlight = rect
    ? {
        top: Math.max(0, rect.top - PAD),
        left: Math.max(0, rect.left - PAD),
        width: rect.width + PAD * 2,
        height: rect.height + PAD * 2,
      }
    : null;

  // Compute tooltip position based on placement
  let tooltipStyle: React.CSSProperties = {};
  let placement = step.placement || "bottom";

  if (!spotlight) {
    // No target — center the tooltip
    tooltipStyle = {
      top: "50%",
      left: "50%",
      transform: "translate(-50%, -50%)",
    };
  } else {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const TOOLTIP_W = 340;
    const GAP = 20;

    // Auto-flip placement if not enough room
    if (placement === "bottom" && spotlight.top + spotlight.height + GAP + 200 > vh) {
      placement = "top";
    } else if (placement === "top" && spotlight.top - GAP - 200 < 0) {
      placement = "bottom";
    } else if (placement === "right" && spotlight.left + spotlight.width + GAP + TOOLTIP_W > vw) {
      placement = "left";
    } else if (placement === "left" && spotlight.left - GAP - TOOLTIP_W < 0) {
      placement = "right";
    }

    switch (placement) {
      case "top":
        tooltipStyle = {
          top: spotlight.top - GAP,
          left: Math.min(
            Math.max(16, spotlight.left + spotlight.width / 2 - TOOLTIP_W / 2),
            vw - TOOLTIP_W - 16,
          ),
          transform: "translateY(-100%)",
        };
        break;
      case "bottom":
        tooltipStyle = {
          top: spotlight.top + spotlight.height + GAP,
          left: Math.min(
            Math.max(16, spotlight.left + spotlight.width / 2 - TOOLTIP_W / 2),
            vw - TOOLTIP_W - 16,
          ),
        };
        break;
      case "left":
        tooltipStyle = {
          top: Math.max(16, spotlight.top + spotlight.height / 2 - 100),
          left: spotlight.left - GAP,
          transform: "translateX(-100%)",
        };
        break;
      case "right":
        tooltipStyle = {
          top: Math.max(16, spotlight.top + spotlight.height / 2 - 100),
          left: spotlight.left + spotlight.width + GAP,
        };
        break;
    }
  }

  return (
    <AnimatePresence>
      {active && (
        <motion.div
          className="tour-root"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
        >
          {/* Backdrop with spotlight cutout */}
          {spotlight ? (
            <>
              {/* 4 dark rectangles around the spotlight hole */}
              <div
                className="tour-backdrop"
                style={{
                  top: 0,
                  left: 0,
                  right: 0,
                  height: spotlight.top,
                }}
              />
              <div
                className="tour-backdrop"
                style={{
                  top: spotlight.top + spotlight.height,
                  left: 0,
                  right: 0,
                  bottom: 0,
                }}
              />
              <div
                className="tour-backdrop"
                style={{
                  top: spotlight.top,
                  left: 0,
                  width: spotlight.left,
                  height: spotlight.height,
                }}
              />
              <div
                className="tour-backdrop"
                style={{
                  top: spotlight.top,
                  left: spotlight.left + spotlight.width,
                  right: 0,
                  height: spotlight.height,
                }}
              />
              {/* Glowing ring around the target */}
              <motion.div
                className="tour-spotlight-ring"
                style={{
                  top: spotlight.top,
                  left: spotlight.left,
                  width: spotlight.width,
                  height: spotlight.height,
                }}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.25 }}
              />
              {/* Arrow pointing at the element */}
              <Arrow spotlight={spotlight} placement={placement} />
            </>
          ) : (
            <div className="tour-backdrop tour-backdrop-full" />
          )}

          {/* Tooltip */}
          <motion.div
            className="tour-tooltip"
            style={tooltipStyle as any}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            key={stepIdx}
            transition={{ duration: 0.25, ease: "easeOut" }}
          >
            <div className="tour-tooltip-head">
              {step.icon && <span className="tour-tooltip-icon">{step.icon}</span>}
              <h3 className="tour-tooltip-title">{step.title}</h3>
            </div>
            <p className="tour-tooltip-body">{step.body}</p>
            <div className="tour-tooltip-footer">
              <span className="tour-tooltip-progress">
                {stepIdx + 1} / {steps.length}
              </span>
              <div className="tour-tooltip-actions">
                <button
                  type="button"
                  className="tour-btn tour-btn-ghost"
                  onClick={onClose}
                >
                  Skip
                </button>
                {stepIdx > 0 && (
                  <button
                    type="button"
                    className="tour-btn tour-btn-ghost"
                    onClick={handleBack}
                  >
                    Back
                  </button>
                )}
                <button
                  type="button"
                  className="tour-btn tour-btn-primary"
                  onClick={handleNext}
                >
                  {isLast ? "Got it!" : "Next →"}
                </button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/* Simple CSS arrow pointing from tooltip toward the spotlight */
function Arrow({
  spotlight,
  placement,
}: {
  spotlight: { top: number; left: number; width: number; height: number };
  placement: "top" | "bottom" | "left" | "right";
}) {
  const cx = spotlight.left + spotlight.width / 2;
  const cy = spotlight.top + spotlight.height / 2;
  let x = cx;
  let y = cy;
  let rotate = 0;
  const GAP = 12;

  switch (placement) {
    case "top":
      y = spotlight.top - GAP - 14;
      rotate = 180;
      break;
    case "bottom":
      y = spotlight.top + spotlight.height + GAP;
      rotate = 0;
      break;
    case "left":
      x = spotlight.left - GAP - 14;
      y = cy - 7;
      rotate = 90;
      break;
    case "right":
      x = spotlight.left + spotlight.width + GAP;
      y = cy - 7;
      rotate = -90;
      break;
  }

  return (
    <motion.div
      className="tour-arrow"
      style={{
        top: y,
        left: x,
        transform: `translateX(-50%) rotate(${rotate}deg)`,
      }}
      initial={{ opacity: 0, scale: 0.5 }}
      animate={{ opacity: 1, scale: 1, y: [0, -4, 0] }}
      transition={{
        opacity: { duration: 0.25 },
        scale: { duration: 0.25 },
        y: { duration: 1.2, repeat: Infinity, ease: "easeInOut" },
      }}
    >
      ▲
    </motion.div>
  );
}
