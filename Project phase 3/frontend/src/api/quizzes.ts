import type { Key, ReactNode } from "react";
import client from "./axiosClient.js";

const API_PREFIX = "/quiz";

export const createQuiz = async (data: any) => {
  const res = await client.post(`${API_PREFIX}/create`, data);
  return res.data;
};

export interface Quiz {
  id: Key | null | undefined;
  quiz_id: number;
  title: string;
  description: string;
  questions: Question[];
}

export interface Question {
  answers: Answer[];
  question_text: ReactNode;
  question_id: number;
  text: string;
  options: string[];
}

export interface Answer {
  answer_id: number;
  answer_text: string;
}

export interface QuestionResult {
  question_id: number;
  question_text: string;
  points: number;
  is_correct: boolean;
  selected_answer_id: number | null;
  selected_answer_text: string | null;
  correct_answer_id: number | null;
  correct_answer_text: string | null;
}

export interface Score {
  score: number;
  max_score: number;
  attempt_id?: number;
  results?: QuestionResult[];
}

export const listQuizzes = async (page = 1, limit = 20, creatorId?: number) => {
  const params: Record<string, string> = { page: String(page), limit: String(limit) };
  if (creatorId != null) params["creator_id"] = String(creatorId);
  const res = await client.get(`${API_PREFIX}/quizzes`, { params });
  return res.data.items || res.data;
};

export const getQuiz = async (quizId: any) => {
  const res = await client.get(`${API_PREFIX}/${quizId}`);
  return res.data;
};

export const submitQuiz = async (data: any) => {
  const res = await client.post(`${API_PREFIX}/submit`, data);
  return res.data;
};

export const updateQuiz = async (quizId: number, payload: { title?: string; description?: string }) => {
  const res = await client.put(`${API_PREFIX}/${quizId}`, payload);
  return res.data;
};

export const deleteQuiz = async (quizId: number) => {
  const res = await client.delete(`${API_PREFIX}/${quizId}`);
  return res.data;
};
