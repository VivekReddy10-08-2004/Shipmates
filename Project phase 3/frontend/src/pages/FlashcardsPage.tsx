import React, { useRef } from "react";
import CreateFlashcardSet from "../components/Flashcards/CreateFlashcardSet.jsx";
import PracticeFlashcards from "../components/Flashcards/PracticeFlashcards.jsx";
import type { FlashcardSet } from "../api/flashcards.js";

export default function FlashcardsPage() {
  const practiceRef = useRef<FlashcardSet | null>(null);

  const handleSetCreated = () => {
    if (practiceRef.current) {
      practiceRef.current.reloadSets();
    }
  };

  return (
    <div style={{ padding: 20 }}>
      <h1>Flashcards</h1>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <div>
          <CreateFlashcardSet onSetCreated={handleSetCreated} />
        </div>
        <div>
          <PracticeFlashcards ref={practiceRef} />
        </div>
      </div>
    </div>
  );
}
