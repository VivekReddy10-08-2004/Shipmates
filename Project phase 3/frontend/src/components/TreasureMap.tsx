import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";

/*
 * SVG Treasure Map — five "islands" representing app features,
 * connected by a squiggly animated dotted path, with a compass rose
 * and tape-strip corners making it look pinned to the screen.
 */

type IslandDef = {
  id: string;
  label: string;
  sublabel: string;
  cx: number;
  cy: number;
  r: number;
  path: string;
  delay: number;
  variant: "volcano" | "palms" | "rocks" | "fort" | "chest";
};

// Continuous flow: islands start appearing while their trail segment is still
// finishing, and the next segment starts while the island is still popping.
// No stop-start pauses.
const islands: IslandDef[] = [
  {
    id: "quizzes",
    label: "Quizzes",
    sublabel: "Test Your Mettle",
    cx: 260,
    cy: 80,
    r: 42,
    path: "/quizzes",
    delay: 0.9,
    variant: "volcano",
  },
  {
    id: "groups",
    label: "Study Crews",
    sublabel: "Crew Up",
    cx: 460,
    cy: 95,
    r: 46,
    path: "/groups",
    delay: 1.8,
    variant: "fort",
  },
  {
    id: "flashcards",
    label: "Flashcards",
    sublabel: "Sharpen Your Memory",
    cx: 660,
    cy: 150,
    r: 44,
    path: "/flashcards",
    delay: 2.7,
    variant: "palms",
  },
  {
    id: "match",
    label: "The Dock",
    sublabel: "Find Your Matey",
    cx: 520,
    cy: 270,
    r: 48,
    path: "/match",
    delay: 3.6,
    variant: "chest",
  },
  {
    id: "resources",
    label: "Resources",
    sublabel: "Treasure Trove",
    cx: 250,
    cy: 290,
    r: 40,
    path: "/resources",
    delay: 4.5,
    variant: "rocks",
  },
];

// Ship position — lowered so the whole ship sits on the map
const SHIP_X = 105;
const SHIP_Y = 120;
const SHIP_SCALE = 1.2;

// Trail split into 5 segments, each drawn in sequence between island reveals.
const trailSegments = [
  // 1. Ship bow -> Quizzes (curl up and over)
  `M ${SHIP_X + 38} ${SHIP_Y - 6} C 180 80 210 110 235 80 S 255 60 260 80`,
  // 2. Quizzes -> Study Groups (S-curve)
  "M 260 80 C 290 120 340 40 380 90 S 440 120 460 95",
  // 3. Study Groups -> Flashcards (arcing swoop)
  "M 460 95 C 510 70 560 130 600 110 S 650 115 660 150",
  // 4. Flashcards -> Shipmates (squiggle down)
  "M 660 150 C 700 200 630 200 610 235 S 540 245 520 270",
  // 5. Shipmates -> Resources (long squiggle to X)
  "M 520 270 C 470 290 430 315 380 295 S 300 280 280 298 S 250 300 250 290",
];

function CompassRose({ x, y }: { x: number; y: number }) {
  return (
    <g transform={`translate(${x}, ${y})`} className="map-compass">
      {/* Outer circles */}
      <circle cx="0" cy="0" r="34" fill="none" stroke="#8b6d3f" strokeWidth="1.5" />
      <circle cx="0" cy="0" r="30" fill="none" stroke="#8b6d3f" strokeWidth="0.5" />
      {/* Tick marks */}
      {[0, 45, 90, 135, 180, 225, 270, 315].map((deg) => (
        <line
          key={deg}
          x1={0} y1={-30} x2={0} y2={-27}
          stroke="#8b6d3f" strokeWidth="1"
          transform={`rotate(${deg})`}
        />
      ))}

      {/* Main points — all same size/weight now */}
      <polygon points="0,-28 5,-7 -5,-7" fill="#8b2500" /> {/* N - red */}
      <polygon points="0,28 5,7 -5,7" fill="#5a3a1a" />   {/* S */}
      <polygon points="28,0 7,5 7,-5" fill="#5a3a1a" />   {/* E */}
      <polygon points="-28,0 -7,5 -7,-5" fill="#5a3a1a" /> {/* W */}

      {/* Diagonal points */}
      <polygon points="19,-19 6,-3 3,-6" fill="#6b5a3e" opacity="0.6" />
      <polygon points="19,19 6,3 3,6" fill="#6b5a3e" opacity="0.6" />
      <polygon points="-19,-19 -6,-3 -3,-6" fill="#6b5a3e" opacity="0.6" />
      <polygon points="-19,19 -6,3 -3,6" fill="#6b5a3e" opacity="0.6" />

      {/* Center */}
      <circle cx="0" cy="0" r="4" fill="#8b6d3f" />
      <circle cx="0" cy="0" r="2" fill="#d4b87a" />

      {/* Labels — all same size and weight */}
      <text y="-38" textAnchor="middle" fontSize="10" fontWeight="700" fill="#5a3a1a"
        fontFamily="'Cinzel', serif">N</text>
      <text y="46" textAnchor="middle" fontSize="10" fontWeight="700" fill="#5a3a1a"
        fontFamily="'Cinzel', serif">S</text>
      <text x="42" y="4" textAnchor="middle" fontSize="10" fontWeight="700" fill="#5a3a1a"
        fontFamily="'Cinzel', serif">E</text>
      <text x="-42" y="4" textAnchor="middle" fontSize="10" fontWeight="700" fill="#5a3a1a"
        fontFamily="'Cinzel', serif">W</text>
    </g>
  );
}

