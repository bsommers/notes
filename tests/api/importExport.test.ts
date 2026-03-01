import { describe, it, expect } from "vitest";
import { app, registerUser, authHeader } from "../helpers/api.js";

async function createNote(token: string, title: string, content: string) {
  const res = await app.request("/notes", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeader(token) },
    body: JSON.stringify({ title, content }),
  });
  return res.json() as Promise<{ id: number; title: string; content: string }>;
}

describe("Import", () => {
  it("imports text as a new note via /import/text", async () => {
    const { token } = await registerUser("import-text@test.com", "pass");
    const res = await app.request("/import/text", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...authHeader(token),
      },
      body: JSON.stringify({ title: "Imported Note", content: "This is imported content" }),
    });
    expect(res.status).toBe(201);
    const note = await res.json() as { title: string; content: string };
    expect(note.title).toBe("Imported Note");
    expect(note.content).toBe("This is imported content");
  });
});

describe("Export", () => {
  it("exports a note as markdown", async () => {
    const { token } = await registerUser("export-md@test.com", "pass");
    const note = await createNote(token, "Export Test", "# Hello\n\nWorld");

    const res = await app.request(`/notes/${note.id}/export/markdown`, {
      headers: authHeader(token),
    });
    expect(res.status).toBe(200);
    const text = await res.text();
    expect(text).toContain("# Hello");
  });

  it("exports a note as plain text", async () => {
    const { token } = await registerUser("export-txt@test.com", "pass");
    const note = await createNote(token, "Export TXT", "Hello plain text");

    const res = await app.request(`/notes/${note.id}/export/txt`, {
      headers: authHeader(token),
    });
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/plain");
    const text = await res.text();
    expect(text).toContain("Hello plain text");
  });

  it("exports a note as JSON", async () => {
    const { token } = await registerUser("export-json@test.com", "pass");
    const note = await createNote(token, "JSON Export", "Content here");

    const res = await app.request(`/notes/${note.id}/export/json`, {
      headers: authHeader(token),
    });
    expect(res.status).toBe(200);
    const data = await res.json() as { title: string; content: string };
    expect(data.title).toBe("JSON Export");
    expect(data.content).toBe("Content here");
  });

  it("round-trips via import/text then export/json", async () => {
    const { token } = await registerUser("roundtrip@test.com", "pass");

    // Import a note
    const importRes = await app.request("/import/text", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeader(token) },
      body: JSON.stringify({ title: "Round Trip", content: "Some data" }),
    });
    expect(importRes.status).toBe(201);
    const imported = await importRes.json() as { id: number };

    // Export it as JSON
    const exportRes = await app.request(`/notes/${imported.id}/export/json`, {
      headers: authHeader(token),
    });
    const exported = await exportRes.json() as { title: string; content: string };
    expect(exported.title).toBe("Round Trip");
    expect(exported.content).toBe("Some data");
  });
});
