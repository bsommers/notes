import { Hono } from "hono";
import { eq, or } from "drizzle-orm";
import { getDb, schema } from "@notes/db";
import mammoth from "mammoth";
import { PDFParse } from "pdf-parse";
import PDFKit from "pdfkit";
import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
} from "docx";
import { requireAuth, getUser } from "../auth.js";

const { notes, tags, noteTags, folders } = schema;

export const importExportRouter = new Hono();
importExportRouter.use("*", requireAuth);

// ── EXPORT ───────────────────────────────────────────────────────────────────

/** GET /export/json — bulk export user's visible notes */
importExportRouter.get("/export/json", (c) => {
  const db = getDb();
  const { userId, role, teamId } = getUser(c);

  let allNotes: (typeof notes.$inferSelect)[];
  if (role === "admin") {
    allNotes = db.select().from(notes).all();
  } else if (role === "team" && teamId != null) {
    allNotes = db.select().from(notes).where(
      or(eq(notes.ownerId, userId), eq(notes.teamId, teamId))
    ).all();
  } else {
    allNotes = db.select().from(notes).where(eq(notes.ownerId, userId)).all();
  }

  const allFolders = db.select().from(folders).all();
  const allTags = db.select().from(tags).all();
  const allNoteTags = db.select().from(noteTags).all();

  const enrichedNotes = allNotes.map((n) => ({
    ...n,
    tags: allNoteTags
      .filter((nt) => nt.noteId === n.id)
      .map((nt) => allTags.find((t) => t.id === nt.tagId)!)
      .filter(Boolean),
  }));

  c.header("Content-Disposition", 'attachment; filename="notes-backup.json"');
  return c.json({ notes: enrichedNotes, folders: allFolders, tags: allTags });
});

/** GET /notes/:id/export/markdown — export single note as .md file */
importExportRouter.get("/notes/:id/export/markdown", (c) => {
  const db = getDb();
  const id = Number(c.req.param("id"));
  const note = db.select().from(notes).where(eq(notes.id, id)).get();
  if (!note) return c.json({ error: "Not found" }, 404);

  const filename = `${note.title.replace(/[^a-z0-9]/gi, "-").toLowerCase()}.md`;
  c.header("Content-Type", "text/markdown; charset=utf-8");
  c.header("Content-Disposition", `attachment; filename="${filename}"`);
  return c.text(`# ${note.title}\n\n${note.content}`);
});

/** GET /notes/:id/export/json — export single note as .json */
importExportRouter.get("/notes/:id/export/json", (c) => {
  const db = getDb();
  const id = Number(c.req.param("id"));
  const note = db.select().from(notes).where(eq(notes.id, id)).get();
  if (!note) return c.json({ error: "Not found" }, 404);

  const noteTags = db
    .select({ id: schema.tags.id, name: schema.tags.name })
    .from(schema.tags)
    .innerJoin(schema.noteTags, eq(schema.tags.id, schema.noteTags.tagId))
    .where(eq(schema.noteTags.noteId, id))
    .all();

  const filename = `${note.title.replace(/[^a-z0-9]/gi, "-").toLowerCase()}.json`;
  c.header("Content-Disposition", `attachment; filename="${filename}"`);
  return c.json({ ...note, tags: noteTags });
});

