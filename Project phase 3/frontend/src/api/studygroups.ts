// Jacob Craig

import type { Course } from "../hooks/useCurrentUser.js";
import { API_BASE } from "./base.js";

// Interfaces
export interface Session { // change types as needed - Rise
  location: string;
  group_name: string;
}

// small helper to standardize fetch + error handling
async function apiFetch(path: string, options = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: {
      "Content-Type": "application/json",
    },
    ...options,
  });

  let data: { detail?: string } = {};
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

export async function fetchPublicGroups(courseId: never, limit = 20) {
  const params = new URLSearchParams({
    course_id: String(courseId),
    limit: String(limit),
  });

  return apiFetch(`/groups/public?${params.toString()}`);
}

export async function fetchMyGroups(userId: any) {
  const params = new URLSearchParams({
    user_id: String(userId),
  });

  return apiFetch(`/groups/mine?${params.toString()}`);
}

export async function createGroup(payload: { group_name: string; max_members: number; course_id: number; is_private: boolean; creator_user_id: any; }) {
  // payload:
  // {
  //   group_name,
  //   max_members,
  //   course_id,
  //   is_private,
  //   creator_user_id
  // }
  return apiFetch("/groups", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

// comes from /groups/<id>/join (status/message fields).
export async function joinGroup(groupId: any, userId: any) {
  return apiFetch(`/groups/${groupId}/join`, {
    method: "POST",
    body: JSON.stringify({ user_id: userId }),
  });
}

export async function createSession(groupId: any, payload: { session_date: string; start_time: string; end_time: string; location: string; notes: string; }) {
  // payload: { session_date, start_time, end_time, location, notes? }
  return apiFetch(`/groups/${groupId}/sessions`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function fetchUpcomingSessions(userId: any, limit = 50) {
  const params = new URLSearchParams({
    user_id: String(userId),
    limit: String(limit),
  });

  return apiFetch(`/groups/sessions/upcoming?${params.toString()}`);
}

// GET /groups/:id/requests?owner_id=...
// returns: [{ user_id, full_name, request_date }, ...]
export async function fetchPendingJoinRequests(groupId: any, ownerId: any) {
  const params = new URLSearchParams({
    owner_id: String(ownerId),
  });

  return apiFetch(`/groups/${groupId}/requests?${params.toString()}`);
}

// POST /groups/:id/requests/:user_id/approve
// body: { owner_id }
export async function approveJoinRequest(groupId: any, targetUserId: any, ownerId: any) {
  return apiFetch(`/groups/${groupId}/requests/${targetUserId}/approve`, {
    method: "POST",
    body: JSON.stringify({ owner_id: ownerId }),
  });
}

// POST /groups/:id/requests/:user_id/reject
// body: { owner_id }
export async function rejectJoinRequest(groupId: any, targetUserId: any, ownerId: any) {
  return apiFetch(`/groups/${groupId}/requests/${targetUserId}/reject`, {
    method: "POST",
    body: JSON.stringify({ owner_id: ownerId }),
  });
}

export async function fetchGroupMembers(groupId: any) {
  const res = await fetch(`${API_BASE}/groups/${groupId}/members`);

  if (!res.ok) {
    const msg = await res.text();
    throw new Error(msg || "Failed to load members");
  }

  return res.json();
}

export async function kickMember(groupId: any, userId: any, ownerId: any) {
  const res = await fetch(
    `${API_BASE}/groups/${groupId}/members/${userId}/kick`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ owner_id: ownerId }),
    }
  );

  if (!res.ok) {
    const msg = await res.text();
    throw new Error(msg || "Failed to remove member");
  }

  return res.json();
}

export async function generateInviteCode(groupId: any, ownerId: any) {
  return apiFetch(`/groups/${groupId}/invite-code`, {
    method: "POST",
    body: JSON.stringify({ owner_id: ownerId }),
  });
}

export async function joinByInviteCode(inviteCode: string, userId: any) {
  return apiFetch(`/groups/join-with-code`, {
    method: "POST",
    body: JSON.stringify({
      user_id: userId,
      invite_code: inviteCode,
    }),
  });
}

export async function searchCourses(query: any, limit = 8) {
  const params = new URLSearchParams({
    q: query,
    limit: String(limit),
  });

  const data = await apiFetch(`/courses/search?${params.toString()}`); // had to change to await instead of return, because it didn't like me trying to apply a string to the type of Course[]- Rise
  return data as Course[];
}
