import { useState } from "react";
import { createQuiz } from "../../api/quizzes.js";
import useCurrentUser from "../../hooks/useCurrentUser.js";

type AnswerInput = {
  answer_text: string;
  is_correct: boolean;
};

type QuestionInput = {
  question_text: string;
  answers: AnswerInput[];
};

type StatusType = {
  kind: "info" | "success" | "error";
  text: string;
};

export default function CreateQuiz() {
  const { user } = useCurrentUser();
  const [title, setTitle] = useState("");
  const [courseId, setCourseId] = useState(1);

  const [questions, setQuestions] = useState<QuestionInput[]>([
    {
      question_text: "",
      answers: [{ answer_text: "", is_correct: false }],
    },
  ]);

  const [status, setStatus] = useState<StatusType | null>(null);

  const updateQuestionText = (qIndex: number, value: string) => {
    setQuestions((prev) =>
      prev.map((q, i) =>
        i === qIndex ? { ...q, question_text: value } : q
      )
    );
  };

  const updateAnswerText = (qIndex: number, aIndex: number, value: string) => {
    setQuestions((prev) =>
      prev.map((q, i) =>
        i === qIndex
          ? {
              ...q,
              answers: q.answers.map((a, j) =>
                j === aIndex ? { ...a, answer_text: value } : a
              ),
            }
          : q
      )
    );
  };

  const updateAnswerCorrect = (qIndex: number, aIndex: number, checked: boolean) => {
    setQuestions((prev) =>
      prev.map((q, i) =>
        i === qIndex
          ? {
              ...q,
              answers: q.answers.map((a, j) =>
                j === aIndex ? { ...a, is_correct: checked } : a
              ),
            }
          : q
      )
    );
  };

  const addQuestion = () => {
    setQuestions((prev) => [
      ...prev,
      {
        question_text: "",
        answers: [{ answer_text: "", is_correct: false }],
      },
    ]);
  };

  const addAnswer = (qIndex: number) => {
    setQuestions((prev) =>
      prev.map((q, i) =>
        i === qIndex
          ? {
              ...q,
              answers: [...q.answers, { answer_text: "", is_correct: false }],
            }
          : q
      )
    );
  };

  const submit = async () => {
    setStatus({ kind: "info", text: "Saving..." });

    try {
      if (!title.trim()) {
        throw new Error("Quiz title is required");
      }

      const res = await createQuiz({
        title: title.trim(),
        course_id: courseId,
        creator_id: user?.user_id ?? 1,
        questions,
      });

      setStatus({
        kind: "success",
        text: `Saved quiz ${res.quiz_id ?? ""}`.trim(),
      });

      setTitle("");
      setCourseId(1);
      setQuestions([
        {
          question_text: "",
          answers: [{ answer_text: "", is_correct: false }],
        },
      ]);
    } catch (e: unknown) {
      let text = "Failed to save quiz";

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
      <div className="card" style={{ marginBottom: "1rem" }}>
        <input
          className="auth-input"
          style={{ width: "100%", marginBottom: "0.75rem" }}
          placeholder="Quiz title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />

        <div style={{ display: "flex", gap: "0.75rem" }}>
          <input
            className="auth-input"
            type="number"
            placeholder="Course ID"
            value={courseId}
            onChange={(e) => setCourseId(parseInt(e.target.value || "0", 10))}
          />
        </div>
      </div>

      {questions.map((question, qIndex) => (
        <div className="card" style={{ marginBottom: "1rem" }} key={qIndex}>
          <input
            className="auth-input"
            style={{ width: "100%", marginBottom: "0.75rem" }}
            placeholder={`Question ${qIndex + 1}`}
            value={question.question_text}
            onChange={(e) => updateQuestionText(qIndex, e.target.value)}
          />

          {question.answers.map((answer, aIndex) => (
            <div key={aIndex} style={{ marginBottom: "0.75rem" }}>
              <input
                className="auth-input"
                style={{ width: "100%", marginBottom: "0.5rem" }}
                placeholder={`Answer ${aIndex + 1}`}
                value={answer.answer_text}
                onChange={(e) => updateAnswerText(qIndex, aIndex, e.target.value)}
              />

              <label style={{ fontSize: "0.95rem" }}>
                <input
                  type="checkbox"
                  checked={answer.is_correct}
                  onChange={(e) =>
                    updateAnswerCorrect(qIndex, aIndex, e.target.checked)
                  }
                  style={{ marginRight: "0.4rem" }}
                />
                Correct
              </label>
            </div>
          ))}

          <button onClick={() => addAnswer(qIndex)}>Add Answer</button>
        </div>
      ))}

      <div className="card">
        <button onClick={addQuestion}>Add Question</button>
        <button onClick={submit} style={{ marginLeft: "0.75rem" }}>
          Save Quiz
        </button>

        {status && (
          <div style={{ marginTop: "1rem", color: status.kind === "error" ? "#f87171" : undefined }}>
            {status.kind === "error" ? `Error: ${status.text}` : status.text}
          </div>
        )}
      </div>
    </div>
  );
}