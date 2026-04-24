// jacob craig
// Fixed: DM paths changed from /dm/ to /messages/ to match backend prefix

import type { Key, ReactNode } from "react";
import { API_BASE } from "./base.js";

// Interfaces
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
  last_message?: string;
  // Backend sometimes flattens the partner's name onto the conversation;
  // keep these optional so the UI can fall back to them.
  first_name?: string;
  last_name?: string;
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
    const detail = (data as any).detail;
    const msg = Array.isArray(detail)
      ? detail.map((e: any) => e.msg ?? JSON.stringify(e)).join("; ")
      : (typeof detail === "string" ? detail : null) ?? "Request failed";
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

export async function uploadProfileImage(file: string | Blob): Promise<{ url: string }> {
  const formData = new FormData();
  formData.append("file", file);

  const res = await fetch(`${API_BASE}/match/profile/image`, {
    method: "POST",
    body: formData,
  });

  let data: UploadResponse = {};
  try {
    data = await res.json();
  } catch {
    data = {};
  }

  if (!res.ok) {
    const msg = "detail" in data ? data.detail : "Upload failed";
    throw new Error(msg);
  }

  return data as { url: string };
}

export async function fetchMatchSuggestions(userId: any, limit = 20) {
  const params = new URLSearchParams({
    user_id: String(userId),
    limit: String(limit),
  });

  return apiFetch(`/match/suggestions?${params.toString()}`);
}

// Compatible Crews — groups suggested for this user
export interface MatchedGroup {
  group_id: number;
  group_name: string;
  course_id: number;
  course_code?: string;
  course_name?: string;
  max_members: number;
  member_count: number;
  owner_id: number;
  owner_name: string;
  shared_courses_with_owner: number;
  user_has_group_course: boolean;
  match_score: number;
}

export async function fetchMatchingGroups(userId: any, limit = 20): Promise<MatchedGroup[]> {
  const params = new URLSearchParams({
    user_id: String(userId),
    limit: String(limit),
  });
  return apiFetch<MatchedGroup[]>(`/match/groups?${params.toString()}`);
}

// ---- DM endpoints: prefix is /messages (matches backend mount) ----

export async function startConversation(requesterUserId: any, targetUserId: any) {
  const params = new URLSearchParams({
    requester_user_id: String(requesterUserId),
    target_user_id: String(targetUserId),
  });

  return apiFetch(`/messages/start?${params.toString()}`, {
    method: "POST",
  });
}

export async function fetchDirectMessages(conversationId: any, limit = 50) {
  const params = new URLSearchParams({
    limit: String(limit),
  });
  return apiFetch(`/messages/${conversationId}/messages?${params.toString()}`);
}

export async function sendDirectMessage(conversationId: any, senderUserId: any, content: any) {
  const params = new URLSearchParams({
    sender_user_id: String(senderUserId),
    content: content,
  });

  return apiFetch(`/messages/${conversationId}/messages?${params.toString()}`, {
    method: "POST",
  });
}

export async function fetchInbox(userId: number, limit = 50): Promise<Conversation[]> {
  const params = new URLSearchParams({
    user_id: String(userId),
    limit: String(limit),
  });

  return apiFetch<Conversation[]>(`/messages/inbox?${params.toString()}`);
}

export async function fetchMessageRequests(userId: any, limit = 50) {
  const params = new URLSearchParams({
    user_id: String(userId),
    limit: String(limit),
  });
  return apiFetch(`/messages/requests?${params.toString()}`);
}

export async function respondToMessageRequest(requestId: any, action: any, userId: any) {
  const params = new URLSearchParams({
    user_id: String(userId),
  });

  const res = await fetch(
    `${API_BASE}/messages/requests/${requestId}/${action}?${params.toString()}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    }
  );

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.detail || "Failed to update message request");
  }
  return res.json();
}
