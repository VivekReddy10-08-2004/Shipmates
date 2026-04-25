/*
 * Shared date/time formatting helpers used across the app.
 *
 *   "April 16th, 2:00 – 3:30 PM"   (session with start+end)
 *   "April 16th, 2:00 PM"           (session with start only)
 *   "April 16th"                    (date only)
 *   "Today, 2:00 PM"                (date is today)
 *   "Yesterday, 2:00 PM"            (date is yesterday)
 *   "Tomorrow, 2:00 PM"             (date is tomorrow)
 */

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function ordinalSuffix(day: number): string {
  if (day >= 11 && day <= 13) return "th";
  switch (day % 10) {
    case 1: return "st";
    case 2: return "nd";
    case 3: return "rd";
    default: return "th";
  }
}

/** "2026-04-16" -> Date at local midnight. Safer than `new Date(str)` which goes UTC. */
function parseLocalDate(isoDate: string): Date | null {
  if (!isoDate) return null;
  // Grab just the yyyy-mm-dd part (works for "2026-04-16T14:00:00" too)
  const m = isoDate.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) {
    // Fallback to native parse
    const d = new Date(isoDate);
    return isNaN(d.getTime()) ? null : d;
  }
  const y = Number(m[1]);
  const mo = Number(m[2]) - 1;
  const da = Number(m[3]);
  return new Date(y, mo, da);
}

/** "14:30" / "14:30:00" -> "2:30 PM" (returns null for junk). */
export function formatTimeString(raw?: string | null): string | null {
  if (!raw) return null;
  const m = raw.match(/^(\d{1,2}):(\d{2})/);
  if (!m) return null;
  let h = Number(m[1]);
  const mins = m[2];
  const suffix = h >= 12 ? "PM" : "AM";
  h = h % 12;
  if (h === 0) h = 12;
  return `${h}:${mins} ${suffix}`;
}

function labelForDate(d: Date): string {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(d);
  target.setHours(0, 0, 0, 0);
  const diffDays = Math.round(
    (target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24),
  );
  if (diffDays === 0) return "Today";
  if (diffDays === -1) return "Yesterday";
  if (diffDays === 1) return "Tomorrow";
  const month = MONTHS[target.getMonth()];
  const day = target.getDate();
  return `${month} ${day}${ordinalSuffix(day)}`;
}

/**
 * Format a session-like {date, start_time, end_time}. All parts optional.
 * Returns "" if nothing meaningful.
 */
export function formatSession(opts: {
  date?: string | null;
  start_time?: string | null;
  end_time?: string | null;
}): string {
  const parsedDate = opts.date ? parseLocalDate(opts.date) : null;
  const startTxt = formatTimeString(opts.start_time);
  const endTxt = formatTimeString(opts.end_time);

  const parts: string[] = [];
  if (parsedDate) parts.push(labelForDate(parsedDate));

  // "2:00 – 3:30 PM" when both sides share the AM/PM; otherwise "2:00 PM – 3:30 PM"
  let timePart = "";
  if (startTxt && endTxt) {
    const startSuffix = startTxt.slice(-2);
    const endSuffix = endTxt.slice(-2);
    if (startSuffix === endSuffix) {
      timePart = `${startTxt.replace(` ${startSuffix}`, "")} – ${endTxt}`;
    } else {
      timePart = `${startTxt} – ${endTxt}`;
    }
  } else if (startTxt) {
    timePart = startTxt;
  }

  if (timePart) parts.push(timePart);
  return parts.join(", ");
}

/**
 * Format a full datetime (e.g. a message timestamp or last_session_at).
 * Accepts ISO string or datetime string.
 *
 * "April 16th, 2:00 PM"  /  "Today, 2:00 PM"  /  "April 16th" (date only)
 */
export function formatDateTime(raw?: string | null): string {
  if (!raw) return "";
  const d = new Date(raw);
  if (isNaN(d.getTime())) {
    // Maybe it's just a date like "2026-04-16"
    const fallback = parseLocalDate(raw);
    return fallback ? labelForDate(fallback) : "";
  }

  const dateLabel = labelForDate(d);
  // Only show time if the raw string includes a time component
  const hasTime = /T|\s\d{1,2}:\d{2}/.test(raw);
  if (!hasTime) return dateLabel;

  let h = d.getHours();
  const suffix = h >= 12 ? "PM" : "AM";
  h = h % 12;
  if (h === 0) h = 12;
  const mins = String(d.getMinutes()).padStart(2, "0");
  return `${dateLabel}, ${h}:${mins} ${suffix}`;
}

/** "April 16th" — date only, no time */
export function formatDateOnly(raw?: string | null): string {
  if (!raw) return "";
  const d = parseLocalDate(raw);
  if (!d) return "";
  return labelForDate(d);
}