/* BOLD, FLASHY icons that clearly represent each feature */
function IslandDetail({ cx, cy, variant }: { cx: number; cy: number; r: number; variant: IslandDef["variant"] }) {
  const ink = "#3a2410";
  const gold = "#d4a843";
  const red = "#8b2500";

  switch (variant) {
    // ==========================================================
    // STUDY GROUPS — Pirate hat with crossed cutlasses underneath
    // ==========================================================
    case "fort":
      return (
        <g>
          {/* Crossed cutlasses (behind hat) */}
          {/* Sword 1 (blade) */}
          <line x1={cx - 20} y1={cy + 15} x2={cx + 18} y2={cy - 12}
            stroke="#8b8893" strokeWidth="3" strokeLinecap="round" />
          <line x1={cx - 18} y1={cy + 14} x2={cx + 16} y2={cy - 10}
            stroke="#d4d4dc" strokeWidth="1" strokeLinecap="round" opacity="0.8" />
          {/* Sword 1 hilt */}
          <circle cx={cx - 20} cy={cy + 15} r="3" fill={gold} stroke={ink} strokeWidth="1" />
          <path d={`M ${cx - 24} ${cy + 11} L ${cx - 16} ${cy + 19}`}
            stroke={gold} strokeWidth="2" strokeLinecap="round" />
          <path d={`M ${cx - 24} ${cy + 11} L ${cx - 16} ${cy + 19}`}
            stroke={ink} strokeWidth="0.5" strokeLinecap="round" />

          {/* Sword 2 (blade) */}
          <line x1={cx + 20} y1={cy + 15} x2={cx - 18} y2={cy - 12}
            stroke="#8b8893" strokeWidth="3" strokeLinecap="round" />
          <line x1={cx + 18} y1={cy + 14} x2={cx - 16} y2={cy - 10}
            stroke="#d4d4dc" strokeWidth="1" strokeLinecap="round" opacity="0.8" />
          {/* Sword 2 hilt */}
          <circle cx={cx + 20} cy={cy + 15} r="3" fill={gold} stroke={ink} strokeWidth="1" />
          <path d={`M ${cx + 24} ${cy + 11} L ${cx + 16} ${cy + 19}`}
            stroke={gold} strokeWidth="2" strokeLinecap="round" />
          <path d={`M ${cx + 24} ${cy + 11} L ${cx + 16} ${cy + 19}`}
            stroke={ink} strokeWidth="0.5" strokeLinecap="round" />

          {/* Pirate tricorn hat on top */}
          <path d={`
            M ${cx - 22} ${cy - 5}
            Q ${cx - 18} ${cy - 14} ${cx - 8} ${cy - 16}
            Q ${cx} ${cy - 22} ${cx + 8} ${cy - 16}
            Q ${cx + 18} ${cy - 14} ${cx + 22} ${cy - 5}
            Q ${cx + 16} ${cy - 2} ${cx} ${cy - 3}
            Q ${cx - 16} ${cy - 2} ${cx - 22} ${cy - 5} Z
          `} fill="#1a1a1a" stroke={ink} strokeWidth="1.2" />
          {/* Hat highlight */}
          <path d={`M ${cx - 16} ${cy - 10} Q ${cx} ${cy - 18} ${cx + 16} ${cy - 10}`}
            fill="none" stroke="#3a3a3a" strokeWidth="1" />
          {/* Skull & crossbones badge on hat */}
          <circle cx={cx} cy={cy - 10} r="3" fill="#f0dcaa" stroke={ink} strokeWidth="0.5" />
          <rect x={cx - 1} y={cy - 10} width="0.8" height="1.5" fill={ink} />
          <rect x={cx + 0.2} y={cy - 10} width="0.8" height="1.5" fill={ink} />
          <path d={`M ${cx - 3} ${cy - 7} L ${cx + 3} ${cy - 7}`}
            stroke={ink} strokeWidth="1" strokeLinecap="round" />
          <path d={`M ${cx - 3} ${cy - 7} L ${cx + 3} ${cy - 7}`}
            transform={`rotate(60 ${cx} ${cy - 7})`}
            stroke={ink} strokeWidth="1" strokeLinecap="round" />
          <path d={`M ${cx - 3} ${cy - 7} L ${cx + 3} ${cy - 7}`}
            transform={`rotate(-60 ${cx} ${cy - 7})`}
            stroke={ink} strokeWidth="1" strokeLinecap="round" />
        </g>
      );

    // ==========================================================
    // QUIZZES — Big unfurled scroll with huge question mark
    // ==========================================================
    case "volcano":
      return (
        <g>
          {/* Scroll shadow */}
          <ellipse cx={cx + 2} cy={cy + 14} rx="18" ry="2" fill="rgba(0,0,0,0.2)" />
          {/* Scroll body (unfurled) */}
          <path d={`
            M ${cx - 16} ${cy - 14}
            L ${cx + 16} ${cy - 14}
            L ${cx + 16} ${cy + 12}
            L ${cx - 16} ${cy + 12} Z
          `} fill="#f0dcaa" stroke={ink} strokeWidth="1.2" />
          {/* Top shadow */}
          <rect x={cx - 16} y={cy - 14} width="32" height="3" fill="#d4b87a" opacity="0.5" />
          {/* Bottom shadow */}
          <rect x={cx - 16} y={cy + 9} width="32" height="3" fill="#d4b87a" opacity="0.5" />
          {/* Rolled left edge */}
          <ellipse cx={cx - 16} cy={cy - 1} rx="4" ry="14"
            fill="#d4b87a" stroke={ink} strokeWidth="1" />
          <ellipse cx={cx - 16} cy={cy - 1} rx="2" ry="12" fill="#b89656" />
          {/* Rolled right edge */}
          <ellipse cx={cx + 16} cy={cy - 1} rx="4" ry="14"
            fill="#d4b87a" stroke={ink} strokeWidth="1" />
          <ellipse cx={cx + 16} cy={cy - 1} rx="2" ry="12" fill="#b89656" />
          {/* BIG Question mark */}
          <text x={cx} y={cy + 6} fontSize="20" fontWeight="900" fill={red}
            textAnchor="middle" fontFamily="'Cinzel', serif">?</text>
          {/* Small decorative ? */}
          <text x={cx - 9} y={cy + 1} fontSize="8" fontWeight="700" fill={ink}
            textAnchor="middle" opacity="0.6" fontFamily="'Cinzel', serif">?</text>
          <text x={cx + 9} y={cy + 1} fontSize="8" fontWeight="700" fill={ink}
            textAnchor="middle" opacity="0.6" fontFamily="'Cinzel', serif">?</text>
        </g>
      );

    // ==========================================================
    // FLASHCARDS — Fanned stack of cards with glow
    // ==========================================================
    case "palms":
      return (
        <g>
          {/* Shadow */}
          <ellipse cx={cx + 2} cy={cy + 12} rx="16" ry="2" fill="rgba(0,0,0,0.2)" />
          {/* Card 1 (back, tilted left) */}
          <rect x={cx - 9} y={cy - 11} width="18" height="20" rx="1.5"
            fill="#e4cc92" stroke={ink} strokeWidth="1.2"
            transform={`rotate(-18 ${cx} ${cy - 1})`} />
          <line x1={cx - 5} y1={cy - 7} x2={cx + 5} y2={cy - 7}
            stroke={ink} strokeWidth="0.5" opacity="0.6"
            transform={`rotate(-18 ${cx} ${cy - 1})`} />
          <line x1={cx - 5} y1={cy - 4} x2={cx + 3} y2={cy - 4}
            stroke={ink} strokeWidth="0.5" opacity="0.6"
            transform={`rotate(-18 ${cx} ${cy - 1})`} />
          {/* Card 2 (middle, upright) */}
          <rect x={cx - 9} y={cy - 11} width="18" height="20" rx="1.5"
            fill="#f0dcaa" stroke={ink} strokeWidth="1.2" />
          <line x1={cx - 5} y1={cy - 7} x2={cx + 5} y2={cy - 7}
            stroke={ink} strokeWidth="0.5" opacity="0.6" />
          <line x1={cx - 5} y1={cy - 4} x2={cx + 3} y2={cy - 4}
            stroke={ink} strokeWidth="0.5" opacity="0.6" />
          {/* Card 3 (front, tilted right) */}
          <rect x={cx - 9} y={cy - 11} width="18" height="20" rx="1.5"
            fill="#f8e8b8" stroke={ink} strokeWidth="1.2"
            transform={`rotate(18 ${cx} ${cy - 1})`} />
          {/* Text on front card */}
          <g transform={`rotate(18 ${cx} ${cy - 1})`}>
            <text x={cx} y={cy - 4} fontSize="7" fontWeight="800" fill={red}
              textAnchor="middle" fontFamily="'Cinzel', serif">A</text>
            <line x1={cx - 5} y1={cy} x2={cx + 5} y2={cy}
              stroke={ink} strokeWidth="0.5" opacity="0.6" />
            <line x1={cx - 5} y1={cy + 3} x2={cx + 3} y2={cy + 3}
              stroke={ink} strokeWidth="0.5" opacity="0.6" />
            <line x1={cx - 5} y1={cy + 6} x2={cx + 4} y2={cy + 6}
              stroke={ink} strokeWidth="0.5" opacity="0.6" />
          </g>
          {/* Gold sparkle accent */}
          <circle cx={cx + 12} cy={cy - 12} r="1.5" fill={gold} opacity="0.9" />
          <circle cx={cx + 12} cy={cy - 12} r="0.6" fill="#f8e890" />
        </g>
      );

    // ==========================================================
    // THE DOCK — wooden pier with posts, lantern, and a tied boat
    // ==========================================================
    case "chest":
      return (
        <g>
          {/* Water around the dock */}
          <ellipse cx={cx} cy={cy + 8} rx="22" ry="3" fill="#7ab3a2" opacity="0.4" />
          <path d={`M ${cx - 20} ${cy + 10} Q ${cx - 15} ${cy + 8} ${cx - 10} ${cy + 10} Q ${cx - 5} ${cy + 12} ${cx} ${cy + 10} Q ${cx + 5} ${cy + 8} ${cx + 10} ${cy + 10} Q ${cx + 15} ${cy + 12} ${cx + 20} ${cy + 10}`}
            fill="none" stroke="#5a8a7a" strokeWidth="0.6" opacity="0.5" />

          {/* Dock planks (perspective — far plank thinner, near thicker) */}
          <path d={`M ${cx - 16} ${cy - 2} L ${cx + 16} ${cy - 2} L ${cx + 18} ${cy + 2} L ${cx - 18} ${cy + 2} Z`}
            fill="#8b5a2e" stroke={ink} strokeWidth="0.9" />
          <path d={`M ${cx - 18} ${cy + 2} L ${cx + 18} ${cy + 2} L ${cx + 20} ${cy + 6} L ${cx - 20} ${cy + 6} Z`}
            fill="#7a4a22" stroke={ink} strokeWidth="0.9" />
          {/* Plank seams */}
          <line x1={cx - 6} y1={cy - 2} x2={cx - 7} y2={cy + 6} stroke={ink} strokeWidth="0.5" opacity="0.7" />
          <line x1={cx + 6} y1={cy - 2} x2={cx + 7} y2={cy + 6} stroke={ink} strokeWidth="0.5" opacity="0.7" />

          {/* Dock posts (pylons sticking up out of the water) */}
          {/* Left post */}
          <rect x={cx - 19} y={cy - 8} width="3" height="10" fill="#5a3a1a" stroke={ink} strokeWidth="0.7" />
          <ellipse cx={cx - 17.5} cy={cy - 8.5} rx="2.5" ry="1" fill="#3d2410" />
          {/* Middle-left post */}
          <rect x={cx - 4} y={cy - 12} width="3" height="14" fill="#5a3a1a" stroke={ink} strokeWidth="0.7" />
          <ellipse cx={cx - 2.5} cy={cy - 12.5} rx="2.5" ry="1" fill="#3d2410" />
          {/* Middle-right post */}
          <rect x={cx + 10} y={cy - 10} width="3" height="12" fill="#5a3a1a" stroke={ink} strokeWidth="0.7" />
          <ellipse cx={cx + 11.5} cy={cy - 10.5} rx="2.5" ry="1" fill="#3d2410" />

          {/* Rope running between posts */}
          <path d={`M ${cx - 17.5} ${cy - 8} Q ${cx - 10} ${cy - 5} ${cx - 2.5} ${cy - 11}`}
            fill="none" stroke="#a07a4a" strokeWidth="1.2" strokeLinecap="round" />
          <path d={`M ${cx - 2.5} ${cy - 11} Q ${cx + 4} ${cy - 6} ${cx + 11.5} ${cy - 9}`}
            fill="none" stroke="#a07a4a" strokeWidth="1.2" strokeLinecap="round" />

          {/* Small lantern on the far-left post */}
          <rect x={cx - 19.5} y={cy - 16} width="4" height="5" rx="0.5"
            fill={gold} stroke={ink} strokeWidth="0.6" />
          <rect x={cx - 19.5} y={cy - 17.5} width="4" height="1.5"
            fill="#3a2410" stroke={ink} strokeWidth="0.4" />
          <line x1={cx - 17.5} y1={cy - 17.5} x2={cx - 17.5} y2={cy - 20}
            stroke={ink} strokeWidth="0.6" />
          {/* Lantern glow */}
          <circle cx={cx - 17.5} cy={cy - 13.5} r="4" fill="#ffcc66" opacity="0.35" />
          <circle cx={cx - 17.5} cy={cy - 13.5} r="1" fill="#fff8e0" />

          {/* Small tied-up boat on the right */}
          <path d={`M ${cx + 14} ${cy + 3} Q ${cx + 16} ${cy + 6} ${cx + 22} ${cy + 6} L ${cx + 26} ${cy + 4} Z`}
            fill="#6b4828" stroke={ink} strokeWidth="0.7" />
          <line x1={cx + 13} y1={cy + 3} x2={cx + 25} y2={cy + 3}
            stroke={ink} strokeWidth="0.6" />
          {/* Little mast on the boat */}
          <line x1={cx + 19} y1={cy + 3} x2={cx + 19} y2={cy - 4}
            stroke={ink} strokeWidth="0.9" />
          {/* Rope tying boat to post */}
          <path d={`M ${cx + 11.5} ${cy - 9} Q ${cx + 14} ${cy - 2} ${cx + 19} ${cy + 1}`}
            fill="none" stroke="#a07a4a" strokeWidth="0.9" strokeLinecap="round" />
        </g>
      );

    // ==========================================================
    // RESOURCES — Open treasure chest with gold pouring out
    // ==========================================================
    case "rocks":
      return (
        <g>
          {/* Warm glow behind chest */}
          <ellipse cx={cx} cy={cy - 2} rx="22" ry="16" fill={gold} opacity="0.2" />

          {/* Chest body */}
          <rect x={cx - 14} y={cy - 2} width="28" height="14" rx="1"
            fill="#8b5a2e" stroke={ink} strokeWidth="1.3" />
          {/* Wood planks on chest */}
          <line x1={cx - 14} y1={cy + 2} x2={cx + 14} y2={cy + 2}
            stroke={ink} strokeWidth="0.5" opacity="0.5" />
          <line x1={cx - 14} y1={cy + 7} x2={cx + 14} y2={cy + 7}
            stroke={ink} strokeWidth="0.5" opacity="0.5" />

          {/* Open lid (tilted back) */}
          <path d={`
            M ${cx - 14} ${cy - 2}
            Q ${cx - 14} ${cy - 16} ${cx - 8} ${cy - 18}
            L ${cx + 10} ${cy - 22}
            Q ${cx + 14} ${cy - 20} ${cx + 14} ${cy - 4}
            Z
          `} fill="#a07040" stroke={ink} strokeWidth="1.3" />
          {/* Lid inside (lighter) */}
          <path d={`M ${cx - 12} ${cy - 4} Q ${cx - 12} ${cy - 14} ${cx - 7} ${cy - 16} L ${cx + 9} ${cy - 20}`}
            fill="none" stroke={ink} strokeWidth="0.5" opacity="0.5" />

          {/* Metal bands */}
          <rect x={cx - 14} y={cy + 10} width="28" height="2" fill={ink} />
          <rect x={cx - 2} y={cy - 2} width="4" height="14" fill={ink} opacity="0.6" />

          {/* Lock */}
          <rect x={cx - 3} y={cy + 2} width="6" height="6" rx="0.5"
            fill={gold} stroke={ink} strokeWidth="0.8" />
          <circle cx={cx} cy={cy + 5} r="1" fill={ink} />

          {/* GOLD POURING OUT (on top of the chest) */}
          {/* Big pile of gold inside */}
          <path d={`
            M ${cx - 12} ${cy - 2}
            Q ${cx - 8} ${cy - 10} ${cx - 3} ${cy - 8}
            Q ${cx + 2} ${cy - 12} ${cx + 7} ${cy - 9}
            Q ${cx + 10} ${cy - 6} ${cx + 12} ${cy - 2}
            Z
          `} fill={gold} stroke={ink} strokeWidth="0.8" />

          {/* Individual coins on pile */}
          <circle cx={cx - 7} cy={cy - 5} r="2" fill="#f8e890" stroke={ink} strokeWidth="0.5" />
          <circle cx={cx - 2} cy={cy - 7} r="2" fill="#f8e890" stroke={ink} strokeWidth="0.5" />
          <circle cx={cx + 4} cy={cy - 6} r="2" fill="#f8e890" stroke={ink} strokeWidth="0.5" />
          <circle cx={cx + 8} cy={cy - 4} r="1.8" fill="#f8e890" stroke={ink} strokeWidth="0.5" />

          {/* Gems */}
          <polygon points={`${cx - 4},${cy - 10} ${cx - 2},${cy - 12} ${cx},${cy - 10} ${cx - 2},${cy - 8}`}
            fill="#e04040" stroke={ink} strokeWidth="0.5" />
          <polygon points={`${cx + 5},${cy - 9} ${cx + 7},${cy - 11} ${cx + 9},${cy - 9} ${cx + 7},${cy - 7}`}
            fill="#40a0e0" stroke={ink} strokeWidth="0.5" />

          {/* Coin spilling on the side */}
          <circle cx={cx + 14} cy={cy + 6} r="2" fill={gold} stroke={ink} strokeWidth="0.5" />
          <circle cx={cx - 14} cy={cy + 5} r="1.8" fill={gold} stroke={ink} strokeWidth="0.5" />

          {/* Sparkles */}
          <g fill="#fff8e0">
            <path d={`M ${cx + 6} ${cy - 14} L ${cx + 6} ${cy - 16} M ${cx + 5} ${cy - 15} L ${cx + 7} ${cy - 15}`}
              stroke="#fff8e0" strokeWidth="1" strokeLinecap="round" />
            <path d={`M ${cx - 5} ${cy - 13} L ${cx - 5} ${cy - 15} M ${cx - 6} ${cy - 14} L ${cx - 4} ${cy - 14}`}
              stroke="#fff8e0" strokeWidth="0.8" strokeLinecap="round" />
          </g>
        </g>
      );
  }
}

