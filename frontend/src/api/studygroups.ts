// Jacob Craig

import type { Key, ReactNode } from "react";
import type { Course } from "../hooks/useCurrentUser.js";
import { API_BASE } from "./base.js";

// Interfaces
export interface Session { // change types as needed - Rise
  location: string;
  group_name: string;
  session_date: any;
}

export interface Group {
  group_name: string;
  group_id: number;
  role: string;
  members: any;
  max_members: any;
  last_session: any;
}

export interface ChatGroup {
  name: string;
  id: number;

}

export interface ScheduleGroup{
  name: ReactNode;
  id: number;

}

export interface ManageGroup {
  name: ReactNode;
  role: any;
  id: number;

}

export interface Member {
  joined_at: any;
  role: ReactNode;
  user_name: string;
  user_id: Key | null | undefined;

}

export interface StudyRequest {
  request_date: any;
  full_name: string;
  user_id: number;
}

export interface Date {
  today: string;
}

export interface Invite {
  expires_at: ReactNode;
  invite_code: ReactNode;

}

// small helper to standardize fetch + error handling
async function apiFetch(path: string, options = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
    },
    ...options,
  });


  let data: {
    status: string;
    message: string;
    detail?: string;
  } | undefined;

  try {
    data = await res.json();
  } catch {
    data = undefined; // had to change it so the data could be possibly undefined, since it was complaining that there were missing properties - Rise
  }

  if (!res.ok) {
    const msg = data?.detail || "Request failed";
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

export async function fetchMyGroups(userId: number): Promise<Group[]> { // Had to promise that it returns a group to fix the error, but I'm unsure if it actually does. - Rise
  const params = new URLSearchParams({
    user_id: String(userId),
  });

  const res = await apiFetch(`/groups/mine?${params.toString()}`);
  return res as unknown as Group[];
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
  const q = new URLSearchParams({ user_id: String(userId) });
  return apiFetch(`/groups/${groupId}/join?${q.toString()}`, {
    method: "POST",
  });
}

export async function createSession(groupId: any, payload: { session_date: string; start_time: string; end_time: string; location: string; notes: string; }) {
  // payload: { session_date, start_time, end_time, location, notes? }
  return apiFetch(`/groups/${groupId}/sessions`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function fetchUpcomingSessions(userId: number | null, p0?: number): Promise<Session[]> { // Had to promise that it returns sessions to fix the error, but I'm unsure if it actually does. - Rise
  const params = new URLSearchParams({
    user_id: String(userId),
  });

  const res = await apiFetch(`/groups/sessions/upcoming?${params.toString()}`);
  return res as unknown as Session[];
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

// Changed so handleGenerateInviteCode stops complaining that "res"'s type (from ApiFetch detail?: string) couldn't be assigned to 'SetStateAction<Invite | null>'. - Rise
export async function generateInviteCode(
  groupId: number,
  ownerId: number
): Promise<Invite> {
  const data = await apiFetch(`/groups/${groupId}/invite-code`, {
    method: "POST",
    body: JSON.stringify({ owner_id: ownerId }),
  });

  // If backend returned an error object like { detail: "..." }
  if (data && typeof data === "object" && "detail" in data) {
    throw new Error(
      typeof data.detail === "string"
        ? data.detail
        : "Failed to generate invite code"
    );
  }

  return data as unknown as Invite;
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

// ───────── Group ↔ Individual matching + invites ─────────────────

export interface SuggestedMember {
  user_id: number;
  first_name: string;
  last_name: string;
  college_id: number | null;
  study_style: string | null;
  meeting_pref: string | null;
  study_goal: string | null;
  focus_time_pref: string | null;
  noise_pref: string | null;
  age: number | null;
  bio: string | null;
  profile_image_url: string | null;
  shared_courses_with_owner: number;
  has_group_course: boolean;
  match_score: number;
}

export interface GroupInvite {
  invite_id: number;
  group_id: number;
  group_name: string;
  course_id: number;
  course_code?: string;
  course_name?: string;
  max_members: number;
  member_count: number;
  invited_by_user_id: number;
  invited_by_name: string;
  created_at: string;
}

export interface SentGroupInvite {
  invite_id: number;
  invited_user_id: number;
  invited_user_name: string;
  invite_status: "pending" | "accepted" | "rejected" | "expired";
  created_at: string;
  responded_at: string | null;
}

export async function fetchGroupSuggestedUsers(
  groupId: number,
  ownerId: number,
  limit = 20,
): Promise<SuggestedMember[]> {
  const params = new URLSearchParams({
    owner_id: String(ownerId),
    limit: String(limit),
  });
  const data = await apiFetch(
    `/groups/${groupId}/suggestions?${params.toString()}`,
  );
  return data as unknown as SuggestedMember[];
}

export async function inviteUserToGroup(
  groupId: number,
  ownerId: number,
  invitedUserId: number,
) {
  return apiFetch(`/groups/${groupId}/invite`, {
    method: "POST",
    body: JSON.stringify({
      owner_id: ownerId,
      invited_user_id: invitedUserId,
    }),
  });
}

export async function fetchMyGroupInvites(
  userId: number,
  limit = 50,
): Promise<GroupInvite[]> {
  const params = new URLSearchParams({
    user_id: String(userId),
    limit: String(limit),
  });
  const data = await apiFetch(`/groups/invites?${params.toString()}`);
  return data as unknown as GroupInvite[];
}

export async function respondToGroupInvite(
  inviteId: number,
  action: "accept" | "reject",
  userId: number,
) {
  const params = new URLSearchParams({ user_id: String(userId) });
  return apiFetch(`/groups/invites/${inviteId}/${action}?${params.toString()}`, {
    method: "POST",
  });
}

export async function fetchSentGroupInvites(
  groupId: number,
  ownerId: number,
): Promise<SentGroupInvite[]> {
  const params = new URLSearchParams({ owner_id: String(ownerId) });
  const data = await apiFetch(
    `/groups/${groupId}/invites/sent?${params.toString()}`,
  );
  return data as unknown as SentGroupInvite[];
}

export async function searchCourses(query: any, limit = 8) {
  const params = new URLSearchParams({
    q: query,
    limit: String(limit),
  });

  const data = await apiFetch(`/courses/search?${params.toString()}`); // had to change to await instead of return, because it didn't like me trying to apply a string to the type of Course[]- Rise
  return data as unknown as Course[];
}

export async function ensureCourse(text: string) {
  const data = await apiFetch("/courses/ensure", {
    method: "POST",
    body: JSON.stringify({ text }),
  });
  return data as unknown as Course & { created: boolean };
}
