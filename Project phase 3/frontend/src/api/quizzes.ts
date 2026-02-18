import type { Key, ReactNode } from "react";
import client from "./axiosClient.js";

const API_PREFIX = "/quiz";

export const createQuiz = async (data: any) => {
  const res = await client.post(`${API_PREFIX}/create`, data);
  return res.data;
};

export interface Quiz { // Again, change these interfaces as needed, since I don't know what the types are. -Rise
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

export interface Score {
  score: number;
  max_score: number;
}

export const listQuizzes = async () => {
  const res = await client.get(`${API_PREFIX}/quizzes`);
  // Handle paginated response (backend returns {page, limit, items})
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