import client from "./axiosClient.js";

const API_PREFIX = "/flashcards";

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
