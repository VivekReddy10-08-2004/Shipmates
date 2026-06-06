import { useEffect, useRef, useState } from "react";
import useCurrentUser from "../../hooks/useCurrentUser.js";
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

  const [editingQuizId, setEditingQuizId] = useState<number | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editDescription, setEditDescription] = useState("");

  const [showDeleteConfirm, setShowDeleteConfirm] = useState<number | null>(null);

  const modalScrollRef = useRef<HTMLDivElement | null>(null);
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

  const closeQuiz = () => {
    setSelectedQuiz(null);
    setSubmitted(false);
    setScore(null);
    setAnswers({});
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
    if (!selectedQuiz) {
      setError("No quiz selected");
      return;
    }
    if (!user?.user_id) {
      setError("No logged-in user found");
      return;
    }
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

  const questions = selectedQuiz?.questions ?? [];
  const totalQuestions = questions.length;
  const answeredQuestions = Object.keys(answers).length;

  const percentage =
    score && score.max_score > 0
      ? Math.round((score.score / score.max_score) * 100)
      : 0;

  let verdict = "Keep studying, sailor!";
  if (percentage === 100) verdict = "Perfect voyage!";
  else if (percentage >= 80) verdict = "Smooth sailing";
  else if (percentage >= 60) verdict = "Steady as she goes";
  else if (percentage >= 40) verdict = "Rough seas ahead";

  return (
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
          </div>
        ))}
      </div>

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
  );
}
