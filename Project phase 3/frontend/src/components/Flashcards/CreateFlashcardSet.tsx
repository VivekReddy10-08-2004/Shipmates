import React, { useState } from "react";
import { createFlashcardSet } from "../../api/flashcards.js";
import useCurrentUser from "../../hooks/useCurrentUser.js";

type CardInput = {
  front: string;
  back: string;
};

type StatusType = {
  kind: "info" | "success" | "error";
  text: string;
};

type Props = {
  onSetCreated?: () => void;
};

export default function CreateFlashcardSet({ onSetCreated }: Props) {
  const { user } = useCurrentUser();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [courseId, setCourseId] = useState(1);

  const [cards, setCards] = useState<CardInput[]>([
    { front: "", back: "" },
  ]);

  const [status, setStatus] = useState<StatusType | null>(null);

  const updateCardFront = (index: number, value: string) => {
    setCards((prev) =>
      prev.map((c, i) => (i === index ? { ...c, front: value } : c))
    );
  };

  const updateCardBack = (index: number, value: string) => {
    setCards((prev) =>
      prev.map((c, i) => (i === index ? { ...c, back: value } : c))
    );
  };

  const addCard = () => {
    setCards((prev) => [...prev, { front: "", back: "" }]);
  };

  const removeCard = (index: number) => {
    if (cards.length <= 1) return;
    setCards((prev) => prev.filter((_, i) => i !== index));
  };

  const submit = async () => {
    setStatus({ kind: "info", text: "Saving..." });

    try {
      if (!title.trim()) {
        throw new Error("Set title is required");
      }

      const creatorId = user?.user_id ?? 1;

      // Filter out empty cards
      const validCards = cards.filter(
        (c) => c.front.trim() && c.back.trim()
      );

      const res = await createFlashcardSet({
        title: title.trim(),
        ...(description.trim() ? { description: description.trim() } : {}),
        course_id: courseId,
        creator_id: creatorId,
        flashcards: validCards,
      });

      setStatus({
        kind: "success",
        text: `Created flashcard set ${res.set_id ?? ""}`.trim(),
      });

      // Reset form
      setTitle("");
      setDescription("");
      setCourseId(1);
      setCards([{ front: "", back: "" }]);

      // Tell parent to refresh the list
      if (onSetCreated) {
        onSetCreated();
      }
    } catch (e: unknown) {
      let text = "Failed to save flashcard set";

      if (e instanceof Error) {
        text = e.message;
      } else if (typeof e === "string") {
        text = e;
      }

      setStatus({ kind: "error", text });
    }
  };

  return (
    <div>
      <h3 className="page-subtitle">Create Flashcard Set</h3>

      <div className="card" style={{ marginBottom: "1rem" }}>
        <input
          className="auth-input"
          style={{ width: "100%", marginBottom: "0.75rem" }}
          placeholder="Set title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />

        <input
          className="auth-input"
          style={{ width: "100%", marginBottom: "0.75rem" }}
          placeholder="Description (optional)"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />

        <input
          className="auth-input"
          type="number"
          placeholder="Course ID"
          value={courseId}
          onChange={(e) => setCourseId(parseInt(e.target.value || "0", 10))}
          style={{ width: "120px" }}
        />
      </div>

      {cards.map((card, index) => (
        <div className="card" style={{ marginBottom: "1rem" }} key={index}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: "0.5rem",
            }}
          >
            <span style={{ fontSize: "0.85rem", color: "#9ca3af" }}>
              Card {index + 1}
            </span>
            {cards.length > 1 && (
              <button
                onClick={() => removeCard(index)}
                style={{
                  padding: "0.2rem 0.5rem",
                  borderRadius: "0.3rem",
                  border: "none",
                  background: "rgba(239,68,68,0.2)",
                  color: "#fca5a5",
                  cursor: "pointer",
                  fontSize: "0.75rem",
                }}
              >
                Remove
              </button>
            )}
          </div>

          <input
            className="auth-input"
            style={{ width: "100%", marginBottom: "0.5rem" }}
            placeholder="Front (question/term)"
            value={card.front}
            onChange={(e) => updateCardFront(index, e.target.value)}
          />

          <input
            className="auth-input"
            style={{ width: "100%" }}
            placeholder="Back (answer/definition)"
            value={card.back}
            onChange={(e) => updateCardBack(index, e.target.value)}
          />
        </div>
      ))}

      <div className="card">
        <button onClick={addCard}>Add Card</button>
        <button onClick={submit} style={{ marginLeft: "0.75rem" }}>
          Save Flashcard Set
        </button>

        {status && (
          <div
            style={{
              marginTop: "1rem",
              color: status.kind === "error" ? "#f87171" : undefined,
            }}
          >
            {status.kind === "error" ? `Error: ${status.text}` : status.text}
          </div>
        )}
      </div>
    </div>
  );
}
