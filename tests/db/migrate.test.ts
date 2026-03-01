import { describe, it, expect } from "vitest";
import { getDb, getSqlite, schema } from "@notes/db";
import { eq } from "drizzle-orm";

describe("Database migrations", () => {
  it("creates core tables", () => {
    const sqlite = getSqlite();
    const tables = sqlite
      .prepare(`SELECT name FROM sqlite_master WHERE type='table' ORDER BY name`)
      .all() as { name: string }[];
    const names = tables.map((t) => t.name);
    expect(names).toContain("notes");
    expect(names).toContain("folders");
    expect(names).toContain("tags");
    expect(names).toContain("note_tags");
    expect(names).toContain("users");
    expect(names).toContain("teams");
  });

  it("creates FTS5 virtual table", () => {
    const sqlite = getSqlite();
    const fts = sqlite
      .prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name='notes_fts'`)
      .get() as { name: string } | undefined;
    expect(fts?.name).toBe("notes_fts");
  });

  it("FTS search works after insert", () => {
    const db = getDb();
    const sqlite = getSqlite();

    // Insert a note via drizzle (FTS trigger should fire)
    db.insert(schema.notes).values({
      title: "FTS Test Note",
      content: "Searchable unique content xyzabc",
      ownerId: 1,
      teamId: null,
      folderId: null,
    }).run();

    const results = sqlite
      .prepare(`SELECT rowid FROM notes_fts WHERE notes_fts MATCH 'xyzabc'`)
      .all() as { rowid: number }[];
    expect(results.length).toBeGreaterThan(0);
  });

  it("notes table has owner_id and team_id columns", () => {
    const sqlite = getSqlite();
    const cols = sqlite
      .prepare(`PRAGMA table_info(notes)`)
      .all() as { name: string }[];
    const colNames = cols.map((c) => c.name);
    expect(colNames).toContain("owner_id");
    expect(colNames).toContain("team_id");
  });
});
