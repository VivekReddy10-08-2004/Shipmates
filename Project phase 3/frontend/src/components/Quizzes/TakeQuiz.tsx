import { useEffect, useRef, useState } from "react";
import useCurrentUser from "../../hooks/useCurrentUser.js";
<<<<<<< HEAD
import { listQuizzes, getQuiz, submitQuiz, updateQuiz, deleteQuiz, type Quiz, type Score } from "../../api/quizzes.js";
=======
import {
  listQuizzes,
  getQuiz,
  submitQuiz,
  updateQuiz,
  deleteQuiz,
  type Quiz,
  type Score,
} from "../../api/quizzes.js";
import { useReloadListener } from "../../utils/reloadEvents.js";
>>>>>>> ed7381045efd822ddca9b9363bc01a31b568ef21

export default function TakeQuiz() {
  const { user } = useCurrentUser();

  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [selectedQuiz, setSelectedQuiz] = useState<Quiz | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [submitted, setSubmitted] = useState(false);
  const [score, setScore] = useState<Score | null>(null);
  const [saving, setSaving] = useState(false);

<<<<<<< HEAD
  // Edit modal state
=======
>>>>>>> ed7381045efd822ddca9b9363bc01a31b568ef21
  const [editingQuizId, setEditingQuizId] = useState<number | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editDescription, setEditDescription] = useState("");

<<<<<<< HEAD
  // Delete modal state
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<number | null>(null);

=======
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<number | null>(null);

  const modalScrollRef = useRef<HTMLDivElement | null>(null);

