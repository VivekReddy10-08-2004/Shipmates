import { useEffect, useState, forwardRef, useImperativeHandle } from "react";
import {
  listFlashcardSets,
  getFlashcardSet,
  deleteFlashcardSet,
  updateFlashcardSet,
  updateFlashcard,
  deleteFlashcard,
  type Flashcard,
  type FlashcardSet,
} from "../../api/flashcards.js";
import useCurrentUser from "../../hooks/useCurrentUser.js";
import { useReloadListener } from "../../utils/reloadEvents.js";

const PracticeFlashcards = forwardRef((_props, ref) => {
  const { user } = useCurrentUser();
  const [sets, setSets] = useState<FlashcardSet[]>([]);
  const [selected, setSelected] = useState<FlashcardSet | null>(null);
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [editingSetId, setEditingSetId] = useState<number | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [editMode, setEditMode] = useState<"set" | "cards">("set");
  const [cardsData, setCardsData] = useState<Flashcard[]>([]);
  const [editingCardId, setEditingCardId] = useState<number | null>(null);
  const [editCardFront, setEditCardFront] = useState("");
  const [editCardBack, setEditCardBack] = useState("");
  const [deleteCardId, setDeleteCardId] = useState<number | null>(null);

  const reloadSets = () => {
    setLoading(true);
    listFlashcardSets(1, 20, user?.user_id)
      .then((data: any) => {
        const items = data.items || data;
        setSets(items);
      })
      .catch((err: unknown) => {
        setError(typeof err === "string" ? err : "Failed to load sets");
        setSets([]);
      })
      .finally(() => setLoading(false));
  };

  useImperativeHandle(ref, () => ({ reloadSets }));

  useEffect(() => {
    reloadSets();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.user_id]);

  useReloadListener("flashcards", reloadSets);

  // Lock body scroll while any modal is open
  useEffect(() => {
    const anyOpen =
      selected != null ||
      editingSetId != null ||
      showDeleteConfirm != null ||
      deleteCardId != null;
    if (anyOpen) {
      document.body.classList.add("study-scroll-lock");
    } else {
      document.body.classList.remove("study-scroll-lock");
    }
    return () => document.body.classList.remove("study-scroll-lock");
  }, [selected, editingSetId, showDeleteConfirm, deleteCardId]);

  // Escape closes the practice modal
  useEffect(() => {
    if (!selected) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closePractice();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected]);

  const openSet = async (id: number) => {
    try {
      setError(null);
      const data = await getFlashcardSet(id);
      setSelected(data);
      setIndex(0);
      setFlipped(false);
    } catch (err: unknown) {
      setError(typeof err === "string" ? err : "Failed to load set");
    }
  };

  const closePractice = () => {
    setSelected(null);
    setFlipped(false);
    setIndex(0);
  };

  const handleEditClick = async (set: FlashcardSet) => {
    try {
      setEditingSetId(set.set_id);
      setEditTitle(set.title || "");
      setEditDescription(set.description || "");
      setEditMode("set");
      const fullSet = await getFlashcardSet(set.set_id);
      setCardsData(fullSet.cards || []);
    } catch (err: unknown) {
      setError(typeof err === "string" ? err : "Failed to load set details");
      setCardsData([]);
    }
  };

  const handleSaveEdit = async () => {
    if (editingSetId == null) return;
    try {
      setSaving(true);
      setError(null);
      await updateFlashcardSet(editingSetId, {
        title: editTitle,
        description: editDescription,
      });
      setEditingSetId(null);
      setEditMode("set");
      reloadSets();
    } catch (err: unknown) {
      setError(typeof err === "string" ? err : "Failed to save changes");
    } finally {
      setSaving(false);
    }
  };

  const handleEditCard = (card: Flashcard) => {
    setEditingCardId(card.flashcard_id ?? null);
    setEditCardFront(card.front_text || card.front || "");
    setEditCardBack(card.back_text || card.back || "");
  };

  const handleSaveCard = async () => {
    if (editingCardId == null) return;
    try {
      setSaving(true);
      setError(null);
      await updateFlashcard(editingCardId, {
        front_text: editCardFront,
        back_text: editCardBack,
      });
      setCardsData(
        cardsData.map((c) =>
          c.flashcard_id === editingCardId
            ? { ...c, front_text: editCardFront, back_text: editCardBack }
            : c
        )
      );
      setEditingCardId(null);
    } catch (err: unknown) {
      setError(typeof err === "string" ? err : "Failed to save card");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteCard = async (cardId: number) => {
    try {
      setSaving(true);
      setError(null);
      await deleteFlashcard(cardId);
      setCardsData(cardsData.filter((c) => c.flashcard_id !== cardId));
      setDeleteCardId(null);
    } catch (err: unknown) {
      setError(typeof err === "string" ? err : "Failed to delete card");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteClick = async (setId: number) => {
    try {
      setSaving(true);
      setError(null);
      await deleteFlashcardSet(setId);
      setShowDeleteConfirm(null);
      reloadSets();
    } catch (err: unknown) {
      setError(typeof err === "string" ? err : "Failed to delete set");
    } finally {
      setSaving(false);
    }
  };

  const cards = selected?.cards || [];
  const card = cards[index];
  const total = cards.length;

  return (
    <>
      {loading && <div className="study-empty">Loading sets…</div>}
      {error && !selected && <div className="study-notice study-notice-error">{error}</div>}
      {!loading && sets.length === 0 && (
        <div className="study-empty">No sets in your logbook yet — forge one above!</div>
      )}

      <div>
        {sets.map((s: FlashcardSet) => (
          <div key={s.set_id} className="study-item-row">
            <button className="study-item-main" onClick={() => openSet(s.set_id)}>
              <div className="study-item-title">{s.title || `Set ${s.set_id}`}</div>
              {s.description && <div className="study-item-desc">{s.description}</div>}
            </button>
            <button className="btn-ghost-gold" onClick={() => handleEditClick(s)}>
              Edit
            </button>
            <button className="btn-danger-ghost" onClick={() => setShowDeleteConfirm(s.set_id)}>
              Delete
            </button>
          </div>
        ))}
      </div>

      {/* Edit modal (parchment) */}
      {editingSetId != null && (
        <div className="study-modal-backdrop" onClick={() => !saving && setEditingSetId(null)}>
          <div
            className="study-modal"
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: "620px" }}
          >
            <h3>Edit Flashcard Set</h3>

            <div style={{ display: "flex", gap: "0.5rem", marginBottom: "1.2rem", borderBottom: "1.5px solid rgba(90,58,26,0.3)" }}>
              <button
                onClick={() => setEditMode("set")}
                style={{
                  padding: "0.5rem 1rem",
                  border: "none",
                  background: editMode === "set" ? "rgba(61,38,16,0.15)" : "transparent",
                  color: editMode === "set" ? "#2a1808" : "#6b4526",
                  cursor: "pointer",
                  fontWeight: 700,
                  fontFamily: "var(--font-heading)",
                  letterSpacing: "0.06em",
                  textTransform: "uppercase",
                  fontSize: "0.8rem",
                  borderBottom: editMode === "set" ? "2px solid #8b2500" : "2px solid transparent",
                }}
              >
                Set Details
              </button>
              <button
                onClick={() => setEditMode("cards")}
                style={{
                  padding: "0.5rem 1rem",
                  border: "none",
                  background: editMode === "cards" ? "rgba(61,38,16,0.15)" : "transparent",
                  color: editMode === "cards" ? "#2a1808" : "#6b4526",
                  cursor: "pointer",
                  fontWeight: 700,
                  fontFamily: "var(--font-heading)",
                  letterSpacing: "0.06em",
                  textTransform: "uppercase",
                  fontSize: "0.8rem",
                  borderBottom: editMode === "cards" ? "2px solid #8b2500" : "2px solid transparent",
                }}
              >
                Cards ({cardsData.length})
              </button>
            </div>

            {editMode === "set" && (
              <>
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
              </>
            )}

            {editMode === "cards" && (
              <>
                {editingCardId ? (
                  <>
                    <label>Front (Question)</label>
                    <textarea
                      value={editCardFront}
                      onChange={(e) => setEditCardFront(e.target.value)}
                    />
                    <label>Back (Answer)</label>
                    <textarea
                      value={editCardBack}
                      onChange={(e) => setEditCardBack(e.target.value)}
                    />
                    <div className="study-modal-actions">
                      <button
                        className="btn-ghost-gold"
                        onClick={() => setEditingCardId(null)}
                        disabled={saving}
                        style={{ color: "#3d2610", borderColor: "rgba(90,58,26,0.4)" }}
                      >
                        Cancel
                      </button>
                      <button className="btn-wood" onClick={handleSaveCard} disabled={saving}>
                        {saving ? "Saving…" : "Save Card"}
                      </button>
                    </div>
                  </>
                ) : (
                  <div style={{ maxHeight: "420px", overflowY: "auto" }}>
                    {cardsData.length === 0 ? (
                      <div style={{ textAlign: "center", padding: "2rem 0", color: "#6b4526", fontStyle: "italic" }}>
                        No cards yet.
                      </div>
                    ) : (
                      cardsData.map((c, idx) => (
                        <div
                          key={c.flashcard_id ?? idx}
                          style={{
                            padding: "0.85rem 1rem",
                            marginBottom: "0.6rem",
                            borderRadius: "0.45rem",
                            border: "1.5px solid rgba(90,58,26,0.35)",
                            background: "rgba(255,250,230,0.6)",
                          }}
                        >
                          <div style={{ fontSize: "0.75rem", color: "#6b4526", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: "0.15rem" }}>
                            Front
                          </div>
                          <div style={{ color: "#2a1808", fontSize: "0.95rem", marginBottom: "0.5rem" }}>
                            {c.front_text || c.front}
                          </div>
                          <div style={{ fontSize: "0.75rem", color: "#6b4526", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: "0.15rem" }}>
                            Back
                          </div>
                          <div style={{ color: "#2a1808", fontSize: "0.95rem", marginBottom: "0.6rem" }}>
                            {c.back_text || c.back}
                          </div>
                          <div style={{ display: "flex", gap: "0.5rem", justifyContent: "flex-end" }}>
                            <button
                              className="btn-ghost-gold"
                              onClick={() => handleEditCard(c)}
                              style={{ color: "#3d2610", borderColor: "rgba(90,58,26,0.4)", fontSize: "0.72rem", padding: "0.3rem 0.7rem" }}
                            >
                              Edit
                            </button>
                            <button
                              className="btn-danger-ghost"
                              onClick={() => setDeleteCardId(c.flashcard_id ?? null)}
                              style={{ fontSize: "0.72rem", padding: "0.3rem 0.7rem" }}
                            >
                              Delete
                            </button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </>
            )}

            {deleteCardId != null && (
              <div className="study-modal-backdrop" onClick={() => !saving && setDeleteCardId(null)} style={{ zIndex: 1200 }}>
                <div className="study-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: "340px" }}>
                  <h4>Delete card?</h4>
                  <p className="study-modal-warn">This cannot be undone.</p>
                  <div className="study-modal-actions">
                    <button
                      className="btn-ghost-gold"
                      onClick={() => setDeleteCardId(null)}
                      disabled={saving}
                      style={{ color: "#3d2610", borderColor: "rgba(90,58,26,0.4)" }}
                    >
                      Cancel
                    </button>
                    <button
                      className="btn-wood"
                      onClick={() => handleDeleteCard(deleteCardId)}
                      disabled={saving}
                      style={{ background: "linear-gradient(180deg, #7a2418, #4a1008)" }}
                    >
                      {saving ? "Deleting…" : "Delete"}
                    </button>
                  </div>
                </div>
              </div>
            )}

            <div className="study-modal-actions">
              <button
                className="btn-ghost-gold"
                onClick={() => setEditingSetId(null)}
                disabled={saving}
                style={{ color: "#3d2610", borderColor: "rgba(90,58,26,0.4)" }}
              >
                Close
              </button>
              {editMode === "set" && (
                <button className="btn-wood" onClick={handleSaveEdit} disabled={saving}>
                  {saving ? "Saving…" : "Save Changes"}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Delete set confirm modal */}
      {showDeleteConfirm != null && (
        <div className="study-modal-backdrop" onClick={() => !saving && setShowDeleteConfirm(null)}>
          <div className="study-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: "400px" }}>
            <h4>Send this set to the depths?</h4>
            <p className="study-modal-warn">
              This cannot be undone. All cards in this set will be lost.
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

      {/* FULL MODAL — practice */}
      {selected && (
        <div className="study-fullmodal-backdrop" onClick={closePractice}>
          <div className="study-fullmodal" onClick={(e) => e.stopPropagation()}>
            <button
              className="study-fullmodal-close"
              onClick={closePractice}
              aria-label="Close"
            >
              ×
            </button>

            <div style={{ marginBottom: "1.3rem", paddingBottom: "0.9rem", borderBottom: "1px solid rgba(212,168,67,0.3)", paddingRight: "2.5rem" }}>
              <div style={{ fontFamily: "var(--font-heading)", fontSize: "1.35rem", color: "var(--parchment)", letterSpacing: "0.04em" }}>
                {selected.title}
              </div>
              <div style={{ fontSize: "0.78rem", color: "var(--gold)", letterSpacing: "0.1em", textTransform: "uppercase", marginTop: "0.5rem" }}>
                Card {index + 1} of {total}
              </div>
            </div>

            {card ? (
              <div>
                <div
                  className={`flashcard-card ${flipped ? "flipped" : ""}`}
                  onClick={() => setFlipped((f) => !f)}
                  style={{ margin: "0 auto 1.2rem auto" }}
                >
                  <div className="flashcard-front">{card.front_text || card.front || "No front"}</div>
                  <div className="flashcard-back">{card.back_text || card.back || "No back"}</div>
                </div>

                <div
                  style={{
                    fontSize: "0.78rem",
                    color: "var(--text-muted)",
                    marginBottom: "1rem",
                    textAlign: "center",
                    letterSpacing: "0.08em",
                    textTransform: "uppercase",
                  }}
                >
                  Click card to flip • {flipped ? "Showing Answer" : "Showing Question"}
                </div>

                <div style={{ display: "flex", gap: "0.7rem", justifyContent: "center", flexWrap: "wrap" }}>
                  <button
                    className="btn-ghost-gold"
                    onClick={() => {
                      if (index > 0) {
                        setIndex(index - 1);
                        setFlipped(false);
                      }
                    }}
                    disabled={index === 0}
                    style={{ opacity: index === 0 ? 0.45 : 1 }}
                  >
                    ← Prev
                  </button>

                  <button
                    className="btn-treasure"
                    onClick={() => {
                      if (index < total - 1) {
                        setIndex(index + 1);
                        setFlipped(false);
                      }
                    }}
                    disabled={index === total - 1}
                  >
                    Next →
                  </button>
                </div>
              </div>
            ) : (
              <div className="study-empty">No cards in this set.</div>
            )}
          </div>
        </div>
      )}
    </>
  );
});

PracticeFlashcards.displayName = "PracticeFlashcards";
export default PracticeFlashcards;
