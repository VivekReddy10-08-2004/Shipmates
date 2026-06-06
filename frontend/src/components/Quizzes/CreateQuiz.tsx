import { useState } from "react";
import { createQuiz } from "../../api/quizzes.js";
import useCurrentUser from "../../hooks/useCurrentUser.js";
import { ensureCourse, searchCourses } from "../../api/studygroups.js";
import { fireReload } from "../../utils/reloadEvents.js";

type AnswerInput = { answer_text: string; is_correct: boolean };
type QuestionInput = { question_text: string; answers: AnswerInput[] };
type Status = { kind: "info" | "success" | "error"; text: string };

type Props = {
  onClose?: () => void;
  onCreated?: () => void;
};

export default function CreateQuiz({ onClose, onCreated }: Props) {
  const { user } = useCurrentUser();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");

  const [courseId, setCourseId] = useState("");
  const [courseQuery, setCourseQuery] = useState("");
  const [courseResults, setCourseResults] = useState<any[]>([]);
  const [selectedCourseName, setSelectedCourseName] = useState("");

  const [questions, setQuestions] = useState<QuestionInput[]>([
    { question_text: "", answers: [{ answer_text: "", is_correct: false }] },
  ]);
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

  const setQText = (qi: number, v: string) =>
    setQuestions((p) => p.map((q, i) => (i === qi ? { ...q, question_text: v } : q)));

  const setAText = (qi: number, ai: number, v: string) =>
    setQuestions((p) =>
      p.map((q, i) =>
        i === qi ? { ...q, answers: q.answers.map((a, j) => (j === ai ? { ...a, answer_text: v } : a)) } : q
      )
    );

  const setACorrect = (qi: number, ai: number, on: boolean) =>
    setQuestions((p) =>
      p.map((q, i) =>
        i === qi
          ? { ...q, answers: q.answers.map((a, j) => ({ ...a, is_correct: j === ai ? on : false })) }
          : q
      )
    );

  const addQuestion = () =>
    setQuestions((p) => [...p, { question_text: "", answers: [{ answer_text: "", is_correct: false }] }]);

  const removeQuestion = (qi: number) =>
    setQuestions((p) => (p.length > 1 ? p.filter((_, i) => i !== qi) : p));

  const addAnswer = (qi: number) =>
    setQuestions((p) =>
      p.map((q, i) =>
        i === qi ? { ...q, answers: [...q.answers, { answer_text: "", is_correct: false }] } : q
      )
    );

  const removeAnswer = (qi: number, ai: number) =>
    setQuestions((p) =>
      p.map((q, i) =>
        i === qi && q.answers.length > 1
          ? { ...q, answers: q.answers.filter((_, j) => j !== ai) }
          : q
      )
    );

  const submit = async () => {
    setStatus({ kind: "info", text: "Saving…" });
    setSaving(true);
    try {
      if (!title.trim()) throw new Error("Quiz title is required");
      if (!courseId) throw new Error("Please select a course");
      if (!questions.some((q) => q.question_text.trim())) throw new Error("Add at least one question");

      const res = await createQuiz({
        title: title.trim(),
        description: description.trim() || undefined,
        course_id: Number(courseId),
        creator_id: user?.user_id ?? 1,
        questions,
      });

      setStatus({ kind: "success", text: `Quiz saved (ID ${res.quiz_id})` });
      setTitle(""); setDescription("");
      setQuestions([{ question_text: "", answers: [{ answer_text: "", is_correct: false }] }]);
      fireReload("quizzes");
      onCreated?.();
    } catch (e: any) {
      setStatus({ kind: "error", text: e?.message || "Failed to save quiz" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <div style={{ paddingRight: "2.5rem" }}>
        <div style={{ fontFamily: "var(--font-heading)", fontSize: "1.35rem", color: "var(--parchment)", letterSpacing: "0.04em", marginBottom: "1.2rem", paddingBottom: "0.8rem", borderBottom: "1px solid rgba(212,168,67,0.3)" }}>
          Create Quiz Manually
        </div>
      </div>

      <div className="study-field">
        <label className="study-label">Title</label>
        <input className="study-input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Chapter 3 review" />
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

      <div className="study-preview-header">Questions</div>

      {questions.map((q, qi) => (
        <div key={qi} className="quiz-question-block">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.5rem" }}>
            <div className="quiz-question-label">Question {qi + 1}</div>
            {questions.length > 1 && (
              <button className="btn-danger-ghost" onClick={() => removeQuestion(qi)} style={{ fontSize: "0.7rem", padding: "0.25rem 0.6rem" }}>
                Remove
              </button>
            )}
          </div>

          <input
            className="study-input"
            style={{ marginBottom: "0.6rem" }}
            placeholder="Question text"
            value={q.question_text}
            onChange={(e) => setQText(qi, e.target.value)}
          />

          {q.answers.map((a, ai) => (
            <div key={ai} style={{ display: "flex", gap: "0.5rem", alignItems: "center", marginBottom: "0.35rem" }}>
              <input
                className="study-input"
                style={{ flex: 1 }}
                placeholder={`Answer ${ai + 1}`}
                value={a.answer_text}
                onChange={(e) => setAText(qi, ai, e.target.value)}
              />
              <label style={{ display: "flex", alignItems: "center", gap: "0.35rem", color: "var(--parchment)", fontSize: "0.8rem", letterSpacing: "0.06em", textTransform: "uppercase", fontFamily: "var(--font-heading)", whiteSpace: "nowrap" }}>
                <input
                  type="radio"
                  name={`correct-${qi}`}
                  checked={a.is_correct}
                  onChange={(e) => setACorrect(qi, ai, e.target.checked)}
                  style={{ accentColor: "var(--gold)" }}
                />
                Correct
              </label>
              {q.answers.length > 1 && (
                <button
                  className="btn-danger-ghost"
                  onClick={() => removeAnswer(qi, ai)}
                  style={{ fontSize: "0.7rem", padding: "0.25rem 0.5rem" }}
                >
                  ×
                </button>
              )}
            </div>
          ))}

          <button className="btn-ghost-gold" onClick={() => addAnswer(qi)} style={{ marginTop: "0.4rem", fontSize: "0.72rem", padding: "0.35rem 0.75rem" }}>
            + Add Answer
          </button>
        </div>
      ))}

      <button className="btn-ghost-gold" onClick={addQuestion} style={{ marginTop: "0.5rem" }}>
        + Add Question
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
          {saving ? "Saving…" : "Save Quiz"}
        </button>
      </div>
    </>
  );
}
