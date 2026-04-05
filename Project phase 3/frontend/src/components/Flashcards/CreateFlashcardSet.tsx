import React, { useState } from "react";
import { createFlashcardSet, type Flashcard } from "../../api/flashcards.js";

export default function CreateFlashcardSet({ onSetCreated }) {
  const [title, setTitle] = useState("");
  const [creatorId, setCreatorId] = useState(1); // default for testing
  const [cards, setCards] = useState([{ front: "", back: "" }]);

  type StatusType = {
    type: "info" | "success" | "error";
    text: string;
  };

  const [status, setStatus] = useState<StatusType | null>(null);

  const updateCard = (idx: number, key: keyof Flashcard, value: any) => {
    const next = [...cards];
    const card = next[idx];
    if (card) { // Had to add a check for undefined object
      card[key] = value;
      setCards(next);
    }
  };

  const addCard = () => setCards((c) => [...c, { front: "", back: "" }]);

  const deleteCard = (idx: number) => setCards((c) => c.filter((_, i) => i !== idx));

  const submit = async () => {
    setStatus({ type: "info", text: "Saving..." }); // need to specify a known type (ie, StatusType) - Rise
    try {
      const payload = { title, creator_id: creatorId, flashcards: cards.map(c => ({ front: c.front, back: c.back })) };
      const res = await createFlashcardSet(payload);
      setStatus({ type: "success", text: `Saved (set id ${res.set_id || res.setId || 'unknown'})` });
      setTitle("");
      setCards([{ front: "", back: "" }]);
      // Notify parent to reload the flashcard list
      if (onSetCreated) {
        onSetCreated();
      }
    } catch (e: unknown) { 
      let text: string;

      if (typeof e === "string") {
        text = e;
      } else if (e && typeof e === "object" && "error" in e) {
        // TypeScript now knows e has 'error'
        text = (e as { error?: string }).error || JSON.stringify(e);
      } else if (e && typeof e === "object" && "message" in e) {
        text = (e as { message?: string }).message || JSON.stringify(e);
      } else {
        text = JSON.stringify(e);
      }

      setStatus({ type: "error", text });
    }
  };

  return (
    <div className="card" style={{ maxWidth: 700 }}>
      <h3>Create Flashcard Set</h3>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <input style={{ flex: 1 }} 
          placeholder="Set title" 
          value={title} 
          onChange={(e) => setTitle(e.target.value)} 
          className="auth-input"/>
        <input style={{ width: 110 }} type="number" value={creatorId} onChange={(e) => setCreatorId(parseInt(e.target.value || '0'))} />
      </div>

      {cards.map((c, i) => (
        <div key={i} style={{ marginTop: 8, display: 'flex', gap: 8 }}>
          <input placeholder="Front" 
            value={c.front} 
            onChange={(e) => updateCard(i, "front", e.target.value)} 
            className="auth-input"
            style={{ flex: 1 }} />
          <input placeholder="Back" 
            value={c.back} 
            onChange={(e) => updateCard(i, "back", e.target.value)} 
            className="auth-input"
            style={{ flex: 1 }} />
          <label>
            <input type="checkbox" 
              onChange={(e) => deleteCard(i)} 
            /> Delete Answer
          </label>
        </div>
      ))}

      <div style={{ marginTop: 12 }}>
        <button onClick={addCard} 
          className="small-alt-button">
            Add Card
        </button>
        <button onClick={submit} 
          style={{ marginLeft: 8 }} 
          className="small-alt-button">
            Save Set
        </button>
      </div>

      {status && (
        <div style={{ marginTop: 8 }}>
          <strong>{status.type === 'error' ? 'Error: ' : ''}</strong>{status.text}
        </div>
      )}
    </div>
  );
}
