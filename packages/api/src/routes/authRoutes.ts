import { Hono } from "hono";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { getDb, schema } from "@notes/db";
import { signToken, requireAuth, getUser, JWT_EXPIRY } from "../auth.js";

const { users, teams } = schema;

export const authRouter = new Hono();

// POST /auth/register
authRouter.post("/register", async (c) => {
  const db = getDb();
  const body = await c.req.json<{
    email: string;
    password: string;
    role?: string;
    teamName?: string;
  }>();

  if (!body.email || !body.password) {
    return c.json({ error: "email and password are required" }, 400);
  }

  const existing = db.select().from(users).where(eq(users.email, body.email)).get();
  if (existing) {
    return c.json({ error: "Email already registered" }, 409);
  }

  const role = (["standard", "team", "admin"].includes(body.role ?? ""))
    ? (body.role as "standard" | "team" | "admin")
    : "standard";

  let teamId: number | null = null;
  if (role === "team" && body.teamName) {
    await db.insert(teams).values({ name: body.teamName }).onConflictDoNothing();
    const team = db.select().from(teams).where(eq(teams.name, body.teamName)).get();
    teamId = team?.id ?? null;
  }

  const passwordHash = await bcrypt.hash(body.password, 12);
  const [user] = await db
    .insert(users)
    .values({ email: body.email, passwordHash, role, teamId })
    .returning();

  const token = signToken({
    userId: user!.id,
    email: user!.email,
    role: user!.role as "standard" | "team" | "admin",
    teamId: user!.teamId,
  });

  return c.json({ token, expiresIn: JWT_EXPIRY, user: safeUser(user!) }, 201);
});

// POST /auth/login
authRouter.post("/login", async (c) => {
  const db = getDb();
  const body = await c.req.json<{ email: string; password: string }>();

  if (!body.email || !body.password) {
    return c.json({ error: "email and password are required" }, 400);
  }

  const user = db.select().from(users).where(eq(users.email, body.email)).get();
  if (!user) {
    return c.json({ error: "Invalid credentials" }, 401);
  }

  const valid = await bcrypt.compare(body.password, user.passwordHash);
  if (!valid) {
    return c.json({ error: "Invalid credentials" }, 401);
  }

  const token = signToken({
    userId: user.id,
    email: user.email,
    role: user.role as "standard" | "team" | "admin",
    teamId: user.teamId,
  });

  return c.json({ token, expiresIn: JWT_EXPIRY, user: safeUser(user) });
});

// GET /auth/me — return current user info
authRouter.get("/me", requireAuth, (c) => {
  const user = getUser(c);
  return c.json(user);
});

// ── Admin: list users ─────────────────────────────────────────────────────────
authRouter.get("/users", requireAuth, (c) => {
  const caller = getUser(c);
  if (caller.role !== "admin") return c.json({ error: "Forbidden" }, 403);

  const db = getDb();
  const all = db.select({
    id: users.id,
    email: users.email,
    role: users.role,
    teamId: users.teamId,
    createdAt: users.createdAt,
  }).from(users).all();

  return c.json(all);
});

// ── Admin: update user role ───────────────────────────────────────────────────
authRouter.put("/users/:id/role", requireAuth, async (c) => {
  const caller = getUser(c);
  if (caller.role !== "admin") return c.json({ error: "Forbidden" }, 403);

  const db = getDb();
  const id = Number(c.req.param("id"));
  const body = await c.req.json<{ role: string; teamId?: number | null }>();

  const role = body.role as "standard" | "team" | "admin";
  const [updated] = await db
    .update(users)
    .set({ role, ...(body.teamId !== undefined && { teamId: body.teamId }) })
    .where(eq(users.id, id))
    .returning();

  if (!updated) return c.json({ error: "User not found" }, 404);
  return c.json(safeUser(updated));
});

// ── Teams ─────────────────────────────────────────────────────────────────────
authRouter.get("/teams", requireAuth, (c) => {
  const db = getDb();
  const all = db.select().from(teams).all();
  return c.json(all);
});

authRouter.post("/teams", requireAuth, async (c) => {
  const caller = getUser(c);
  if (caller.role !== "admin") return c.json({ error: "Forbidden" }, 403);

  const db = getDb();
  const body = await c.req.json<{ name: string }>();
  const [team] = await db.insert(teams).values({ name: body.name }).returning();
  return c.json(team, 201);
});

function safeUser(u: typeof users.$inferSelect) {
  const { passwordHash: _, ...safe } = u;
  return safe;
}
