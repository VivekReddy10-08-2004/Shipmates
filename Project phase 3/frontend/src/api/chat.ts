// jacob craig

import { API_BASE } from "./base.js";

export async function getChatMessages(groupId: any, limit = 50) {
  const res = await fetch(`${API_BASE}/groups/${groupId}/chat?limit=${limit}`);
  if (!res.ok) throw new Error("Failed to load chat");
  return res.json();
}

export async function sendChatMessage(groupId: any, userId: any, content: string) {
  const res = await fetch(`${API_BASE}/groups/${groupId}/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ user_id: userId, content }),
  });

  if (!res.ok) throw new Error("Failed to send message");
  return res.json();
}

