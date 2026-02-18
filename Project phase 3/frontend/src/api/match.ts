// jacob craig

import { API_BASE } from "./base.js";

// small helper to standardize fetch + error handling
async function apiFetch(path: string, options = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: {
      "Content-Type": "application/json",
    },
    ...options,
  });

  let data: {
    courses: never[];
    exists: { profile: any; detail?: string; };
    profile: any; detail?: string 
} = {};
  try {
    data = await res.json();
  } catch {
    data = {};
  }

  if (!res.ok) {
    const msg = data.detail || "Request failed";
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

/**
 * Upload a profile image file
 * Returns: { url }
 */
export async function uploadProfileImage(file: string | Blob) {
  const formData = new FormData();
  formData.append("file", file);

  const res = await fetch(`${API_BASE}/match/profile/image`, {
    method: "POST",
    body: formData,
  });

  let data: { detail?: string } = {};
  try {
    data = await res.json();
  } catch {
    data = {};
  }

  if (!res.ok) {
    const msg = data.detail || "Upload failed";
    throw new Error(msg);
  }

  return data; // { url }
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

export async function fetchInbox(userId: any, limit = 50) {
  const params = new URLSearchParams({
    user_id: String(userId),
    limit: String(limit),
  });
  return apiFetch(`/dm/inbox?${params.toString()}`);
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
