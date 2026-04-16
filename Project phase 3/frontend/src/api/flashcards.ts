import { API_BASE } from "./base.js";

export type Flashcard = {
  flashcard_id?: number;
  set_id?: number;
  front?: string;
  back?: string;
  front_text?: string;
  back_text?: string;
};

export type FlashcardSet = {
  set_id: number;
  title: string;
  description?: string | null;
  course_id?: number;
  creator_id?: number;
  created_at?: string;
  cards?: Flashcard[];
  // Allow the imperative handle method so refs work from FlashcardsPage
  reloadSets?: () => void;
};

type CreateFlashcardSetPayload = {
  title: string;
  description?: string;
  course_id: number;
  creator_id: number;
  flashcards?: { front: string; back: string }[];
};

type UpdateFlashcardSetPayload = {
  title?: string;
  description?: string;
};

type UpdateFlashcardPayload = {
  front_text?: string;
  back_text?: string;
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

export async function listFlashcardSets(page = 1, limit = 20, creatorId?: number) {
  const params = new URLSearchParams({ page: String(page), limit: String(limit) });
  if (creatorId != null) params.set("creator_id", String(creatorId));
  return safeFetch(`${API_BASE}/flashcards/sets?${params.toString()}`);
}

export async function getFlashcardSet(setId: number) {
  return safeFetch(`${API_BASE}/flashcards/${setId}`);
}

export async function createFlashcardSet(payload: CreateFlashcardSetPayload) {
  // Send full payload as JSON body so the backend can receive cards too
  return safeFetch(`${API_BASE}/flashcards/create`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

export async function updateFlashcardSet(setId: number, payload: UpdateFlashcardSetPayload) {
  return safeFetch(`${API_BASE}/flashcards/${setId}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

export async function deleteFlashcardSet(setId: number) {
  return safeFetch(`${API_BASE}/flashcards/${setId}`, {
    method: "DELETE",
  });
}

export async function updateFlashcard(flashcardId: number, payload: UpdateFlashcardPayload) {
  return safeFetch(`${API_BASE}/flashcards/card/${flashcardId}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

export async function deleteFlashcard(flashcardId: number) {
  return safeFetch(`${API_BASE}/flashcards/card/${flashcardId}`, {
    method: "DELETE",
  });
}
