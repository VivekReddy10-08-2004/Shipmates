import { API_BASE } from "./base.js";

export type Answer = {
  answer_id: number;
  answer_text: string;
  is_correct?: boolean;
};

export type Question = {
  question_id: number;
  question_text: string;
  question_type?: string;
  points?: number;
  answers?: Answer[];
};

export type Quiz = {
  quiz_id: number;
  title: string;
  description?: string | null;
  course_id?: number;
  creator_id?: number;
  created_at?: string;
  questions?: Question[];
};

export type Score = {
  score: number;
  max_score: number;
};

type CreateQuizPayload = {
  title: string;
  description?: string;
  course_id: number;
  creator_id: number;
  questions?: {
    question_text: string;
    question_type?: string;
    points?: number;
    answers?: { answer_text: string; is_correct: boolean }[];
  }[];
};

type SubmitQuizPayload = {
  user_id: number;
  quiz_id: number;
  answers: Record<number, number>;
};

async function handleResponse(res: Response) {
  let data: any = {};
  try {
    data = await res.json();
  } catch {
    data = {};
  }

  if (!res.ok) {
    throw new Error(data.detail || data.message || `HTTP ${res.status}`);
  }

  return data;
}

async function safeFetch(url: string, options?: RequestInit) {
  try {
    const res = await fetch(url, options);
    return await handleResponse(res);
  } catch (err: any) {
    if (err instanceof Error) {
      throw err;
    }
    throw new Error("Network request failed");
  }
}

export async function listQuizzes(page = 1, limit = 20, creatorId?: number) {
  const params = new URLSearchParams({ page: String(page), limit: String(limit) });
  if (creatorId != null) params.set("creator_id", String(creatorId));
  return safeFetch(`${API_BASE}/quiz/quizzes?${params.toString()}`);
}

export async function getQuiz(quizId: number) {
  return safeFetch(`${API_BASE}/quiz/${quizId}`);
}

export async function createQuiz(payload: CreateQuizPayload) {
  // Send full payload as JSON body so backend receives questions+answers
  return safeFetch(`${API_BASE}/quiz/create`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

export async function submitQuiz(payload: SubmitQuizPayload) {
  // Send answers as JSON body, not query params
  return safeFetch(`${API_BASE}/quiz/submit`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}
