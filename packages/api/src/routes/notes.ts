import { Hono } from "hono";
import { eq, and, or } from "drizzle-orm";
import { getDb, getSqlite, schema } from "@notes/db";
import { requireAuth, getUser } from "../auth.js";

const { notes, tags, noteTags } = schema;

export const notesRouter = new Hono();
notesRouter.use("*", requireAuth);

// ── Visibility helper ─────────────────────────────────────────────────────────
// standard: own notes only
// team:     own notes + team notes
// admin:    all notes
function buildWhereClause(userId: number, role: string, teamId: number | null) {
  if (role === "admin") return undefined; // no filter
  if (role === "team" && teamId != null) {
    return or(eq(notes.ownerId, userId), eq(notes.teamId, teamId));
  }
  return eq(notes.ownerId, userId);
}

// GET /notes?folder=<id>&tag=<name>&q=<search>
notesRouter.get("/", (c) => {
  const db = getDb();
  const sqlite = getSqlite();
  const { userId, role, teamId } = getUser(c);
  const folder = c.req.query("folder");
  const tag = c.req.query("tag");
  const q = c.req.query("q");

  if (q) {
    // FTS5: get matching IDs first, then filter by access
    const ftsIds = sqlite
      .prepare(
        `SELECT notes.id FROM notes
         JOIN notes_fts ON notes.id = notes_fts.rowid
         WHERE notes_fts MATCH ?
         ORDER BY rank`
      )
      .all(q) as { id: number }[];

    const whereClause = buildWhereClause(userId, role, teamId);
    const results = ftsIds
      .map(({ id }) => {
        const n = db.select().from(notes).where(
          whereClause ? and(eq(notes.id, id), whereClause) : eq(notes.id, id)
        ).get();
        return n ?? null;
      })
      .filter(Boolean) as (typeof notes.$inferSelect)[];

    return c.json(results.map((n) => enrichNote(db, n)));
  }

  // Build list query with optional filters
  let sqlBase = `SELECT notes.id FROM notes`;
  const conditions: string[] = [];
  const params: (string | number)[] = [];

  if (tag) {
    sqlBase += ` JOIN note_tags ON notes.id = note_tags.note_id JOIN tags ON note_tags.tag_id = tags.id`;
    conditions.push("tags.name = ?");
    params.push(tag);
  }
  if (folder) {
    conditions.push("notes.folder_id = ?");
    params.push(Number(folder));
  }
  // ownership
  if (role !== "admin") {
    if (role === "team" && teamId != null) {
      conditions.push(`(notes.owner_id = ? OR notes.team_id = ?)`);
      params.push(userId, teamId);
    } else {
      conditions.push("notes.owner_id = ?");
      params.push(userId);
    }
  }

  if (conditions.length) sqlBase += ` WHERE ` + conditions.join(" AND ");
  sqlBase += ` ORDER BY notes.updated_at DESC`;

  const ids = sqlite.prepare(sqlBase).all(...params) as { id: number }[];
  const rows = ids.map(({ id }) => db.select().from(notes).where(eq(notes.id, id)).get()!);
  return c.json(rows.map((n) => enrichNote(db, n)));
});

// GET /notes/:id
notesRouter.get("/:id", (c) => {
  const db = getDb();
  const { userId, role, teamId } = getUser(c);
  const id = Number(c.req.param("id"));
  const row = db.select().from(notes).where(eq(notes.id, id)).get();
  if (!row) return c.json({ error: "Not found" }, 404);
  if (!canRead(row, userId, role, teamId)) return c.json({ error: "Forbidden" }, 403);
  return c.json(enrichNote(db, row));
});

// POST /notes
notesRouter.post("/", async (c) => {
  const db = getDb();
  const { userId, teamId } = getUser(c);
  const body = await c.req.json<{
    title: string;
    content?: string;
    folderId?: number;
    tags?: string[];
    shareWithTeam?: boolean;
  }>();

  const [note] = await db
    .insert(notes)
    .values({
      title: body.title,
      content: body.content ?? "",
      folderId: body.folderId ?? null,
      ownerId: userId,
      teamId: body.shareWithTeam && teamId ? teamId : null,
    })
    .returning();

  if (body.tags?.length) {
    await attachTagsByName(db, note!.id, body.tags);
  }

  return c.json(enrichNote(db, note!), 201);
});

