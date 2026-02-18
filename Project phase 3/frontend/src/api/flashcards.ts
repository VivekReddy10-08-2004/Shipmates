import type { Key } from "react";
import client from "./axiosClient.js";

const API_PREFIX = "/flashcards";

// create flashcard type to reference later - Rise
// No idea if any of these types are right. Most of them came from quickfix, so change them later if needed.
export type Flashcard = {
  description: any;
  title: string;
  id: Key | null | undefined;
  back: string;
  front: string;
  flashcard_id: number;
  front_text: string;
  back_text: string;
  set_id: number;
};

export type FlashcardSet = {
  reloadSets(): unknown;
  id: Key | null | undefined;
  title: string;
  description: string;
  cards: Flashcard[];  
};
/**
 * Create a flashcard set
 * @param {{title: string, course_id?: number, flashcards: Array<{front:string,back:string}>}} data
 */
export const createFlashcardSet = async (data: any) => {
  const res = await client.post(`${API_PREFIX}/create`, data);
  return res.data;
};

export const getFlashcardSet = async (setId: any) => {
  const res = await client.get(`${API_PREFIX}/sets/${setId}`);
  return res.data;
};

export const listFlashcardSets = async () => {
  const res = await client.get(`${API_PREFIX}/sets`);
  return res.data;
};

export const updateFlashcardSet = async (setId: any, data: any) => {
  const res = await client.put(`${API_PREFIX}/sets/${setId}`, data);
  return res.data;
};

export const deleteFlashcardSet = async (setId: any) => {
  const res = await client.delete(`${API_PREFIX}/sets/${setId}`);
  return res.data;
};

export const updateFlashcard = async (cardId: any, data: any) => {
  const res = await client.put(`${API_PREFIX}/cards/${cardId}`, data);
  return res.data;
};

export const deleteFlashcard = async (cardId: any) => {
  const res = await client.delete(`${API_PREFIX}/cards/${cardId}`);
  return res.data;
};
