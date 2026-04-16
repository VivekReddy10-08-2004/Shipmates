import React, { useRef, useState } from "react";
import CreateFlashcardSet from "../components/Flashcards/CreateFlashcardSet.jsx";
import PracticeFlashcards from "../components/Flashcards/PracticeFlashcards.jsx";
import type { FlashcardSet } from "../api/flashcards.js";
import { generateFromNotes, approveGeneratedDraft } from "../api/generate.js";
import { searchCourses } from "../api/studygroups.js";
import useCurrentUser from "../hooks/useCurrentUser.js";

export default function FlashcardsPage() {
  const practiceRef = useRef<FlashcardSet | null>(null);
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
  const [approveSuccess, setApproveSuccess] = useState("");

  const handleSetCreated = () => {
    if (practiceRef.current) {
      practiceRef.current.reloadSets();
    }
  };

  const handleCourseSearch = async (value: string) => {
    setCourseQuery(value);

    if (value.trim().length < 2) {
      setCourseResults([]);
      return;
    }

    try {
      const results = await searchCourses(value, 8);
      setCourseResults(results || []);
    } catch (err) {
      console.error("Failed to search courses:", err);
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
    setApproveSuccess("");

    try {
      if (!user?.user_id) {
        throw new Error("No logged-in user found");
      }

      if (!generateCourseId) {
        throw new Error("Please select a course");
      }

      const data = await generateFromNotes({
        user_id: Number(user.user_id),
        course_id: Number(generateCourseId),
        raw_text: generateNotes,
      });

      setGeneratedFlashcards(data.draft.flashcard_set.items || []);
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
    setApproveSuccess("");

    try {
      if (!user?.user_id) {
        throw new Error("No logged-in user found");
      }

      if (!generatedDraftSetId) {
        throw new Error("No draft set to approve");
      }

      const result = await approveGeneratedDraft({
        draft_set_id: generatedDraftSetId,
        creator_id: Number(user.user_id),
      });

      setApproveSuccess(
        `Approved successfully. Flashcard Set ID: ${result.flashcard_set_id}`
      );

      if (practiceRef.current) {
        practiceRef.current.reloadSets();
      }
    } catch (err: any) {
      setApproveError(err.message || "Failed to approve generated draft");
    } finally {
      setApproveLoading(false);
    }
  };

  return (
    <div style={{ padding: 20 }}>
      <h1>Flashcards</h1>

      <div
        style={{
          marginBottom: "24px",
          padding: "16px",
          background: "#fff",
          borderRadius: "12px"
        }}
      >
        <h2>Generate Flashcards from Notes</h2>

        <div style={{ marginBottom: "12px", position: "relative" }}>
          <label>Course</label>
          <br />
          <input
            value={courseQuery}
            onChange={(e) => handleCourseSearch(e.target.value)}
            placeholder="Search courses"
          />

          {selectedCourseName && (
            <p style={{ marginTop: "8px" }}>
              Selected: {selectedCourseName}
            </p>
          )}

          {courseResults.length > 0 && (
            <div
              style={{
                marginTop: "8px",
                border: "1px solid #ccc",
                borderRadius: "8px",
                padding: "8px",
                background: "#fff",
                maxHeight: "200px",
                overflowY: "auto"
              }}
            >
              {courseResults.map((course) => (
                <div
                  key={course.course_id}
                  onClick={() => handleSelectCourse(course)}
                  style={{
                    padding: "8px",
                    cursor: "pointer",
                    borderBottom: "1px solid #eee"
                  }}
                >
                  {course.course_code
                    ? `${course.course_code} - ${course.course_name}`
                    : course.course_name}
                </div>
              ))}
            </div>
          )}
        </div>

        <div style={{ marginBottom: "12px" }}>
          <label>Notes</label>
          <br />
          <textarea
            value={generateNotes}
            onChange={(e) => setGenerateNotes(e.target.value)}
            rows={8}
            cols={70}
          />
        </div>

        <button onClick={handleGenerateFlashcards} disabled={generateLoading}>
          {generateLoading ? "Generating..." : "Generate Flashcards"}
        </button>

        {generateError && (
          <p style={{ color: "red", marginTop: "12px" }}>{generateError}</p>
        )}

        {generatedDraftSetId && (
          <p style={{ marginTop: "12px" }}>
            Draft Set ID: {generatedDraftSetId}
          </p>
        )}

        {generatedDraftSetId && (
          <button
            onClick={handleApproveGeneratedFlashcards}
            disabled={approveLoading || !generatedDraftSetId}
            style={{ marginTop: "12px", display: "block" }}
          >
            {approveLoading ? "Approving..." : "Approve Generated Flashcards"}
          </button>
        )}

        {approveError && (
          <p style={{ color: "red", marginTop: "12px" }}>{approveError}</p>
        )}

        {approveSuccess && (
          <p style={{ color: "green", marginTop: "12px" }}>{approveSuccess}</p>
        )}

        {generatedFlashcards.length > 0 && (
          <div style={{ marginTop: "16px" }}>
            <h3>Generated Flashcards Preview</h3>
            {generatedFlashcards.map((card, index) => (
              <div
                key={index}
                style={{
                  marginBottom: "12px",
                  padding: "12px",
                  border: "1px solid #ccc",
                  borderRadius: "8px"
                }}
              >
                <p><strong>Front:</strong> {card.front}</p>
                <p><strong>Back:</strong> {card.back}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
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