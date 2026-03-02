import { Hono } from "hono";
import { eq } from "drizzle-orm";
import { getDb, schema } from "@notes/db";
import { requireAuth } from "../auth.js";

const { tags } = schema;

export const tagsRouter = new Hono();
tagsRouter.use("*", requireAuth);

// GET /tags
tagsRouter.get("/", (c) => {
  const db = getDb();
  const all = db.select().from(tags).all();
  return c.json(all);
});

// POST /tags
tagsRouter.post("/", async (c) => {
  const db = getDb();
  const body = await c.req.json<{ name: string }>();
  const [tag] = await db
    .insert(tags)
    .values({ name: body.name })
    .onConflictDoNothing()
    .returning();

  if (!tag) {
    const existing = db.select().from(tags).where(eq(tags.name, body.name)).get();
    return c.json(existing, 200);
  }

  return c.json(tag, 201);
});
