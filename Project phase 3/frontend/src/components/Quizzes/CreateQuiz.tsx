import React, { useState } from "react";
import { createQuiz } from "../../api/quizzes.js";

export default function CreateQuiz() {
  const [title, setTitle] = useState("");
  const [questions, setQuestions] = useState([{ text: "", answers: [{ text: "", is_correct: false }] }]);
  const [status, setStatus] = useState<string | null>(null);

  const updateQuestion = (qi: number, key: string, val: any) => {
    const next = [...questions];
    if (next[qi]) { // need to check if it actually exists - Rise
      next[qi][key] = val;
      setQuestions(next);
    }
  };

  const addQuestion = () => {
    setQuestions([
      ...questions,
      { text: "", answers: [{ text: "", is_correct: false }] },
    ]);
  };


  const addAnswer = (qi) => {
    const next = [...questions];
    if (next[qi]) { // need to check if it actually exists - Rise
      next[qi].answers.push({ text: "", is_correct: false });
      setQuestions(next);
    }
  };

  const submit = async () => {
    setStatus("Saving...");
    try {
      const payload = { title, questions };
      await createQuiz(payload);
      setStatus("Saved");
    } catch (e) {
      setStatus("Error: " + JSON.stringify(e));
    }
  };

  return (
    <div className="card">
      <h3>Create Quiz</h3>
      <input placeholder="Quiz title" 
        value={title} 
        onChange={(e) => setTitle(e.target.value)} 
        className="input-quiz"
      />
      {questions.map((q, qi) => (
        <div key={qi}>
          <input placeholder=
            {`Question ${qi + 1}`} 
            value={q.text} 
            onChange={(e) => updateQuestion(qi, "text", e.target.value)} 
            className="input-quiz"
          />
          {/* <div style={{ marginLeft: 8 }}> */}
          <div> {/* the margin made it weirdly aligned, so i got rid of it - Rise*/}
            {q.answers.map((a, ai) => (
              <div key={ai}>
                <input placeholder=
                  {`Answer ${ai + 1}`} 
                  value={a.text} 
                  onChange={(e) => {
                    const next = [...questions];
                    if (next[qi]?.answers[ai]) { // need to check if it actually exists - Rise
                      next[qi].answers[ai].text = e.target.value;
                      setQuestions(next);
                    }
                  }} 
                  className="input-quiz"
                />
                <label>
                  <input type="checkbox" checked={a.is_correct} onChange={(e) => {
                    const next = [...questions];
                    if (next[qi]?.answers[ai]) {
                      next[qi].answers[ai].is_correct = e.target.checked;
                      setQuestions(next);
                    }
                  }} 
                  /> Correct
                </label>
              </div>
            ))}
            <button onClick={() => addAnswer(qi)} className="small-alt-button-light">Add Answer</button>
          </div>
        </div>
      ))}
      <div style={{ marginTop: 24 }}>
        <button onClick={addQuestion} 
          className="small-alt-button">
          Add Question</button>
        <button onClick={submit}
          className="small-alt-button">
          Save Quiz</button>
      </div>
      {status && <div style={{ marginTop: 8 }}>{status}</div>}
    </div>
  );
}
