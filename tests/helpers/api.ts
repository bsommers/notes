import { app } from "../../packages/api/src/index.js";

export { app };

export interface AuthResult {
  token: string;
  userId: number;
  email: string;
}

export async function registerUser(
  email: string,
  password: string,
  role = "standard"
): Promise<AuthResult> {
  const res = await app.request("/auth/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password, role }),
  });
  const data = await res.json() as { token: string; user: { id: number; email: string } };
  return { token: data.token, userId: data.user.id, email: data.user.email };
}

export function authHeader(token: string) {
  return { Authorization: `Bearer ${token}` };
}
