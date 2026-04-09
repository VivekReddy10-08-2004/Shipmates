// src/api/auth.js
// By Rise Akizaki, cleaned up to use API_BASE

import { API_BASE } from "./base.js";

export async function registerUser(formData: { first_name: string; last_name: string; email: string; password: string; college_id: string; major_id: string; bio: string; }) {
  const response = await fetch(`${API_BASE}/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(formData),
  });

  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    const msg =
      (typeof data.detail === "string" && data.detail) ||
      (Array.isArray(data.detail) && data.detail[0]?.msg) ||
      data.error ||
      "Registration failed";
    throw new Error(msg);
  }

  return response.json();
}

export async function loginUser(formData: { email: string; password: string; }) {
  const response = await fetch(`${API_BASE}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(formData),
  });

  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    const msg =
      (typeof data.detail === "string" && data.detail) ||
      (Array.isArray(data.detail) && data.detail[0]?.msg) ||
      data.error ||
      "Login failed";
    throw new Error(msg);
  }

  return response.json();
}

export async function logoutUser() {
  const response = await fetch(`${API_BASE}/auth/logout`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
  });

  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    const msg =
      (typeof data.detail === "string" && data.detail) ||
      data.error ||
      "Logout failed";
    throw new Error(msg);
  }

  window.location.href = "/";
}

export async function fetchColleges() {
  const response = await fetch(`${API_BASE}/auth/colleges`);

  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    const msg =
      (typeof data.detail === "string" && data.detail) ||
      data.error ||
      "Failed to load colleges";
    throw new Error(msg);
  }

  return response.json();
}

export async function fetchMajors() {
  const response = await fetch(`${API_BASE}/auth/majors`);

  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    const msg =
      (typeof data.detail === "string" && data.detail) ||
      data.error ||
      "Failed to load majors";
    throw new Error(msg);
  }

  return response.json();
}