function Island({
  cx,
  cy,
  r,
  label,
  sublabel,
  delay,
  variant,
  onClick,
}: {
  cx: number;
  cy: number;
  r: number;
  label: string;
  sublabel: string;
  delay: number;
  variant: IslandDef["variant"];
  onClick: () => void;
}) {
  return (
    <motion.g
      className="map-island"
      onClick={onClick}
      initial={{ opacity: 0, scale: 0.4 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay, duration: 0.55, ease: [0.34, 1.56, 0.64, 1] }}
    >
      {/* Island shadow */}
      <ellipse cx={cx + 3} cy={cy + r - 6} rx={r + 8} ry={10}
        fill="rgba(80, 60, 30, 0.12)" />

      {/* Shallow water ring */}
      <circle cx={cx} cy={cy} r={r + 10}
        fill="none" stroke="#7ab3a2" strokeWidth="4" opacity="0.15" />
      <circle cx={cx} cy={cy} r={r + 5}
        fill="none" stroke="#8ac4b2" strokeWidth="2" opacity="0.12" />

      {/* Beach/sand base — irregular shape via ellipses */}
      <ellipse cx={cx} cy={cy + 2} rx={r + 2} ry={r - 4}
        fill="#e0c888" stroke="#c4a66a" strokeWidth="1" />
      <ellipse cx={cx - 4} cy={cy - 3} rx={r - 2} ry={r - 6}
        fill="#d4b87a" opacity="0.8" />

      {/* Unique island detail */}
      <IslandDetail cx={cx} cy={cy} r={r} variant={variant} />

      {/* Label backdrop for readability */}
      <rect
        x={cx - 60}
        y={cy + r + 8}
        width="120"
        height="30"
        rx="4"
        fill="var(--parchment)"
        opacity="0.75"
      />
      {/* Label */}
      <text
        x={cx}
        y={cy + r + 22}
        textAnchor="middle"
        className="map-island-label"
      >
        {label}
      </text>
      <text
        x={cx}
        y={cy + r + 34}
        textAnchor="middle"
        className="map-island-sublabel"
      >
        {sublabel}
      </text>
    </motion.g>
  );
}

