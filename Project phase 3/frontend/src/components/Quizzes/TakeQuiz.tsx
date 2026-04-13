import React, { useEffect, useState } from "react";
import useCurrentUser from "../../hooks/useCurrentUser.js";
import { listQuizzes, getQuiz, submitQuiz, updateQuiz, deleteQuiz, type Quiz, type Score } from "../../api/quizzes.js";

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

  // Edit modal state
  const [editingQuizId, setEditingQuizId] = useState<number | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editDescription, setEditDescription] = useState("");

  // Delete modal state
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<number | null>(null);

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
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.user_id]);

  const openQuiz = async (quizId: number) => {
    try {
      setError(null);
      setSubmitted(false);
      setAnswers({});
      const quiz = await getQuiz(quizId);
      setSelectedQuiz(quiz);
    } catch (err: unknown) {
      setError(typeof err === "string" ? err : "Failed to load quiz");
    }
  };

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
    if (!selectedQuiz) { setError("No quiz selected"); return; }
    if (!user?.user_id) { setError("No logged-in user found"); return; }
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
  const totalQuestions = questions.length;
  const answeredQuestions = Object.keys(answers).length;

  if (submitted && score) {
    const percentage =
      score.max_score > 0 ? Math.round((score.score / score.max_score) * 100) : 0;

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

  // ── Take quiz ──────────────────────────────────────────────────────────────
  return (
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
          </div>
        ))}
      </div>

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
  );
}
