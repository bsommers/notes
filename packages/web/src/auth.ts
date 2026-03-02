const TOKEN_KEY = "notes_token";

export interface AuthUser {
  userId: number;
  email: string;
  role: "standard" | "team" | "admin";
  teamId: number | null;
}

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string) {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken() {
  localStorage.removeItem(TOKEN_KEY);
}

export function getUser(): AuthUser | null {
  const token = getToken();
  if (!token) return null;
  try {
    const payload = JSON.parse(atob(token.split(".")[1]!));
    // Check expiry
    if (payload.exp && payload.exp * 1000 < Date.now()) {
      clearToken();
      return null;
    }
    return {
      userId: payload.userId,
      email: payload.email,
      role: payload.role,
      teamId: payload.teamId ?? null,
    };
  } catch {
    clearToken();
    return null;
  }
}

export function isAuthenticated(): boolean {
  return getUser() !== null;
}
