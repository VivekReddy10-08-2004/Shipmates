// jacob craig

import type { Key, ReactNode } from "react";
import { API_BASE } from "./base.js";

// Empty interfaces because I have no idea what variables go here. I just did quick fixes to fill them in. fill in later I suppose - Rise
export interface Match {
  bio: string;
  study_goal: string;
  meeting_pref: string;
  study_style: string;
  shared_courses: any;
  age: number;
  profile_image_url: any;
  last_name: string;
  first_name: string;
  other_user_id: number;

}

export interface Partner {
  other_user_id: number;
  first_name: string;
  last_name: string;
}

export interface Conversation {
  conversation_id: number; 
  requestStatus: string;
  partner: Partner; 
  hasSentInitial: boolean; 
  isYouRequester: boolean;
  isRequestFlow: boolean;
  last_message?: string; // optional field so StuddyBuddyMatch doesn't complain that fields don't match - Rise
}


export interface Message {
  last_name: string;
  first_name: string;
  sent_time: any;
  content: ReactNode;
  message_id: Key | null | undefined;
  sender_user_id: number | undefined;

}

export interface MessageRequest {
  map: any;
  length: number;

}

// small helper to standardize fetch + error handling
// Had to change it so apiFetch is generic, since it was complaining that the types were not matching - Rise
async function apiFetch<T = any>(path: string, options = {}): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });

  let data: T;
  try {
    data = await res.json();
  } catch {
    data = {} as T;
  }

  if (!res.ok) {
    const msg = (data as any).detail || "Request failed";
    throw new Error(msg);
  }

  return data;
}


/**
 * Get the current user's StudyBuddy match profile + courses.
 */
export async function fetchMatchProfile(userId: any) {
  const params = new URLSearchParams({
    user_id: String(userId),
  });

  return apiFetch(`/match/profile?${params.toString()}`);
}

export async function saveMatchProfile(payload: any) {
  return apiFetch("/match/profile", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

type UploadResponse = { url: string } | { detail?: string };

/**
 * Upload a profile image file
 * Returns: { url }
 */
export async function uploadProfileImage(file: string | Blob): Promise<{ url: string }> {
  const formData = new FormData();
  formData.append("file", file);

  const res = await fetch(`${API_BASE}/match/profile/image`, {
    method: "POST",
    body: formData,
  });

  let data: UploadResponse = {};  // had to change this since it returned the wrong value - Rise
  try {
    data = await res.json();
  } catch {
    data = {};
  }

  if (!res.ok) {
    const msg = "detail" in data ? data.detail : "Upload failed";
    throw new Error(msg);
  }

  return data as { url: string }; // { url }
}

export async function fetchMatchSuggestions(userId: any, limit = 20) {
  const params = new URLSearchParams({
    user_id: String(userId),
    limit: String(limit),
  });

  return apiFetch(`/match/suggestions?${params.toString()}`);
}

export async function startConversation(requesterUserId: any, targetUserId: any) {
  return apiFetch("/dm/start", {
    method: "POST",
    body: JSON.stringify({
      requester_user_id: requesterUserId,
      target_user_id: targetUserId,
    }),
  });
}

export async function fetchDirectMessages(conversationId: any, limit = 50) {
  const params = new URLSearchParams({
    limit: String(limit),
  });
  return apiFetch(`/dm/${conversationId}/messages?${params.toString()}`);
}

export async function sendDirectMessage(conversationId: any, senderUserId: any, content: any) {
  return apiFetch(`/dm/${conversationId}/messages`, {
    method: "POST",
    body: JSON.stringify({
      sender_user_id: senderUserId,
      content,
    }),
  });
}


export async function fetchInbox(userId: number, limit = 50): Promise<Conversation[]> {
  const params = new URLSearchParams({
    user_id: String(userId),
    limit: String(limit),
  });

  const res = await apiFetch<{ courses?: Conversation[] }>(`/dm/inbox?${params.toString()}`);
  return res.courses || [];
}
export async function fetchMessageRequests(userId: any, limit = 50) {
  const params = new URLSearchParams({
    user_id: String(userId),
    limit: String(limit),
  });
  return apiFetch(`/dm/requests?${params.toString()}`);
}

export async function respondToMessageRequest(requestId: any, action: any, userId: any) {
  const res = await fetch(
    `${API_BASE}/dm/requests/${requestId}/${action}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user_id: userId }),
    }
  );

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.detail || "Failed to update message request");
  }
  return res.json();
}
