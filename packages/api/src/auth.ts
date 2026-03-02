import { createMiddleware } from "hono/factory";
import jwt from "jsonwebtoken";
import type { Context } from "hono";

export const JWT_SECRET = process.env.JWT_SECRET ?? "notes-dev-secret-change-in-prod";
export const JWT_EXPIRY = "7d";

export interface JwtPayload {
  userId: number;
  email: string;
  role: "standard" | "team" | "admin";
  teamId: number | null;
}

/** Sign a JWT for a user */
export function signToken(payload: JwtPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRY });
}

/** Verify and decode a JWT */
export function verifyToken(token: string): JwtPayload {
  return jwt.verify(token, JWT_SECRET) as JwtPayload;
}

/** Hono middleware — attaches user to context, rejects if missing/invalid */
export const requireAuth = createMiddleware(async (c, next) => {
  const header = c.req.header("Authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;

  if (!token) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  try {
    const payload = verifyToken(token);
    c.set("user", payload);
    await next();
  } catch {
    return c.json({ error: "Invalid or expired token" }, 401);
  }
});

/** Get the authenticated user from context (call after requireAuth) */
export function getUser(c: Context): JwtPayload {
  return c.get("user") as JwtPayload;
}

/** Ownership filter: returns a where-clause condition based on role */
export function accessFilter(user: JwtPayload) {
  return { userId: user.userId, role: user.role, teamId: user.teamId };
}
