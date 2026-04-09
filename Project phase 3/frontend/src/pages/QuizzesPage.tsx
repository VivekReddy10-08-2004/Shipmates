import React, { useState } from "react";
import CreateQuiz from "../components/Quizzes/CreateQuiz.js";
import TakeQuiz from "../components/Quizzes/TakeQuiz.js";
import { generateFromNotes, approveGeneratedDraft } from "../api/generate.js";
import { searchCourses } from "../api/studygroups.js";

export default function QuizzesPage() {
  const [generateCourseId, setGenerateCourseId] = useState("");
  const [courseQuery, setCourseQuery] = useState("");
  const [courseResults, setCourseResults] = useState<any[]>([]);
  const [selectedCourseName, setSelectedCourseName] = useState("");
  
  const [generateNotes, setGenerateNotes] = useState("");
  const [generatedQuestions, setGeneratedQuestions] = useState<any[]>([]);
  const [generatedDraftSetId, setGeneratedDraftSetId] = useState<number | null>(null);

  const [generateLoading, setGenerateLoading] = useState(false);
  const [generateError, setGenerateError] = useState("");
  const [approveLoading, setApproveLoading] = useState(false);
  const [approveError, setApproveError] = useState("");
  const [approveSuccess, setApproveSuccess] = useState("");

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

  const handleGenerateQuiz = async () => {
    setGenerateLoading(true);
    setGenerateError("");
    setGeneratedQuestions([]);
    setGeneratedDraftSetId(null);
    setApproveError("");
    setApproveSuccess("");

    try {
      if (!generateCourseId) {
        throw new Error("Please select a course");
      }

      const data = await generateFromNotes({
        user_id: 1009,
        course_id: Number(generateCourseId),
        raw_text: generateNotes,
      });

      setGeneratedQuestions(data.draft.quiz.questions || []);
      setGeneratedDraftSetId(data.draft_set_id ?? null);
    } catch (err: any) {
      setGenerateError(err.message || "Failed to generate quiz");
    } finally {
      setGenerateLoading(false);
    }
  };

  const handleApproveGeneratedQuiz = async () => {
    setApproveLoading(true);
    setApproveError("");
    setApproveSuccess("");

    try {
      if (!generatedDraftSetId) {
        throw new Error("No draft set to approve");
      }

      const result = await approveGeneratedDraft({
        draft_set_id: generatedDraftSetId,
        creator_id: 1009,
      });

      setApproveSuccess(`Approved successfully. Quiz ID: ${result.quiz_id}`);
    } catch (err: any) {
      setApproveError(err.message || "Failed to approve generated quiz");
    } finally {
      setApproveLoading(false);
    }
  };

  return (
    <div style={{ padding: 20 }}>
      <h1>Quizzes</h1>

      <div
        style={{
          marginBottom: "24px",
          padding: "16px",
          background: "#fff",
          borderRadius: "12px"
        }}
      >
        <h2>Generate Quiz from Notes</h2>

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

        <button onClick={handleGenerateQuiz} disabled={generateLoading}>
          {generateLoading ? "Generating..." : "Generate Quiz"}
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
            onClick={handleApproveGeneratedQuiz}
            disabled={approveLoading}
            style={{ marginTop: "12px", display: "block" }}
          >
            {approveLoading ? "Approving..." : "Approve Generated Quiz"}
          </button>
        )}

        {approveError && (
          <p style={{ color: "red", marginTop: "12px" }}>{approveError}</p>
        )}

        {approveSuccess && (
          <p style={{ color: "green", marginTop: "12px" }}>{approveSuccess}</p>
        )}

        {generatedQuestions.length > 0 && (
          <div style={{ marginTop: "16px" }}>
            <h3>Generated Quiz Preview</h3>

            {generatedQuestions.map((question, index) => (
              <div
                key={index}
                style={{
                  marginBottom: "16px",
                  padding: "12px",
                  border: "1px solid #ccc",
                  borderRadius: "8px"
                }}
              >
                <p>
                  <strong>Question:</strong> {question.question_text}
                </p>
                <p>
                  <strong>Type:</strong> {question.question_type}
                </p>
                <p>
                  <strong>Points:</strong> {question.points}
                </p>

                <div style={{ marginTop: "8px" }}>
                  {question.answers.map((answer: any, answerIndex: number) => (
                    <div key={answerIndex}>
                      - {answer.answer_text} {answer.is_correct ? "(correct)" : ""}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        <div>
          <CreateQuiz />
        </div>
        <div>
          <TakeQuiz />
        </div>
      </div>
    </div>
  );
}