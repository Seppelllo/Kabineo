import { api } from "./api";

export interface User {
  id: string;
  email: string;
  username: string;
  full_name: string | null;
  role: string;
  is_active: boolean;
  must_change_password: boolean;
  created_at: string;
}

export interface TokenResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
  must_change_password: boolean;
}

export async function login(email: string, password: string): Promise<User> {
  const tokens = await api<TokenResponse>("/api/auth/login", {
    method: "POST",
    body: { email, password },
  });
  localStorage.setItem("access_token", tokens.access_token);
  localStorage.setItem("refresh_token", tokens.refresh_token);
  return getMe();
}

export async function register(
  email: string,
  username: string,
  password: string,
  full_name?: string,
): Promise<User> {
  return api<User>("/api/auth/register", {
    method: "POST",
    body: { email, username, password, full_name },
  });
}

export async function getMe(): Promise<User> {
  return api<User>("/api/auth/me");
}

export function logout() {
  localStorage.removeItem("access_token");
  localStorage.removeItem("refresh_token");
  window.location.href = "/login";
}

export function isAuthenticated(): boolean {
  if (typeof window === "undefined") return false;
  return !!localStorage.getItem("access_token");
}
