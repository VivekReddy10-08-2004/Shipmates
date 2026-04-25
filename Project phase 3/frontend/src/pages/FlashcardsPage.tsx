import { useEffect, useRef, useState } from "react";
import PracticeFlashcards from "../components/Flashcards/PracticeFlashcards.jsx";
import CreateFlashcardSet from "../components/Flashcards/CreateFlashcardSet.jsx";
import { generateFromNotes, approveGeneratedDraft } from "../api/generate.js";
import { searchCourses } from "../api/studygroups.js";
import useCurrentUser from "../hooks/useCurrentUser.js";
import { fireReload } from "../utils/reloadEvents.js";

type PracticeHandle = { reloadSets: () => void };

export default function FlashcardsPage() {
  const practiceRef = useRef<PracticeHandle | null>(null);
  const { user } = useCurrentUser();

  const [generateCourseId, setGenerateCourseId] = useState("");
  const [courseQuery, setCourseQuery] = useState("");
  const [courseResults, setCourseResults] = useState<any[]>([]);
  const [selectedCourseName, setSelectedCourseName] = useState("");

  const [generateNotes, setGenerateNotes] = useState("");
  const [generatedFlashcards, setGeneratedFlashcards] = useState<any[]>([]);
  const [generateLoading, setGenerateLoading] = useState(false);
  const [generateError, setGenerateError] = useState("");
  const [generatedDraftSetId, setGeneratedDraftSetId] = useState<number | null>(null);

  const [approveLoading, setApproveLoading] = useState(false);
  const [approveError, setApproveError] = useState("");
  const [showToast, setShowToast] = useState(false);

  const [showCreateModal, setShowCreateModal] = useState(false);

  useEffect(() => {
    if (!showToast) return;
    const t = setTimeout(() => setShowToast(false), 1700);
    return () => clearTimeout(t);
  }, [showToast]);

  useEffect(() => {
    if (showCreateModal) document.body.classList.add("study-scroll-lock");
    else document.body.classList.remove("study-scroll-lock");
    return () => document.body.classList.remove("study-scroll-lock");
  }, [showCreateModal]);

  useEffect(() => {
    if (!showCreateModal) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setShowCreateModal(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [showCreateModal]);

  const handleCourseSearch = async (value: string) => {
    setCourseQuery(value);
    if (value.trim().length < 2) {
      setCourseResults([]);
      return;
    }
    try {
      const results = await searchCourses(value, 8);
      setCourseResults(results || []);
    } catch {
      setCourseResults([]);
    }
  };

  const handleSelectCourse = (course: any) => {
    setGenerateCourseId(String(course.course_id));
    const label = course.course_code
      ? `${course.course_code} - ${course.course_name}`
      : course.course_name;
    setSelectedCourseName(label);
    setCourseQuery(label);
    setCourseResults([]);
  };

  const handleGenerateFlashcards = async () => {
    setGenerateLoading(true);
    setGenerateError("");
    setGeneratedFlashcards([]);
    setGeneratedDraftSetId(null);
    setApproveError("");

    try {
      if (!user?.user_id) throw new Error("No logged-in user found");
      if (!generateCourseId) throw new Error("Please select a course");

      const data = await generateFromNotes({
        user_id: Number(user.user_id),
        course_id: Number(generateCourseId),
        raw_text: generateNotes,
        kind: "flashcards",
      });

      setGeneratedFlashcards(data.draft.flashcard_set?.items || []);
      setGeneratedDraftSetId(data.draft_set_id ?? null);
    } catch (err: any) {
      setGenerateError(err.message || "Failed to generate flashcards");
    } finally {
      setGenerateLoading(false);
    }
  };

  const handleApproveGeneratedFlashcards = async () => {
    setApproveLoading(true);
    setApproveError("");

    try {
      if (!user?.user_id) throw new Error("No logged-in user found");
      if (!generatedDraftSetId) throw new Error("No draft set to approve");

      await approveGeneratedDraft({
        draft_set_id: generatedDraftSetId,
        creator_id: Number(user.user_id),
        kind: "flashcards",
      });

      if (practiceRef.current) practiceRef.current.reloadSets();
      fireReload("flashcards");
      setGeneratedDraftSetId(null);
      setGeneratedFlashcards([]);
      setGenerateNotes("");
      setShowToast(true);
    } catch (err: any) {
      setApproveError(err.message || "Failed to approve generated draft");
    } finally {
      setApproveLoading(false);
    }
  };

  return (
    <div className="crews-page">
      <div className="crews-bg-layer" />

      <div className="crews-hero">
        <span className="crews-hero-ropes" aria-hidden />
        <h1 className="crews-hero-title">Flashcards</h1>
      </div>

      <div className="crews-panel" style={{ marginBottom: "1.75rem" }}>
        <h2 className="crews-panel-title">Forge Flashcards from Notes</h2>

        <div className={`study-field ${courseResults.length > 0 ? "has-dropdown" : ""}`}>
          <label className="study-label">Course</label>
          <input
            className="study-input"
            value={courseQuery}
            onChange={(e) => handleCourseSearch(e.target.value)}
            placeholder="Search courses..."
          />
          {courseResults.length > 0 && (
            <div className="study-search-results">
              {courseResults.map((course) => (
                <div
                  key={course.course_id}
                  className="study-search-item"
                  onClick={() => handleSelectCourse(course)}
                >
                  {course.course_code
                    ? `${course.course_code} - ${course.course_name}`
                    : course.course_name}
                </div>
              ))}
            </div>
          )}
          {selectedCourseName && !courseResults.length && (
            <span className="study-selected-chip">⚓ {selectedCourseName}</span>
          )}
        </div>

        <div className="study-field">
          <label className="study-label">Notes</label>
          <textarea
            className="study-textarea"
            value={generateNotes}
            onChange={(e) => setGenerateNotes(e.target.value)}
            placeholder="Paste your lecture notes, textbook passage, or study material here..."
          />
        </div>

        <button
          className="btn-treasure"
          onClick={handleGenerateFlashcards}
          disabled={generateLoading}
        >
          {generateLoading ? "Charting..." : "Generate Flashcards"}
        </button>

        {generateError && <div className="study-notice study-notice-error">{generateError}</div>}
        {approveError && <div className="study-notice study-notice-error">{approveError}</div>}

        {generatedFlashcards.length > 0 && (
          <>
            <div className="study-preview-header">Generated Flashcards Preview</div>
            {generatedFlashcards.map((card, index) => (
              <div key={index} className="study-preview-card">
                <p><strong>Front</strong>{card.front}</p>
                <p><strong>Back</strong>{card.back}</p>
              </div>
            ))}
            <button
              className="btn-treasure"
              onClick={handleApproveGeneratedFlashcards}
              disabled={approveLoading}
              style={{ marginTop: "0.5rem" }}
            >
              {approveLoading ? "Adding to logbook..." : "Approve & Save Set"}
            </button>
          </>
        )}
      </div>

      <div className="crews-panel">
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "1rem", flexWrap: "wrap" }}>
          <h2 className="crews-panel-title" style={{ flex: 1, minWidth: 0 }}>Your Flashcard Sets</h2>
          <button
            className="btn-wood"
            onClick={() => setShowCreateModal(true)}
            style={{ marginTop: "-0.2rem" }}
          >
            + Create Manually
          </button>
        </div>
        <PracticeFlashcards ref={practiceRef} />
      </div>

      {showCreateModal && (
        <div className="study-fullmodal-backdrop" onClick={() => setShowCreateModal(false)}>
          <div className="study-fullmodal" onClick={(e) => e.stopPropagation()}>
            <button
              className="study-fullmodal-close"
              onClick={() => setShowCreateModal(false)}
              aria-label="Close"
            >
              ×
            </button>
            <CreateFlashcardSet
              onClose={() => setShowCreateModal(false)}
              onCreated={() => {
                setShowCreateModal(false);
                setShowToast(true);
              }}
            />
          </div>
        </div>
      )}

      {showToast && <div className="study-toast">Generated successfully</div>}
    </div>
  );
}
