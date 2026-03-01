import { describe, it, expect } from "vitest";
import { app, registerUser, authHeader } from "../helpers/api.js";

async function createNote(
  token: string,
  data: { title: string; content?: string } = { title: "Test Note" }
) {
  const res = await app.request("/notes", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeader(token) },
    body: JSON.stringify(data),
  });
  return res.json() as Promise<{ id: number; title: string; content: string; tags: { id: number; name: string }[] }>;
}

describe("Notes CRUD", () => {
  it("creates a note", async () => {
    const { token } = await registerUser("note-create@test.com", "pass");
    const res = await app.request("/notes", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeader(token) },
      body: JSON.stringify({ title: "My Note", content: "Hello **world**" }),
    });
    expect(res.status).toBe(201);
    const note = await res.json() as { title: string; content: string };
    expect(note.title).toBe("My Note");
    expect(note.content).toBe("Hello **world**");
  });

  it("lists notes for authenticated user", async () => {
    const { token } = await registerUser("note-list@test.com", "pass");
    await createNote(token, { title: "Note A" });
    await createNote(token, { title: "Note B" });
    const res = await app.request("/notes", { headers: authHeader(token) });
    expect(res.status).toBe(200);
    const notes = await res.json() as { title: string }[];
    expect(notes.length).toBe(2);
  });

  it("gets a single note", async () => {
    const { token } = await registerUser("note-get@test.com", "pass");
    const note = await createNote(token, { title: "Single" });
    const res = await app.request(`/notes/${note.id}`, { headers: authHeader(token) });
    expect(res.status).toBe(200);
    const fetched = await res.json() as { title: string };
    expect(fetched.title).toBe("Single");
  });

  it("updates a note", async () => {
    const { token } = await registerUser("note-update@test.com", "pass");
    const note = await createNote(token, { title: "Original" });
    const res = await app.request(`/notes/${note.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", ...authHeader(token) },
      body: JSON.stringify({ title: "Updated" }),
    });
    expect(res.status).toBe(200);
    const updated = await res.json() as { title: string };
    expect(updated.title).toBe("Updated");
  });

  it("deletes a note", async () => {
    const { token } = await registerUser("note-delete@test.com", "pass");
    const note = await createNote(token, { title: "ToDelete" });
    const res = await app.request(`/notes/${note.id}`, {
      method: "DELETE",
      headers: authHeader(token),
    });
    expect(res.status).toBe(200);
    const check = await app.request(`/notes/${note.id}`, { headers: authHeader(token) });
    expect(check.status).toBe(404);
  });

  it("returns 404 for nonexistent note", async () => {
    const { token } = await registerUser("note-404@test.com", "pass");
    const res = await app.request("/notes/99999", { headers: authHeader(token) });
    expect(res.status).toBe(404);
  });
});

describe("Notes ownership", () => {
  it("standard user cannot see another user's notes", async () => {
    const alice = await registerUser("alice@test.com", "pass");
    const bob = await registerUser("bob@test.com", "pass");
    const note = await createNote(alice.token, { title: "Alice's Note" });

    const res = await app.request(`/notes/${note.id}`, { headers: authHeader(bob.token) });
    expect(res.status).toBe(403);
  });

  it("standard user cannot delete another user's note", async () => {
    const alice = await registerUser("alice2@test.com", "pass");
    const bob = await registerUser("bob2@test.com", "pass");
    const note = await createNote(alice.token, { title: "Alice's Note 2" });

    const res = await app.request(`/notes/${note.id}`, {
      method: "DELETE",
      headers: authHeader(bob.token),
    });
    expect(res.status).toBe(403);
  });

  it("admin can see any note", async () => {
    const admin = await registerUser("admin@test.com", "pass", "admin");
    const user = await registerUser("normaluser@test.com", "pass");
    const note = await createNote(user.token, { title: "User Note" });

    const res = await app.request(`/notes/${note.id}`, { headers: authHeader(admin.token) });
    expect(res.status).toBe(200);
  });
});

describe("Notes clone", () => {
  it("clones a note with 'Copy of' prefix", async () => {
    const { token } = await registerUser("clone@test.com", "pass");
    const note = await createNote(token, { title: "Original Note", content: "Some content" });

    const res = await app.request(`/notes/${note.id}/clone`, {
      method: "POST",
      headers: authHeader(token),
    });
    expect(res.status).toBe(201);
    const cloned = await res.json() as { id: number; title: string; content: string };
    expect(cloned.title).toBe("Copy of Original Note");
    expect(cloned.content).toBe("Some content");
    expect(cloned.id).not.toBe(note.id);
  });

  it("clones tags from source note", async () => {
    const { token } = await registerUser("clone-tags@test.com", "pass");
    const note = await createNote(token, { title: "Tagged Note", content: "" });

    // Create and attach a tag
    const tagRes = await app.request("/tags", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeader(token) },
      body: JSON.stringify({ name: "important" }),
    });
    const tag = await tagRes.json() as { id: number };
    await app.request(`/notes/${note.id}/tags/${tag.id}`, {
      method: "POST",
      headers: authHeader(token),
    });

    const res = await app.request(`/notes/${note.id}/clone`, {
      method: "POST",
      headers: authHeader(token),
    });
    const cloned = await res.json() as { tags: { name: string }[] };
    expect(cloned.tags.some((t) => t.name === "important")).toBe(true);
  });
});

describe("Notes FTS search", () => {
  it("finds notes by full-text search", async () => {
    const { token } = await registerUser("search@test.com", "pass");
    await createNote(token, { title: "Vitest Tutorial", content: "Testing with vitest is fun" });
    await createNote(token, { title: "Another Note", content: "Something else entirely" });

    const res = await app.request("/notes?q=vitest", { headers: authHeader(token) });
    expect(res.status).toBe(200);
    const results = await res.json() as { title: string }[];
    expect(results.some((n) => n.title === "Vitest Tutorial")).toBe(true);
  });
});
