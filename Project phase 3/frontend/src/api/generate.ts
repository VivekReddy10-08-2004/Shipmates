import { API_BASE } from "./base.js";

export type GenerateKind = "quiz" | "flashcards" | "both";

export interface GenerateFromNotesRequest {
  user_id: number;
  course_id?: number;
  raw_text: string;
  kind?: GenerateKind;
  pdf_file?: File | null;
}

export interface GenerateFromNotesResponse {
  status: string;
  source: string;
  course_id: number | null;
  draft: {
    flashcard_set: {
      title: string;
      description: string;
      items: {
        front: string;
        back: string;
      }[];
    };
    quiz: {
      title: string;
      description: string;
      questions: {
        question_text: string;
        question_type: string;
        points: number;
        answers: {
          answer_text: string;
          is_correct: boolean;
        }[];
      }[];
    };
  };
  meta: {
    flashcard_count: number;
    question_count: number;
    truncated: boolean;
  };
  draft_set_id: number | null;
}

export async function generateFromNotes(
  payload: GenerateFromNotesRequest
): Promise<GenerateFromNotesResponse> {
  const hasPdf = !!payload.pdf_file;
  let requestBody: BodyInit;

  if (hasPdf) {
    const form = new FormData();
    form.append("user_id", String(payload.user_id));
    if (payload.course_id !== undefined && payload.course_id !== null) {
      form.append("course_id", String(payload.course_id));
    }
    form.append("raw_text", payload.raw_text || "");
    form.append("kind", payload.kind ?? "both");
    form.append("pdf_file", payload.pdf_file as File, payload.pdf_file?.name);
    requestBody = form;
  } else {
    requestBody = JSON.stringify({
      user_id: payload.user_id,
      course_id: payload.course_id,
      raw_text: payload.raw_text,
      kind: payload.kind ?? "both",
    });
  }

  const response = await fetch(`${API_BASE}/generate/from-notes`, {
    method: "POST",
    credentials: "include",
    body: requestBody,
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || "Failed to generate from notes");
  }

  return response.json();
}

export interface ApproveDraftRequest {
  draft_set_id: number;
  creator_id: number;
  kind?: GenerateKind;
}

export interface ApproveDraftResponse {
  status: string;
  draft_set_id: number;
  flashcard_set_id: number;
  quiz_id: number;
}

export async function approveGeneratedDraft(
  payload: ApproveDraftRequest
): Promise<ApproveDraftResponse> {
  const response = await fetch(`${API_BASE}/generate/approve`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    credentials: "include",
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || "Failed to approve generated draft");
  }

  return response.json();
}