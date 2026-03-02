import { Hono } from "hono";
import { eq } from "drizzle-orm";
import { getDb, schema } from "@notes/db";
import { requireAuth, getUser } from "../auth.js";

const { folders } = schema;

export const foldersRouter = new Hono();
foldersRouter.use("*", requireAuth);

// GET /folders
foldersRouter.get("/", (c) => {
  const db = getDb();
  const { userId, role, teamId } = getUser(c);

  let all: typeof folders.$inferSelect[];
  if (role === "admin") {
    all = db.select().from(folders).all();
  } else if (role === "team" && teamId != null) {
    all = db
      .select()
      .from(folders)
      .where(
        eq(folders.ownerId, userId)
      )
      .all();
    // also include team folders
    const teamFolders = db.select().from(folders).where(eq(folders.teamId, teamId)).all();
    const seen = new Set(all.map((f) => f.id));
    for (const f of teamFolders) {
      if (!seen.has(f.id)) all.push(f);
    }
  } else {
    all = db.select().from(folders).where(eq(folders.ownerId, userId)).all();
  }

  return c.json(all);
});

// POST /folders
foldersRouter.post("/", async (c) => {
  const db = getDb();
  const { userId, teamId } = getUser(c);
  const body = await c.req.json<{ name: string; parentId?: number; shareWithTeam?: boolean }>();

  const [folder] = await db
    .insert(folders)
    .values({
      name: body.name,
      parentId: body.parentId ?? null,
      ownerId: userId,
      teamId: body.shareWithTeam && teamId ? teamId : null,
    })
    .returning();

  return c.json(folder, 201);
});

// DELETE /folders/:id
foldersRouter.delete("/:id", async (c) => {
  const db = getDb();
  const { userId, role } = getUser(c);
  const id = Number(c.req.param("id"));

  const existing = db.select().from(folders).where(eq(folders.id, id)).get();
  if (!existing) return c.json({ error: "Not found" }, 404);
  if (role !== "admin" && existing.ownerId !== userId) return c.json({ error: "Forbidden" }, 403);

  await db.delete(folders).where(eq(folders.id, id));
  return c.json({ success: true });
});