>>>>>>> ed7381045efd822ddca9b9363bc01a31b568ef21
  const reloadQuizzes = () => {
    setLoading(true);
    listQuizzes(1, 20, user?.user_id)
      .then((data: any) => {
        const items = data.items || data;
        setQuizzes(items);
      })
      .catch((err: unknown) => {
        setError(typeof err === "string" ? err : "Failed to load quizzes");
        setQuizzes([]);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    reloadQuizzes();
<<<<<<< HEAD
  // eslint-disable-next-line react-hooks/exhaustive-deps
=======
    // eslint-disable-next-line react-hooks/exhaustive-deps
>>>>>>> ed7381045efd822ddca9b9363bc01a31b568ef21
  }, [user?.user_id]);

  useReloadListener("quizzes", reloadQuizzes);

  // Lock body scroll while the take-quiz modal is open
  useEffect(() => {
    const anyModalOpen =
      selectedQuiz != null || editingQuizId != null || showDeleteConfirm != null;
    if (anyModalOpen) {
      document.body.classList.add("study-scroll-lock");
    } else {
      document.body.classList.remove("study-scroll-lock");
    }
    return () => document.body.classList.remove("study-scroll-lock");
  }, [selectedQuiz, editingQuizId, showDeleteConfirm]);

  // Escape closes the quiz modal
  useEffect(() => {
    if (!selectedQuiz) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeQuiz();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedQuiz]);

  // Scroll the modal content to top whenever it switches screens (take/result)
  useEffect(() => {
    if (modalScrollRef.current) modalScrollRef.current.scrollTop = 0;
  }, [selectedQuiz?.quiz_id, submitted]);

  const openQuiz = async (quizId: number) => {
    try {
      setError(null);
      setSubmitted(false);
      setScore(null);
      setAnswers({});
      const quiz = await getQuiz(quizId);
      setSelectedQuiz(quiz);
    } catch (err: unknown) {
      setError(typeof err === "string" ? err : "Failed to load quiz");
    }
  };

<<<<<<< HEAD
=======
  const closeQuiz = () => {
    setSelectedQuiz(null);
    setSubmitted(false);
    setScore(null);
    setAnswers({});
  };

>>>>>>> ed7381045efd822ddca9b9363bc01a31b568ef21
  const handleEditClick = (quiz: Quiz) => {
    setEditingQuizId(quiz.quiz_id);
    setEditTitle(quiz.title || "");
    setEditDescription(quiz.description || "");
  };

  const handleSaveEdit = async () => {
    if (editingQuizId == null) return;
    try {
      setSaving(true);
      setError(null);
      await updateQuiz(editingQuizId, { title: editTitle, description: editDescription });
      setEditingQuizId(null);
      reloadQuizzes();
    } catch (err: unknown) {
      setError(typeof err === "string" ? err : "Failed to save changes");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteClick = async (quizId: number) => {
    try {
      setSaving(true);
      setError(null);
      await deleteQuiz(quizId);
      setShowDeleteConfirm(null);
      reloadQuizzes();
    } catch (err: unknown) {
      setError(typeof err === "string" ? err : "Failed to delete quiz");
    } finally {
      setSaving(false);
    }
  };

  const handleSelectAnswer = (questionId: number, answerId: number) => {
    setAnswers({ ...answers, [questionId]: answerId });
  };

  const handleSubmit = async () => {
<<<<<<< HEAD
    if (!selectedQuiz) { setError("No quiz selected"); return; }
    if (!user?.user_id) { setError("No logged-in user found"); return; }
=======
    if (!selectedQuiz) {
      setError("No quiz selected");
      return;
    }
    if (!user?.user_id) {
      setError("No logged-in user found");
      return;
    }
>>>>>>> ed7381045efd822ddca9b9363bc01a31b568ef21
    try {
      setError(null);
      const result = await submitQuiz({
        user_id: Number(user.user_id),
        quiz_id: selectedQuiz.quiz_id,
        answers,
      });
      setScore(result);
      setSubmitted(true);
    } catch (err: unknown) {
      setError(typeof err === "string" ? err : "Failed to submit quiz");
    }
  };

<<<<<<< HEAD
  // ── Quiz list ──────────────────────────────────────────────────────────────
  if (!selectedQuiz) {
    return (
      <div>
        <h1 className="page-subtitle">Take a Quiz</h1>
        <div className="card" style={{ marginTop: "2rem" }}>
          {loading && <div style={{ color: "#9ca3af" }}>Loading quizzes...</div>}
          {error && <div style={{ color: "#f97373", marginBottom: "1rem" }}>{error}</div>}
          {!loading && quizzes.length === 0 && (
            <div style={{ color: "#9ca3af" }}>No quizzes available</div>
          )}

          {/* Edit modal */}
          {editingQuizId && (
            <div style={{
              position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
              background: "rgba(0,0,0,0.7)", display: "flex",
              alignItems: "center", justifyContent: "center", zIndex: 1000,
            }}>
              <div style={{
                background: "rgba(15,23,42,0.95)",
                border: "1px solid rgba(148,163,184,0.3)",
                borderRadius: "0.75rem", padding: "1.5rem",
                maxWidth: "480px", width: "95%",
              }}>
                <h4 style={{ marginTop: 0, marginBottom: "1rem" }}>Edit Quiz</h4>

                <div style={{ marginBottom: "1rem" }}>
                  <label style={{ display: "block", marginBottom: "0.5rem", fontSize: "0.9rem", color: "#cbd5e1" }}>
                    Title
                  </label>
                  <input
                    type="text"
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    style={{
                      width: "100%", padding: "0.5rem", borderRadius: "0.5rem",
                      border: "1px solid rgba(148,163,184,0.3)",
                      background: "rgba(30,41,59,0.5)", color: "#e5e7eb", boxSizing: "border-box",
                    }}
                  />
                </div>

                <div style={{ marginBottom: "1.5rem" }}>
                  <label style={{ display: "block", marginBottom: "0.5rem", fontSize: "0.9rem", color: "#cbd5e1" }}>
                    Description
                  </label>
                  <textarea
                    value={editDescription}
                    onChange={(e) => setEditDescription(e.target.value)}
                    style={{
                      width: "100%", padding: "0.5rem", borderRadius: "0.5rem",
                      border: "1px solid rgba(148,163,184,0.3)",
                      background: "rgba(30,41,59,0.5)", color: "#e5e7eb",
                      boxSizing: "border-box", minHeight: "80px", fontFamily: "inherit",
                    }}
                  />
                </div>

                <div style={{ display: "flex", gap: "0.75rem", justifyContent: "flex-end", paddingTop: "1rem", borderTop: "1px solid rgba(148,163,184,0.3)" }}>
                  <button
                    onClick={() => setEditingQuizId(null)}
                    disabled={saving}
                    style={{
                      padding: "0.5rem 1rem", borderRadius: "0.5rem",
                      border: "1px solid rgba(148,163,184,0.3)",
                      background: "rgba(128,128,128,0.2)", color: "#e5e7eb",
                      cursor: saving ? "default" : "pointer", opacity: saving ? 0.5 : 1,
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSaveEdit}
                    disabled={saving}
                    style={{
                      padding: "0.5rem 1rem", borderRadius: "0.5rem",
                      border: "1px solid rgba(34,197,94,0.5)",
                      background: "rgba(34,197,94,0.2)", color: "#e5e7eb",
                      cursor: saving ? "default" : "pointer", opacity: saving ? 0.5 : 1,
                    }}
                  >
                    {saving ? "Saving..." : "Save Changes"}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Delete confirm modal */}
          {showDeleteConfirm && (
            <div style={{
              position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
              background: "rgba(0,0,0,0.7)", display: "flex",
              alignItems: "center", justifyContent: "center", zIndex: 1000,
            }}>
              <div style={{
                background: "rgba(15,23,42,0.95)",
                border: "1px solid rgba(239,68,68,0.5)",
                borderRadius: "0.75rem", padding: "1.5rem",
                maxWidth: "400px", width: "90%",
              }}>
                <h4 style={{ marginTop: 0, color: "#f87171" }}>Delete Quiz?</h4>
                <p style={{ color: "#cbd5e1", marginBottom: "1.5rem" }}>
                  This action cannot be undone. All questions and answers will be permanently deleted.
                </p>
                <div style={{ display: "flex", gap: "0.75rem", justifyContent: "flex-end" }}>
                  <button
                    onClick={() => setShowDeleteConfirm(null)}
                    disabled={saving}
                    style={{
                      padding: "0.5rem 1rem", borderRadius: "0.5rem",
                      border: "1px solid rgba(148,163,184,0.3)",
                      background: "rgba(128,128,128,0.2)", color: "#e5e7eb",
                      cursor: saving ? "default" : "pointer", opacity: saving ? 0.5 : 1,
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => handleDeleteClick(showDeleteConfirm)}
                    disabled={saving}
                    style={{
                      padding: "0.5rem 1rem", borderRadius: "0.5rem",
                      border: "1px solid rgba(239,68,68,0.5)",
                      background: "rgba(239,68,68,0.2)", color: "#e5e7eb",
                      cursor: saving ? "default" : "pointer", opacity: saving ? 0.5 : 1,
                    }}
                  >
                    {saving ? "Deleting..." : "Delete"}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Quiz list */}
          <div style={{ marginTop: "1rem" }}>
            {quizzes.map((q: Quiz) => (
              <div
                key={q.quiz_id}
                style={{
                  display: "flex", alignItems: "center", gap: "0.75rem",
                  padding: "0.75rem 1rem", marginBottom: "0.5rem",
                  borderRadius: "0.75rem", border: "1px solid rgba(148,163,184,0.3)",
                  background: "rgba(14,165,233,0.1)", transition: "all 0.2s ease",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = "rgba(14,165,233,0.2)";
                  e.currentTarget.style.borderColor = "rgba(14,165,233,0.5)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = "rgba(14,165,233,0.1)";
                  e.currentTarget.style.borderColor = "rgba(148,163,184,0.3)";
                }}
              >
                <button
                  onClick={() => openQuiz(q.quiz_id)}
                  style={{
                    flex: 1, padding: 0, border: "none",
                    background: "transparent", color: "#e5e7eb",
                    cursor: "pointer", textAlign: "left", fontSize: "0.95rem",
                  }}
                >
                  <strong>{q.title}</strong>
                  {q.description && (
                    <div style={{ fontSize: "0.8rem", color: "#9ca3af", marginTop: "0.25rem" }}>
                      {q.description}
                    </div>
                  )}
                </button>

                <button
                  onClick={() => handleEditClick(q)}
                  style={{
                    padding: "0.4rem 0.8rem", borderRadius: "0.4rem", border: "none",
                    background: "rgba(59,130,246,0.2)", color: "#93c5fd",
                    cursor: "pointer", fontSize: "0.8rem", whiteSpace: "nowrap",
                  }}
                >
                  Edit
                </button>

                <button
                  onClick={() => setShowDeleteConfirm(q.quiz_id)}
                  style={{
                    padding: "0.4rem 0.8rem", borderRadius: "0.4rem", border: "none",
                    background: "rgba(239,68,68,0.2)", color: "#fca5a5",
                    cursor: "pointer", fontSize: "0.8rem", whiteSpace: "nowrap",
                  }}
                >
                  Delete
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // ── Score screen ───────────────────────────────────────────────────────────
  const { questions = [] } = selectedQuiz;
=======
  // ── Render: list ALWAYS visible; modal overlay when a quiz is selected ──
  const questions = selectedQuiz?.questions ?? [];
>>>>>>> ed7381045efd822ddca9b9363bc01a31b568ef21
  const totalQuestions = questions.length;
  const answeredQuestions = Object.keys(answers).length;

  const percentage =
    score && score.max_score > 0
      ? Math.round((score.score / score.max_score) * 100)
      : 0;

<<<<<<< HEAD
    return (
      <div className="card" style={{ marginTop: "2rem" }}>
        <h3>{selectedQuiz.title}</h3>
        <div style={{
          background: "rgba(34,197,94,0.1)", border: "1px solid rgba(34,197,94,0.3)",
          borderRadius: "0.75rem", padding: "2rem", textAlign: "center", marginBottom: "2rem",
        }}>
          <div style={{ fontSize: "3rem", color: "#22c55e", marginBottom: "1rem" }}>{percentage}%</div>
          <div style={{ fontSize: "1.5rem", color: "#e5e7eb", marginBottom: "0.5rem" }}>
            Score: {score.score} / {score.max_score}
          </div>
          <div style={{ fontSize: "0.9rem", color: "#9ca3af" }}>
            {score.score === score.max_score ? "Perfect!" : "Good effort!"}
          </div>
        </div>

        <button
          onClick={() => setSelectedQuiz(null)}
          style={{
            display: "block", width: "100%", padding: "0.75rem 1rem",
            borderRadius: "0.5rem", border: "1px solid rgba(148,163,184,0.3)",
            background: "rgba(14,165,233,0.15)", color: "#e5e7eb", cursor: "pointer", fontSize: "0.9rem",
          }}
        >
          Back to Quizzes
        </button>
      </div>
    );
  }
=======
  let verdict = "Keep studying, sailor!";
  if (percentage === 100) verdict = "Perfect voyage!";
  else if (percentage >= 80) verdict = "Smooth sailing";
  else if (percentage >= 60) verdict = "Steady as she goes";
  else if (percentage >= 40) verdict = "Rough seas ahead";
>>>>>>> ed7381045efd822ddca9b9363bc01a31b568ef21

  // ── Take quiz ──────────────────────────────────────────────────────────────
  return (
<<<<<<< HEAD
    <div className="card" style={{ marginTop: "2rem" }}>
      <div style={{ marginBottom: "1.5rem", paddingBottom: "1rem", borderBottom: "1px solid rgba(148,163,184,0.3)" }}>
        <h3 style={{ margin: 0, marginBottom: "0.5rem" }}>{selectedQuiz.title}</h3>
        {selectedQuiz.description && (
          <div style={{ fontSize: "0.9rem", color: "#9ca3af" }}>{selectedQuiz.description}</div>
        )}
        <div style={{ fontSize: "0.85rem", color: "#cbd5e1", marginTop: "0.5rem" }}>
          Progress: {answeredQuestions} of {totalQuestions} answered
        </div>
      </div>

      {error && <div style={{ color: "#f97373", marginBottom: "1rem" }}>{error}</div>}

      <div style={{ maxHeight: "600px", overflowY: "auto", marginBottom: "2rem" }}>
        {questions.map((question: any, idx: number) => (
          <div
            key={question.question_id}
            style={{
              marginBottom: "2rem", paddingBottom: "1.5rem",
              borderBottom: idx < questions.length - 1 ? "1px solid rgba(148,163,184,0.2)" : "none",
            }}
          >
            <div style={{ marginBottom: "1rem" }}>
              <div style={{ fontSize: "0.9rem", color: "#cbd5e1", fontWeight: "600" }}>
                Question {idx + 1} of {totalQuestions}
              </div>
              <h4 style={{ margin: "0.5rem 0 1rem 0", color: "#e5e7eb", fontSize: "1rem" }}>
                {question.question_text}
              </h4>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
              {(question.answers || []).map((answer: any) => (
                <label
                  key={answer.answer_id}
                  style={{
                    display: "flex", alignItems: "center",
                    padding: "0.75rem 1rem", borderRadius: "0.5rem",
                    border: "1px solid rgba(148,163,184,0.3)",
                    background: answers[question.question_id] === answer.answer_id
                      ? "rgba(14,165,233,0.2)" : "rgba(30,41,59,0.3)",
                    cursor: "pointer", transition: "all 0.2s ease",
                  }}
                  onMouseEnter={(e) => {
                    if (answers[question.question_id] !== answer.answer_id)
                      e.currentTarget.style.background = "rgba(30,41,59,0.5)";
                  }}
                  onMouseLeave={(e) => {
                    if (answers[question.question_id] !== answer.answer_id)
                      e.currentTarget.style.background = "rgba(30,41,59,0.3)";
                  }}
                >
                  <input
                    type="radio"
                    name={`question-${question.question_id}`}
                    value={answer.answer_id}
                    checked={answers[question.question_id] === answer.answer_id}
                    onChange={() => handleSelectAnswer(question.question_id, answer.answer_id)}
                    style={{ marginRight: "0.75rem", cursor: "pointer" }}
                  />
                  <span style={{ color: "#e5e7eb" }}>{answer.answer_text}</span>
                </label>
              ))}
            </div>
=======
    <>
      {loading && <div className="study-empty">Loading quizzes…</div>}
      {error && !selectedQuiz && <div className="study-notice study-notice-error">{error}</div>}
      {!loading && quizzes.length === 0 && (
        <div className="study-empty">No quizzes in your logbook yet — forge one above!</div>
      )}

      <div>
        {quizzes.map((q: Quiz) => (
          <div key={q.quiz_id} className="study-item-row">
            <button className="study-item-main" onClick={() => openQuiz(q.quiz_id)}>
              <div className="study-item-title">{q.title}</div>
              {q.description && <div className="study-item-desc">{q.description}</div>}
            </button>
            <button className="btn-ghost-gold" onClick={() => handleEditClick(q)}>
              Edit
            </button>
            <button className="btn-danger-ghost" onClick={() => setShowDeleteConfirm(q.quiz_id)}>
              Delete
            </button>
>>>>>>> ed7381045efd822ddca9b9363bc01a31b568ef21
          </div>
        ))}
      </div>

<<<<<<< HEAD
      <div style={{ display: "flex", gap: "0.75rem", justifyContent: "flex-end" }}>
        <button
          onClick={() => setSelectedQuiz(null)}
          style={{
            padding: "0.75rem 1.5rem", borderRadius: "0.5rem",
            border: "1px solid rgba(148,163,184,0.3)",
            background: "rgba(128,128,128,0.2)", color: "#e5e7eb",
            cursor: "pointer", fontSize: "0.9rem",
          }}
        >
          Back
        </button>
        <button
          onClick={handleSubmit}
          disabled={answeredQuestions === 0}
          style={{
            padding: "0.75rem 1.5rem", borderRadius: "0.5rem",
            border: "1px solid rgba(34,197,94,0.5)",
            background: "rgba(34,197,94,0.2)", color: "#e5e7eb",
            cursor: answeredQuestions === 0 ? "default" : "pointer",
            fontSize: "0.9rem", opacity: answeredQuestions === 0 ? 0.5 : 1,
          }}
        >
          Submit Quiz
        </button>
      </div>
    </div>
=======
      {/* Edit modal (parchment) */}
      {editingQuizId != null && (
        <div className="study-modal-backdrop" onClick={() => !saving && setEditingQuizId(null)}>
          <div className="study-modal" onClick={(e) => e.stopPropagation()}>
            <h3>Edit Quiz</h3>
            <label>Title</label>
            <input
              type="text"
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
            />
            <label>Description</label>
            <textarea
              value={editDescription}
              onChange={(e) => setEditDescription(e.target.value)}
            />
            <div className="study-modal-actions">
              <button
                className="btn-ghost-gold"
                onClick={() => setEditingQuizId(null)}
                disabled={saving}
                style={{ color: "#3d2610", borderColor: "rgba(90,58,26,0.4)" }}
              >
                Cancel
              </button>
              <button className="btn-wood" onClick={handleSaveEdit} disabled={saving}>
                {saving ? "Saving…" : "Save Changes"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirm modal (parchment) */}
      {showDeleteConfirm != null && (
        <div className="study-modal-backdrop" onClick={() => !saving && setShowDeleteConfirm(null)}>
          <div className="study-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: "400px" }}>
            <h4>Send this quiz to the depths?</h4>
            <p className="study-modal-warn">
              This cannot be undone. All questions and answers will be lost.
            </p>
            <div className="study-modal-actions">
              <button
                className="btn-ghost-gold"
                onClick={() => setShowDeleteConfirm(null)}
                disabled={saving}
                style={{ color: "#3d2610", borderColor: "rgba(90,58,26,0.4)" }}
              >
                Cancel
              </button>
              <button
                className="btn-wood"
                onClick={() => handleDeleteClick(showDeleteConfirm)}
                disabled={saving}
                style={{ background: "linear-gradient(180deg, #7a2418, #4a1008)" }}
              >
                {saving ? "Deleting…" : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* FULL MODAL — take quiz / results */}
      {selectedQuiz && (
        <div
          ref={modalScrollRef}
          className="study-fullmodal-backdrop"
          onClick={closeQuiz}
        >
          <div className="study-fullmodal" onClick={(e) => e.stopPropagation()}>
            <button
              className="study-fullmodal-close"
              onClick={closeQuiz}
              aria-label="Close"
            >
              ×
            </button>

            {!submitted ? (
              <>
                <div style={{ marginBottom: "1.3rem", paddingBottom: "0.9rem", borderBottom: "1px solid rgba(212,168,67,0.3)", paddingRight: "2.5rem" }}>
                  <div style={{ fontFamily: "var(--font-heading)", fontSize: "1.35rem", color: "var(--parchment)", letterSpacing: "0.04em" }}>
                    {selectedQuiz.title}
                  </div>
                  {selectedQuiz.description && (
                    <div style={{ fontSize: "0.88rem", color: "var(--text-muted)", marginTop: "0.25rem" }}>
                      {selectedQuiz.description}
                    </div>
                  )}
                  <div style={{ fontSize: "0.78rem", color: "var(--gold)", letterSpacing: "0.1em", textTransform: "uppercase", marginTop: "0.5rem" }}>
                    {answeredQuestions} of {totalQuestions} answered
                  </div>
                </div>

                {error && <div className="study-notice study-notice-error">{error}</div>}

                <div>
                  {questions.map((question: any, idx: number) => (
                    <div key={question.question_id} className="quiz-question-block">
                      <div className="quiz-question-label">Question {idx + 1} of {totalQuestions}</div>
                      <div className="quiz-question-text">{question.question_text}</div>

                      <div>
                        {(question.answers || []).map((answer: any) => {
                          const isSelected = answers[question.question_id] === answer.answer_id;
                          return (
                            <label
                              key={answer.answer_id}
                              className={`quiz-answer-choice ${isSelected ? "selected" : ""}`}
                            >
                              <input
                                type="radio"
                                name={`question-${question.question_id}`}
                                value={answer.answer_id}
                                checked={isSelected}
                                onChange={() => handleSelectAnswer(question.question_id, answer.answer_id)}
                              />
                              <span>{answer.answer_text}</span>
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>

                <div style={{ display: "flex", gap: "0.7rem", justifyContent: "flex-end", marginTop: "1rem" }}>
                  <button className="btn-ghost-gold" onClick={closeQuiz}>
                    Close
                  </button>
                  <button
                    className="btn-treasure"
                    onClick={handleSubmit}
                    disabled={answeredQuestions === 0}
                  >
                    Submit Quiz
                  </button>
                </div>
              </>
            ) : (
              <>
                <div style={{ paddingRight: "2.5rem" }}>
                  <div style={{ fontFamily: "var(--font-heading)", fontSize: "1.15rem", color: "var(--parchment)", marginBottom: "0.4rem", letterSpacing: "0.04em" }}>
                    {selectedQuiz.title}
                  </div>
                </div>

                <div className="quiz-result-score-card">
                  <div className="quiz-result-pct">{percentage}%</div>
                  <div className="quiz-result-score">
                    {score!.score} of {score!.max_score} correct
                  </div>
                  <div className="quiz-result-verdict">{verdict}</div>
                </div>

                {score!.results && score!.results.length > 0 && (
                  <>
                    <div className="study-preview-header">Review</div>
                    {score!.results.map((r, idx) => (
                      <div
                        key={r.question_id}
                        className={`quiz-review-block ${r.is_correct ? "correct" : "wrong"}`}
                      >
                        <div className="quiz-review-header">
                          <span className={r.is_correct ? "badge-correct" : "badge-wrong"}>
                            {r.is_correct ? "✓ Correct" : "✗ Incorrect"}
                          </span>
                          <span style={{ color: "var(--text-muted)", letterSpacing: "0.08em" }}>
                            Q{idx + 1}
                          </span>
                        </div>
                        <div className="quiz-review-q">{r.question_text}</div>
                        {!r.is_correct ? (
                          <>
                            <div className="quiz-review-line your">
                              <span className="label">Your answer:</span>
                              {r.selected_answer_text || <em>(no answer)</em>}
                            </div>
                            <div className="quiz-review-line correct-line">
                              <span className="label">Correct:</span>
                              {r.correct_answer_text || <em>(none)</em>}
                            </div>
                          </>
                        ) : (
                          <div className="quiz-review-line correct-line">
                            <span className="label">You chose:</span>
                            {r.selected_answer_text}
                          </div>
                        )}
                      </div>
                    ))}
                  </>
                )}

                <div style={{ display: "flex", gap: "0.7rem", justifyContent: "flex-end", marginTop: "1.2rem" }}>
                  <button className="btn-ghost-gold" onClick={closeQuiz}>
                    Back to Quizzes
                  </button>
                  <button
                    className="btn-treasure"
                    onClick={() => {
                      setSubmitted(false);
                      setScore(null);
                      setAnswers({});
                    }}
                  >
                    Retake Quiz
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
>>>>>>> ed7381045efd822ddca9b9363bc01a31b568ef21
  );
}