// PUT /notes/:id
notesRouter.put("/:id", async (c) => {
  const db = getDb();
  const { userId, role, teamId } = getUser(c);
  const id = Number(c.req.param("id"));

  const existing = db.select().from(notes).where(eq(notes.id, id)).get();
  if (!existing) return c.json({ error: "Not found" }, 404);
  if (!canWrite(existing, userId, role)) return c.json({ error: "Forbidden" }, 403);

  const body = await c.req.json<{
    title?: string;
    content?: string;
    folderId?: number | null;
    shareWithTeam?: boolean;
  }>();

  const [updated] = await db
    .update(notes)
    .set({
      ...(body.title !== undefined && { title: body.title }),
      ...(body.content !== undefined && { content: body.content }),
      ...(body.folderId !== undefined && { folderId: body.folderId }),
      ...(body.shareWithTeam !== undefined && {
        teamId: body.shareWithTeam && teamId ? teamId : null,
      }),
      updatedAt: new Date().toISOString().replace("T", " ").slice(0, 19),
    })
    .where(eq(notes.id, id))
    .returning();

  return c.json(enrichNote(db, updated!));
});

// DELETE /notes/:id
notesRouter.delete("/:id", async (c) => {
  const db = getDb();
  const { userId, role } = getUser(c);
  const id = Number(c.req.param("id"));

  const existing = db.select().from(notes).where(eq(notes.id, id)).get();
  if (!existing) return c.json({ error: "Not found" }, 404);
  if (!canWrite(existing, userId, role)) return c.json({ error: "Forbidden" }, 403);

  await db.delete(notes).where(eq(notes.id, id));
  return c.json({ success: true });
});

// POST /notes/:id/clone
notesRouter.post("/:id/clone", async (c) => {
  const db = getDb();
  const { userId, role, teamId } = getUser(c);
  const id = Number(c.req.param("id"));

  const source = db.select().from(notes).where(eq(notes.id, id)).get();
  if (!source) return c.json({ error: "Not found" }, 404);
  if (!canRead(source, userId, role, teamId)) return c.json({ error: "Forbidden" }, 403);

  const [clone] = await db
    .insert(notes)
    .values({
      title: `Copy of ${source.title}`,
      content: source.content,
      folderId: source.folderId,
      ownerId: userId,
      teamId: null,
    })
    .returning();

  const sourceTags = db
    .select({ name: schema.tags.name })
    .from(schema.tags)
    .innerJoin(schema.noteTags, eq(schema.tags.id, schema.noteTags.tagId))
    .where(eq(schema.noteTags.noteId, id))
    .all();

  if (sourceTags.length) {
    await attachTagsByName(db, clone!.id, sourceTags.map((t) => t.name));
  }

  return c.json(enrichNote(db, clone!), 201);
});

// POST /notes/:id/tags/:tagId
notesRouter.post("/:id/tags/:tagId", async (c) => {
  const db = getDb();
  const { userId, role } = getUser(c);
  const noteId = Number(c.req.param("id"));
  const tagId = Number(c.req.param("tagId"));

  const note = db.select().from(notes).where(eq(notes.id, noteId)).get();
  if (!note) return c.json({ error: "Not found" }, 404);
  if (!canWrite(note, userId, role)) return c.json({ error: "Forbidden" }, 403);

  await db.insert(noteTags).values({ noteId, tagId }).onConflictDoNothing();
  return c.json({ success: true });
});

// DELETE /notes/:id/tags/:tagId
notesRouter.delete("/:id/tags/:tagId", async (c) => {
  const db = getDb();
  const { userId, role } = getUser(c);
  const noteId = Number(c.req.param("id"));
  const tagId = Number(c.req.param("tagId"));

  const note = db.select().from(notes).where(eq(notes.id, noteId)).get();
  if (!note) return c.json({ error: "Not found" }, 404);
  if (!canWrite(note, userId, role)) return c.json({ error: "Forbidden" }, 403);

  await db
    .delete(noteTags)
    .where(and(eq(noteTags.noteId, noteId), eq(noteTags.tagId, tagId)));
  return c.json({ success: true });
});

// ── Helpers ───────────────────────────────────────────────────────────────────
type Note = typeof notes.$inferSelect;
type Db = ReturnType<typeof getDb>;

function canRead(note: Note, userId: number, role: string, teamId: number | null) {
  if (role === "admin") return true;
  if (note.ownerId === userId) return true;
  if (role === "team" && teamId != null && note.teamId === teamId) return true;
  return false;
}

function canWrite(note: Note, userId: number, role: string) {
  if (role === "admin") return true;
  return note.ownerId === userId;
}

function enrichNote(db: Db, note: Note) {
  const noteTags = db
    .select({ id: schema.tags.id, name: schema.tags.name })
    .from(schema.tags)
    .innerJoin(schema.noteTags, eq(schema.tags.id, schema.noteTags.tagId))
    .where(eq(schema.noteTags.noteId, note.id))
    .all();

  return { ...note, tags: noteTags };
}

async function attachTagsByName(db: Db, noteId: number, tagNames: string[]) {
  for (const name of tagNames) {
    await db.insert(schema.tags).values({ name }).onConflictDoNothing();
    const tag = db.select().from(schema.tags).where(eq(schema.tags.name, name)).get()!;
    await db.insert(schema.noteTags).values({ noteId, tagId: tag.id }).onConflictDoNothing();
  }
}