/** GET /notes/:id/export/txt — export as plain text */
importExportRouter.get("/notes/:id/export/txt", (c) => {
  const db = getDb();
  const id = Number(c.req.param("id"));
  const note = db.select().from(notes).where(eq(notes.id, id)).get();
  if (!note) return c.json({ error: "Not found" }, 404);

  // Strip markdown syntax for plain text
  const plaintext = note.content
    .replace(/#{1,6}\s/g, "")
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .replace(/_(.*?)_/g, "$1")
    .replace(/`(.*?)`/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1");

  const filename = `${note.title.replace(/[^a-z0-9]/gi, "-").toLowerCase()}.txt`;
  c.header("Content-Type", "text/plain; charset=utf-8");
  c.header("Content-Disposition", `attachment; filename="${filename}"`);
  return c.text(`${note.title}\n${"=".repeat(note.title.length)}\n\n${plaintext}`);
});

/** GET /notes/:id/export/pdf — export as PDF */
importExportRouter.get("/notes/:id/export/pdf", async (c) => {
  const db = getDb();
  const id = Number(c.req.param("id"));
  const note = db.select().from(notes).where(eq(notes.id, id)).get();
  if (!note) return c.json({ error: "Not found" }, 404);

  const filename = `${note.title.replace(/[^a-z0-9]/gi, "-").toLowerCase()}.pdf`;

  const buf = await new Promise<Buffer>((resolve, reject) => {
    const doc = new PDFKit({ margin: 60 });
    const chunks: Buffer[] = [];
    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    // Title
    doc.fontSize(20).font("Helvetica-Bold").text(note.title, { paragraphGap: 10 });
    doc.moveDown(0.5);
    doc.fontSize(9).font("Helvetica").fillColor("#888")
      .text(`Updated: ${note.updatedAt}`, { paragraphGap: 8 });
    doc.moveDown();

    // Content — render line by line with basic markdown awareness
    doc.fillColor("#000").fontSize(11).font("Helvetica");
    const lines = note.content.split("\n");
    for (const line of lines) {
      if (/^#{1,6}\s/.test(line)) {
        const level = line.match(/^(#{1,6})/)?.[1].length ?? 1;
        const text = line.replace(/^#{1,6}\s/, "");
        const size = Math.max(11, 20 - level * 2);
        doc.fontSize(size).font("Helvetica-Bold").text(text, { paragraphGap: 6 });
        doc.fontSize(11).font("Helvetica");
      } else if (line.trim() === "") {
        doc.moveDown(0.4);
      } else {
        // Strip inline markdown for plain rendering
        const plain = line
          .replace(/\*\*(.*?)\*\*/g, "$1")
          .replace(/_(.*?)_/g, "$1")
          .replace(/`(.*?)`/g, "$1")
          .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1");
        doc.text(plain, { paragraphGap: 3 });
      }
    }

    doc.end();
  });

  c.header("Content-Type", "application/pdf");
  c.header("Content-Disposition", `attachment; filename="${filename}"`);
  return c.body(new Uint8Array(buf));
});

/** GET /notes/:id/export/docx — export as Word document */
importExportRouter.get("/notes/:id/export/docx", async (c) => {
  const db = getDb();
  const id = Number(c.req.param("id"));
  const note = db.select().from(notes).where(eq(notes.id, id)).get();
  if (!note) return c.json({ error: "Not found" }, 404);

  const filename = `${note.title.replace(/[^a-z0-9]/gi, "-").toLowerCase()}.docx`;

  const lines = note.content.split("\n");
  const paragraphs: Paragraph[] = [
    new Paragraph({
      text: note.title,
      heading: HeadingLevel.TITLE,
    }),
  ];

  for (const line of lines) {
    const headingMatch = line.match(/^(#{1,6})\s+(.*)/);
    if (headingMatch) {
      const level = headingMatch[1]!.length;
      const text = headingMatch[2] ?? "";
      const headingMap: Record<number, (typeof HeadingLevel)[keyof typeof HeadingLevel]> = {
        1: HeadingLevel.HEADING_1,
        2: HeadingLevel.HEADING_2,
        3: HeadingLevel.HEADING_3,
        4: HeadingLevel.HEADING_4,
        5: HeadingLevel.HEADING_5,
        6: HeadingLevel.HEADING_6,
      };
      paragraphs.push(new Paragraph({ text, heading: headingMap[level] ?? HeadingLevel.HEADING_1 }));
    } else if (line.trim() === "") {
      paragraphs.push(new Paragraph({ text: "" }));
    } else {
      // Simple inline bold/italic handling
      const runs: TextRun[] = [];
      const parts = line.split(/(\*\*.*?\*\*|_.*?_)/g);
      for (const part of parts) {
        if (part.startsWith("**") && part.endsWith("**")) {
          runs.push(new TextRun({ text: part.slice(2, -2), bold: true }));
        } else if (part.startsWith("_") && part.endsWith("_")) {
          runs.push(new TextRun({ text: part.slice(1, -1), italics: true }));
        } else {
          runs.push(new TextRun({ text: part }));
        }
      }
      paragraphs.push(new Paragraph({ children: runs }));
    }
  }

  const doc = new Document({ sections: [{ children: paragraphs }] });
  const buf = await Packer.toBuffer(doc);

  c.header("Content-Type", "application/vnd.openxmlformats-officedocument.wordprocessingml.document");
  c.header("Content-Disposition", `attachment; filename="${filename}"`);
  return c.body(new Uint8Array(buf));
});

// ── IMPORT ───────────────────────────────────────────────────────────────────

/** POST /import/text — create note from plain text/markdown body */
importExportRouter.post("/import/text", async (c) => {
  const db = getDb();
  const { userId } = getUser(c);
  const body = await c.req.json<{
    title?: string;
    content: string;
    folderId?: number;
    tags?: string[];
  }>();

  const title = body.title ?? inferTitle(body.content) ?? "Imported Note";
  const [note] = await db
    .insert(notes)
    .values({ title, content: body.content, folderId: body.folderId ?? null, ownerId: userId })
    .returning();

  if (body.tags?.length) {
    await attachTagsByName(db, note!.id, body.tags);
  }

  return c.json(note, 201);
});

/** POST /import/json — restore from backup JSON */
importExportRouter.post("/import/json", async (c) => {
  const db = getDb();
  const { userId } = getUser(c);
  const body = await c.req.json<{
    notes: Array<{
      title: string;
      content: string;
      folderId?: number | null;
      tags?: Array<{ name: string }>;
    }>;
  }>();

  const created: number[] = [];
  for (const n of body.notes ?? []) {
    const [note] = await db
      .insert(notes)
      .values({
        title: n.title,
        content: n.content,
        folderId: n.folderId ?? null,
        ownerId: userId,
      })
      .returning();
    created.push(note!.id);

    if (n.tags?.length) {
      await attachTagsByName(db, note!.id, n.tags.map((t) => t.name));
    }
  }

  return c.json({ imported: created.length, ids: created }, 201);
});

/** POST /import/file — upload .md, .txt, .docx, or .pdf via multipart */
importExportRouter.post("/import/file", async (c) => {
  const db = getDb();
  const { userId } = getUser(c);
  const formData = await c.req.formData();
  const file = formData.get("file") as File | null;
  const titleOverride = formData.get("title")?.toString();
  const folderIdRaw = formData.get("folderId")?.toString();
  const folderId = folderIdRaw ? Number(folderIdRaw) : null;

  if (!file) return c.json({ error: "No file provided" }, 400);

  const filename = file.name ?? "upload";
  const ext = filename.split(".").pop()?.toLowerCase() ?? "";

  let content = "";
  let title = titleOverride ?? filename.replace(/\.[^.]+$/, "");

  if (ext === "md" || ext === "txt") {
    content = await file.text();
    if (!titleOverride) title = inferTitle(content) ?? title;
  } else if (ext === "docx") {
    const buffer = await file.arrayBuffer();
    const result = await mammoth.extractRawText({ buffer: Buffer.from(buffer) });
    content = result.value;
    if (!titleOverride) title = inferTitle(content) ?? title;
  } else if (ext === "pdf") {
    const buffer = await file.arrayBuffer();
    const parser = new PDFParse({ data: new Uint8Array(buffer) });
    const result = await parser.getText();
    content = result.text;
    if (!titleOverride) title = inferTitle(content) ?? title;
  } else {
    return c.json({ error: `Unsupported file type: .${ext}` }, 400);
  }

  const [note] = await db
    .insert(notes)
    .values({ title, content, folderId, ownerId: userId })
    .returning();

  return c.json(note, 201);
});

// ── Helpers ──────────────────────────────────────────────────────────────────

function inferTitle(content: string): string | null {
  const match = content.match(/^#\s+(.+)$/m);
  return match?.[1]?.trim() ?? content.split("\n")[0]?.trim().slice(0, 80) ?? null;
}

type Db = ReturnType<typeof getDb>;

async function attachTagsByName(db: Db, noteId: number, tagNames: string[]) {
  for (const name of tagNames) {
    await db.insert(schema.tags).values({ name }).onConflictDoNothing();
    const tag = db
      .select()
      .from(schema.tags)
      .where(eq(schema.tags.name, name))
      .get()!;
    await db
      .insert(schema.noteTags)
      .values({ noteId, tagId: tag.id })
      .onConflictDoNothing();
  }
}
