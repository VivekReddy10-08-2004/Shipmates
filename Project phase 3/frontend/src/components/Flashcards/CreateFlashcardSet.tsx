import { useState } from "react";
import { createFlashcardSet } from "../../api/flashcards.js";
import useCurrentUser from "../../hooks/useCurrentUser.js";
import { ensureCourse, searchCourses } from "../../api/studygroups.js";
import { fireReload } from "../../utils/reloadEvents.js";

type CardInput = { front: string; back: string };
type Status = { kind: "info" | "success" | "error"; text: string };

type Props = {
  onClose?: () => void;
  onCreated?: () => void;
};

export default function CreateFlashcardSet({ onClose, onCreated }: Props) {
  const { user } = useCurrentUser();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");

  const [courseId, setCourseId] = useState("");
  const [courseQuery, setCourseQuery] = useState("");
  const [courseResults, setCourseResults] = useState<any[]>([]);
  const [selectedCourseName, setSelectedCourseName] = useState("");

  const [cards, setCards] = useState<CardInput[]>([{ front: "", back: "" }]);
  const [status, setStatus] = useState<Status | null>(null);
  const [saving, setSaving] = useState(false);

  const handleCourseSearch = async (v: string) => {
    setCourseQuery(v);
    if (v.trim().length < 2) { setCourseResults([]); return; }
    try {
      const results = await searchCourses(v, 8);
      setCourseResults(results || []);
    } catch { setCourseResults([]); }
  };
  const pickCourse = (c: any) => {
    setCourseId(String(c.course_id));
    const label = c.course_code ? `${c.course_code} - ${c.course_name}` : c.course_name;
    setSelectedCourseName(label);
    setCourseQuery(label);
    setCourseResults([]);
  };

  const ensureCourseFromTypedText = async () => {
    const typed = courseQuery.trim();
    if (!typed) return;
    const course = await ensureCourse(typed);
    pickCourse(course);
  };

  const setFront = (i: number, v: string) =>
    setCards((p) => p.map((c, idx) => (idx === i ? { ...c, front: v } : c)));
  const setBack = (i: number, v: string) =>
    setCards((p) => p.map((c, idx) => (idx === i ? { ...c, back: v } : c)));
  const addCard = () => setCards((p) => [...p, { front: "", back: "" }]);
  const removeCard = (i: number) =>
    setCards((p) => (p.length > 1 ? p.filter((_, idx) => idx !== i) : p));

  const submit = async () => {
    setStatus({ kind: "info", text: "Saving…" });
    setSaving(true);
    try {
      if (!title.trim()) throw new Error("Set title is required");
      if (!courseId) throw new Error("Please select a course");

      const valid = cards.filter((c) => c.front.trim() && c.back.trim());
      if (valid.length === 0) throw new Error("Add at least one card");

      const res = await createFlashcardSet({
        title: title.trim(),
        ...(description.trim() ? { description: description.trim() } : {}),
        course_id: Number(courseId),
        creator_id: user?.user_id ?? 1,
        flashcards: valid,
      });

      setStatus({ kind: "success", text: `Set saved (ID ${res.set_id ?? ""})` });
      setTitle(""); setDescription("");
      setCards([{ front: "", back: "" }]);
      fireReload("flashcards");
      onCreated?.();
    } catch (e: any) {
      setStatus({ kind: "error", text: e?.message || "Failed to save set" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <div style={{ paddingRight: "2.5rem" }}>
        <div style={{ fontFamily: "var(--font-heading)", fontSize: "1.35rem", color: "var(--parchment)", letterSpacing: "0.04em", marginBottom: "1.2rem", paddingBottom: "0.8rem", borderBottom: "1px solid rgba(212,168,67,0.3)" }}>
          Create Flashcard Set Manually
        </div>
      </div>

      <div className="study-field">
        <label className="study-label">Title</label>
        <input className="study-input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Biology terms" />
      </div>

      <div className="study-field">
        <label className="study-label">Description (optional)</label>
        <input className="study-input" value={description} onChange={(e) => setDescription(e.target.value)} />
      </div>

      <div className="study-field">
        <label className="study-label">Course</label>
        <input
          className="study-input"
          value={courseQuery}
          onChange={(e) => handleCourseSearch(e.target.value)}
          onKeyDown={async (e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              try {
                await ensureCourseFromTypedText();
              } catch (err: any) {
                setStatus({ kind: "error", text: err?.message || "Failed to create/select course" });
              }
            }
          }}
          placeholder="Search courses..."
        />
        {courseResults.length > 0 && (
          <div className="study-search-results">
            {courseResults.map((c) => (
              <div key={c.course_id} className="study-search-item" onClick={() => pickCourse(c)}>
                {c.course_code ? `${c.course_code} - ${c.course_name}` : c.course_name}
              </div>
            ))}
          </div>
        )}
        {selectedCourseName && !courseResults.length && (
          <span className="study-selected-chip">⚓ {selectedCourseName}</span>
        )}
        <div style={{ fontSize: "0.78rem", opacity: 0.75, marginTop: "0.3rem" }}>
          Tip: Press Enter to use typed text as a new course.
        </div>
      </div>

      <div className="study-preview-header">Cards</div>

      {cards.map((card, i) => (
        <div key={i} className="quiz-question-block">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.5rem" }}>
            <div className="quiz-question-label">Card {i + 1}</div>
            {cards.length > 1 && (
              <button className="btn-danger-ghost" onClick={() => removeCard(i)} style={{ fontSize: "0.7rem", padding: "0.25rem 0.6rem" }}>
                Remove
              </button>
            )}
          </div>

          <input
            className="study-input"
            style={{ marginBottom: "0.5rem" }}
            placeholder="Front (question/term)"
            value={card.front}
            onChange={(e) => setFront(i, e.target.value)}
          />
          <input
            className="study-input"
            placeholder="Back (answer/definition)"
            value={card.back}
            onChange={(e) => setBack(i, e.target.value)}
          />
        </div>
      ))}

      <button className="btn-ghost-gold" onClick={addCard} style={{ marginTop: "0.5rem" }}>
        + Add Card
      </button>

      {status && (
        <div
          className={`study-notice ${
            status.kind === "error"
              ? "study-notice-error"
              : status.kind === "success"
              ? "study-notice-success"
              : "study-notice-info"
          }`}
        >
          {status.text}
        </div>
      )}

      <div style={{ display: "flex", gap: "0.7rem", justifyContent: "flex-end", marginTop: "1.2rem" }}>
        {onClose && (
          <button className="btn-ghost-gold" onClick={onClose} disabled={saving}>
            Cancel
          </button>
        )}
        <button className="btn-treasure" onClick={submit} disabled={saving}>
          {saving ? "Saving…" : "Save Set"}
        </button>
      </div>
    </>
  );
}