export default function TreasureMap() {
  const navigate = useNavigate();

  return (
    <div className="treasure-map-wrapper">
      <div className="treasure-map">
        {/* Pin corners */}
        <div className="map-pin map-pin-tl" />
        <div className="map-pin map-pin-tr" />
        <div className="map-pin map-pin-bl" />
        <div className="map-pin map-pin-br" />

        <div className="treasure-map-svg">
          <svg viewBox="0 0 800 380" xmlns="http://www.w3.org/2000/svg">
            {/* Water background with subtle waves */}
            <defs>
              <pattern id="waves" x="0" y="0" width="60" height="12"
                patternUnits="userSpaceOnUse">
                <path d="M0 6 Q15 0 30 6 Q45 12 60 6" fill="none"
                  stroke="rgba(100, 140, 130, 0.15)" strokeWidth="1" />
              </pattern>
              <radialGradient id="waterGlow" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor="rgba(120, 170, 160, 0.08)" />
                <stop offset="100%" stopColor="rgba(120, 170, 160, 0)" />
              </radialGradient>
            </defs>

            {/* Parchment base */}
            <rect width="800" height="380" fill="var(--parchment)" rx="4" />
            <rect width="800" height="380" fill="url(#waves)" rx="4" />
            <rect width="800" height="380" fill="url(#waterGlow)" rx="4" />

            {/* Waves scattered across the whole map */}
            <path d="M 30 50 Q 42 42 54 50 Q 66 58 78 50" fill="none" stroke="#8b7a52" strokeWidth="1" opacity="0.3" />
            <path d="M 700 320 Q 712 312 724 320 Q 736 328 748 320" fill="none" stroke="#8b7a52" strokeWidth="1" opacity="0.25" />
            <path d="M 300 350 Q 310 344 320 350 Q 330 356 340 350" fill="none" stroke="#8b7a52" strokeWidth="1" opacity="0.25" />
            <path d="M 550 30 Q 562 22 574 30 Q 586 38 598 30" fill="none" stroke="#8b7a52" strokeWidth="1" opacity="0.25" />
            <path d="M 80 250 Q 90 244 100 250 Q 110 256 120 250" fill="none" stroke="#8b7a52" strokeWidth="1" opacity="0.2" />
            <path d="M 650 200 Q 660 194 670 200 Q 680 206 690 200" fill="none" stroke="#8b7a52" strokeWidth="1" opacity="0.2" />
            <path d="M 420 350 Q 435 342 450 350 Q 465 358 480 350" fill="none" stroke="#8b7a52" strokeWidth="1" opacity="0.25" />
            <path d="M 630 45 Q 642 38 654 45 Q 666 52 678 45" fill="none" stroke="#8b7a52" strokeWidth="1" opacity="0.22" />
            <path d="M 230 40 Q 242 33 254 40 Q 266 47 278 40" fill="none" stroke="#8b7a52" strokeWidth="1" opacity="0.22" />
            <path d="M 50 180 Q 60 174 70 180 Q 80 186 90 180" fill="none" stroke="#8b7a52" strokeWidth="1" opacity="0.18" />
            <path d="M 520 45 Q 530 39 540 45" fill="none" stroke="#8b7a52" strokeWidth="1" opacity="0.2" />
            <path d="M 360 340 Q 370 334 380 340" fill="none" stroke="#8b7a52" strokeWidth="1" opacity="0.2" />
            <path d="M 590 340 Q 600 334 610 340 Q 620 346 630 340" fill="none" stroke="#8b7a52" strokeWidth="1" opacity="0.22" />

            {/* Fish swimming around */}
            <g opacity="0.4" transform="translate(550, 45)">
              <ellipse cx="0" cy="0" rx="8" ry="4" fill="#6b5a3e" />
              <polygon points="8,0 14,-4 14,4" fill="#6b5a3e" />
              <circle cx="-3" cy="-1" r="0.8" fill="#e8d5a3" />
            </g>
            <g opacity="0.35" transform="translate(320, 340) scale(-1,1)">
              <ellipse cx="0" cy="0" rx="6" ry="3" fill="#6b5a3e" />
              <polygon points="6,0 10,-3 10,3" fill="#6b5a3e" />
            </g>
            <g opacity="0.3" transform="translate(100, 340)">
              <ellipse cx="0" cy="0" rx="7" ry="3.5" fill="#6b5a3e" />
              <polygon points="7,0 12,-3.5 12,3.5" fill="#6b5a3e" />
            </g>
            <g opacity="0.3" transform="translate(680, 50)">
              <ellipse cx="0" cy="0" rx="6" ry="3" fill="#6b5a3e" />
              <polygon points="6,0 10,-3 10,3" fill="#6b5a3e" />
            </g>
            <g opacity="0.25" transform="translate(280, 40) scale(-1,1)">
              <ellipse cx="0" cy="0" rx="5" ry="2.5" fill="#6b5a3e" />
              <polygon points="5,0 9,-3 9,3" fill="#6b5a3e" />
            </g>

{/* Ship moved to render on top — see below after islands */}

            {/* Sea serpent body arcs */}
            <g opacity="0.25">
              <path d="M 430 40 Q 440 30 450 40 Q 460 30 470 40" fill="none" stroke="#5a4a2e" strokeWidth="2" strokeLinecap="round" />
              <circle cx="470" cy="40" r="2" fill="#5a4a2e" />
            </g>

            {/* Bottle with message */}
            <g opacity="0.35" transform="translate(650, 320)">
              <ellipse cx="0" cy="0" rx="6" ry="2.5" fill="none" stroke="#6b5a3e" strokeWidth="1" />
              <rect x="-2" y="-4" width="4" height="4" fill="none" stroke="#6b5a3e" strokeWidth="0.8" />
            </g>

            {/* Latitude/longitude lines */}
            <line x1="0" y1="100" x2="800" y2="100" stroke="#8b7a52" strokeWidth="0.4" strokeDasharray="2 4" opacity="0.15" />
            <line x1="0" y1="200" x2="800" y2="200" stroke="#8b7a52" strokeWidth="0.4" strokeDasharray="2 4" opacity="0.15" />
            <line x1="0" y1="300" x2="800" y2="300" stroke="#8b7a52" strokeWidth="0.4" strokeDasharray="2 4" opacity="0.15" />
            <line x1="200" y1="0" x2="200" y2="380" stroke="#8b7a52" strokeWidth="0.4" strokeDasharray="2 4" opacity="0.12" />
            <line x1="400" y1="0" x2="400" y2="380" stroke="#8b7a52" strokeWidth="0.4" strokeDasharray="2 4" opacity="0.12" />
            <line x1="600" y1="0" x2="600" y2="380" stroke="#8b7a52" strokeWidth="0.4" strokeDasharray="2 4" opacity="0.12" />

            {/* Coffee stains / aged marks */}
            <circle cx="680" cy="280" r="18" fill="#8b6b3a" opacity="0.08" />
            <circle cx="120" cy="50" r="12" fill="#8b6b3a" opacity="0.07" />
            <circle cx="540" cy="340" r="15" fill="#8b6b3a" opacity="0.06" />

            {/* Anchor */}
            <g opacity="0.3" transform="translate(720, 340)">
              <circle cx="0" cy="-8" r="3" fill="none" stroke="#5a4a2e" strokeWidth="1.2" />
              <line x1="0" y1="-5" x2="0" y2="6" stroke="#5a4a2e" strokeWidth="1.2" />
              <line x1="-4" y1="-2" x2="4" y2="-2" stroke="#5a4a2e" strokeWidth="1.2" />
              <path d="M -6 6 Q 0 10 6 6" fill="none" stroke="#5a4a2e" strokeWidth="1.2" />
            </g>

            {/* Animated trail — each segment overlaps with the previous island's pop
                for a continuous "voyage unfolding" feel, no stop-start pauses. */}
            {trailSegments.map((d, i) => (
              <motion.path
                key={i}
                d={d}
                className="map-path"
                initial={{ pathLength: 0 }}
                animate={{ pathLength: 1 }}
                transition={{ delay: 0.3 + i * 0.9, duration: 0.9, ease: "easeOut" }}
              />
            ))}

            {/* Islands */}
            {islands.map((island) => (
              <Island
                key={island.id}
                cx={island.cx}
                cy={island.cy}
                r={island.r}
                label={island.label}
                sublabel={island.sublabel}
                delay={island.delay}
                variant={island.variant}
                onClick={() => navigate(island.path)}
              />
            ))}

            {/* Compass Rose — bottom-right */}
            <CompassRose x={720} y={320} />

            {/* X marks the spot on Resources — the final treasure */}
            <motion.text
              x={250}
              y={263}
              textAnchor="middle"
              className="map-x"
              initial={{ opacity: 0, scale: 0 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 4.5, duration: 0.5, ease: "backOut" }}
            >
              ✕
            </motion.text>

            {/* Pirate galleon — detailed but compact. Flipped so bow faces right. */}
            <motion.g
              transform={`translate(${SHIP_X}, ${SHIP_Y}) scale(${-SHIP_SCALE}, ${SHIP_SCALE})`}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0, duration: 0.4 }}
            >
              {/* === WAKE === */}
              <path d="M 30 8 Q 38 10 44 8" fill="none" stroke="#8b7a52" strokeWidth="0.8" opacity="0.55" />
              <path d="M 34 12 Q 42 14 48 12" fill="none" stroke="#8b7a52" strokeWidth="0.6" opacity="0.4" />

              {/* === RIGGING (behind masts) === */}
              <g stroke="#3a2410" strokeWidth="0.4" opacity="0.8" fill="none">
                {/* Foremast rigging */}
                <line x1="-18" y1="-30" x2="-26" y2="-2" />
                <line x1="-18" y1="-30" x2="-22" y2="-2" />
                <line x1="-18" y1="-30" x2="-14" y2="-2" />
                {/* Main mast rigging */}
                <line x1="-2" y1="-42" x2="-16" y2="-2" />
                <line x1="-2" y1="-42" x2="-8" y2="-2" />
                <line x1="-2" y1="-42" x2="8" y2="-2" />
                <line x1="-2" y1="-42" x2="16" y2="-2" />
                {/* Mizzen rigging */}
                <line x1="16" y1="-28" x2="22" y2="-2" />
                <line x1="16" y1="-28" x2="10" y2="-2" />
                {/* Stay lines between masts */}
                <line x1="-18" y1="-30" x2="-2" y2="-42" />
                <line x1="-2" y1="-42" x2="16" y2="-28" />
                {/* Bowsprit stay */}
                <line x1="-2" y1="-42" x2="-36" y2="-8" />
              </g>

              {/* === HULL === */}
              {/* Main hull — curved galleon shape */}
              <path d="M -28 -3 Q -30 2 -24 10 L 22 10 Q 28 8 30 -3 Q 28 -5 24 -4 L -24 -4 Q -28 -5 -28 -3 Z"
                fill="#6b4828" stroke="#2a1808" strokeWidth="1.2" strokeLinejoin="round" />
              {/* Upper plank band (lighter) */}
              <path d="M -26 -3 L 28 -3 L 26 0 L -26 0 Z" fill="#8b6538" stroke="none" />
              {/* Gold trim */}
              <path d="M -25 -1 L 27 -1" stroke="#c49460" strokeWidth="0.7" opacity="0.9" />
              {/* Lower hull shadow */}
              <path d="M -24 7 L 22 7" stroke="#2a1808" strokeWidth="0.6" opacity="0.7" />
              {/* Plank seams */}
              <path d="M -22 3 L 22 3" stroke="#3a2410" strokeWidth="0.4" opacity="0.6" />

              {/* Portholes with glow */}
              <circle cx="-14" cy="4" r="1.6" fill="#2a1808" stroke="#c49460" strokeWidth="0.4" />
              <circle cx="-14" cy="4" r="0.8" fill="#ffcc66" opacity="0.8" />
              <circle cx="-6" cy="4" r="1.6" fill="#2a1808" stroke="#c49460" strokeWidth="0.4" />
              <circle cx="-6" cy="4" r="0.8" fill="#ffcc66" opacity="0.8" />
              <circle cx="2" cy="4" r="1.6" fill="#2a1808" stroke="#c49460" strokeWidth="0.4" />
              <circle cx="2" cy="4" r="0.8" fill="#ffcc66" opacity="0.8" />
              <circle cx="10" cy="4" r="1.6" fill="#2a1808" stroke="#c49460" strokeWidth="0.4" />
              <circle cx="10" cy="4" r="0.8" fill="#ffcc66" opacity="0.8" />

              {/* === BOW (front, left side) === */}
              <path d="M -28 -3 Q -36 -6 -38 -1 Q -30 2 -28 -3 Z"
                fill="#5a3a18" stroke="#2a1808" strokeWidth="0.9" />
              {/* Bowsprit */}
              <line x1="-36" y1="-5" x2="-44" y2="-12" stroke="#3a2410" strokeWidth="1.6" strokeLinecap="round" />
              <line x1="-36" y1="-5" x2="-44" y2="-12" stroke="#6b4a28" strokeWidth="0.6" strokeLinecap="round" />
              {/* Small jib sail on bowsprit */}
              <path d="M -36 -5 L -44 -12 L -38 -2 Z" fill="#e8d098" stroke="#8b6a3a" strokeWidth="0.5" />

              {/* === STERN CASTLE (back, right side) === */}
              <path d="M 20 -3 L 22 -14 Q 22 -16 24 -16 L 30 -16 Q 32 -16 32 -14 L 30 -3 Z"
                fill="#5a3a18" stroke="#2a1808" strokeWidth="0.9" />
              {/* Stern windows */}
              <rect x="24" y="-13" width="3" height="3" fill="#ffcc66" stroke="#3a2410" strokeWidth="0.4" />
              <rect x="28" y="-13" width="3" height="3" fill="#ffcc66" stroke="#3a2410" strokeWidth="0.4" />
              {/* Stern flag */}
              <line x1="31" y1="-16" x2="31" y2="-22" stroke="#3a2410" strokeWidth="0.6" />
              <path d="M 31 -22 L 36 -21 L 31 -19 Z" fill="#8b2500" />

              {/* === MASTS === */}
              {/* Foremast */}
              <line x1="-18" y1="-3" x2="-18" y2="-32" stroke="#3a2410" strokeWidth="1.5" strokeLinecap="round" />
              <line x1="-18" y1="-3" x2="-18" y2="-32" stroke="#6b4a28" strokeWidth="0.5" />
              {/* Main mast (tallest) */}
              <line x1="-2" y1="-3" x2="-2" y2="-44" stroke="#3a2410" strokeWidth="1.8" strokeLinecap="round" />
              <line x1="-2" y1="-3" x2="-2" y2="-44" stroke="#6b4a28" strokeWidth="0.6" />
              {/* Mizzen mast */}
              <line x1="16" y1="-3" x2="16" y2="-30" stroke="#3a2410" strokeWidth="1.3" strokeLinecap="round" />
              <line x1="16" y1="-3" x2="16" y2="-30" stroke="#6b4a28" strokeWidth="0.5" />

              {/* === YARDARMS === */}
              <line x1="-26" y1="-20" x2="-10" y2="-20" stroke="#3a2410" strokeWidth="0.9" strokeLinecap="round" />
              <line x1="-25" y1="-28" x2="-11" y2="-28" stroke="#3a2410" strokeWidth="0.8" strokeLinecap="round" />
              <line x1="-12" y1="-26" x2="8" y2="-26" stroke="#3a2410" strokeWidth="1" strokeLinecap="round" />
              <line x1="-10" y1="-38" x2="6" y2="-38" stroke="#3a2410" strokeWidth="0.9" strokeLinecap="round" />

              {/* === SAILS === */}
              {/* Foremast lower sail (billowing) */}
              <path d="M -25 -20 L -11 -20 Q -15 -15 -18 -10 Q -22 -15 -25 -20 Z"
                fill="#f0dcaa" stroke="#8b6a3a" strokeWidth="0.7" strokeLinejoin="round" />
              <path d="M -18 -20 Q -18 -15 -18 -10" stroke="#d4b87a" strokeWidth="0.4" opacity="0.6" />
              {/* Foremast top sail */}
              <path d="M -24 -28 L -12 -28 Q -15 -24 -18 -22 Q -21 -24 -24 -28 Z"
                fill="#e8d098" stroke="#8b6a3a" strokeWidth="0.6" strokeLinejoin="round" />

              {/* Main mast — big center sail */}
              <path d="M -11 -26 L 7 -26 Q 4 -18 -2 -12 Q -8 -18 -11 -26 Z"
                fill="#f0dcaa" stroke="#8b6a3a" strokeWidth="0.8" strokeLinejoin="round" />
              {/* Main sail folds/shading */}
              <path d="M -2 -26 L -2 -12" stroke="#d4b87a" strokeWidth="0.4" opacity="0.6" />
              <path d="M -6 -24 Q -6 -18 -4 -14" stroke="#d4b87a" strokeWidth="0.3" opacity="0.5" fill="none" />
              <path d="M 2 -24 Q 2 -18 0 -14" stroke="#d4b87a" strokeWidth="0.3" opacity="0.5" fill="none" />

              {/* Main mast top sail */}
              <path d="M -9 -38 L 5 -38 Q 2 -32 -2 -29 Q -6 -32 -9 -38 Z"
                fill="#e8d098" stroke="#8b6a3a" strokeWidth="0.6" strokeLinejoin="round" />

              {/* Mizzen triangular sail (fore-and-aft rig) */}
              <path d="M 16 -26 L 24 -22 L 24 -5 L 16 -4 Z"
                fill="#e8d098" stroke="#8b6a3a" strokeWidth="0.6" strokeLinejoin="round" />
              <path d="M 20 -22 L 20 -5" stroke="#d4b87a" strokeWidth="0.3" opacity="0.6" />

              {/* === CROW'S NEST === */}
              <rect x="-5" y="-46" width="6" height="4" rx="0.5" fill="#3a2410" stroke="#2a1808" strokeWidth="0.4" />
              <rect x="-5" y="-46" width="6" height="1" fill="#6b4a28" />

              {/* === JOLLY ROGER FLAG === */}
              <line x1="-2" y1="-44" x2="-2" y2="-54" stroke="#3a2410" strokeWidth="0.7" />
              <path d="M -2 -54 Q 3 -56 8 -53 Q 6 -50 8 -47 Q 3 -49 -2 -48 Z"
                fill="#1a1a1a" stroke="#2a1808" strokeWidth="0.4" />
              {/* Skull */}
              <circle cx="3" cy="-51" r="1.3" fill="#f0dcaa" />
              <circle cx="2.5" cy="-51" r="0.3" fill="#1a1a1a" />
              <circle cx="3.5" cy="-51" r="0.3" fill="#1a1a1a" />
              {/* Crossbones */}
              <line x1="1" y1="-49" x2="5" y2="-49" stroke="#f0dcaa" strokeWidth="0.6" strokeLinecap="round" />
              <line x1="1" y1="-49" x2="5" y2="-49" stroke="#f0dcaa" strokeWidth="0.6" strokeLinecap="round"
                transform="rotate(45 3 -49)" />

              {/* === CANNON PORTS === */}
              <circle cx="-16" cy="7" r="0.7" fill="#1a0e04" />
              <circle cx="-8" cy="7" r="0.7" fill="#1a0e04" />
              <circle cx="0" cy="7" r="0.7" fill="#1a0e04" />
              <circle cx="8" cy="7" r="0.7" fill="#1a0e04" />
              <circle cx="16" cy="7" r="0.7" fill="#1a0e04" />
            </motion.g>
          </svg>
        </div>
      </div>
    </div>
  );
}
