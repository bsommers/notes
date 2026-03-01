import { describe, it, expect } from "vitest";
import { app, registerUser, authHeader } from "../helpers/api.js";

async function createNote(token: string, title = "Test") {
  const res = await app.request("/notes", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeader(token) },
    body: JSON.stringify({ title }),
  });
  return res.json() as Promise<{ id: number }>;
}

async function createTag(token: string, name: string) {
  const res = await app.request("/tags", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeader(token) },
    body: JSON.stringify({ name }),
  });
  return res.json() as Promise<{ id: number; name: string }>;
}

describe("Tags", () => {
  it("creates a tag", async () => {
    const { token } = await registerUser("tag-create@test.com", "pass");
    const res = await app.request("/tags", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeader(token) },
      body: JSON.stringify({ name: "urgent" }),
    });
    expect(res.status).toBe(201);
    const tag = await res.json() as { name: string };
    expect(tag.name).toBe("urgent");
  });

  it("lists all tags", async () => {
    const { token } = await registerUser("tag-list@test.com", "pass");
    await createTag(token, "alpha");
    await createTag(token, "beta");
    const res = await app.request("/tags", { headers: authHeader(token) });
    expect(res.status).toBe(200);
    const tags = await res.json() as { name: string }[];
    expect(tags.length).toBeGreaterThanOrEqual(2);
  });

  it("attaches a tag to a note", async () => {
    const { token } = await registerUser("tag-attach@test.com", "pass");
    const note = await createNote(token, "Tagged Note");
    const tag = await createTag(token, "mytag");

    const res = await app.request(`/notes/${note.id}/tags/${tag.id}`, {
      method: "POST",
      headers: authHeader(token),
    });
    expect(res.status).toBe(200);

    const noteRes = await app.request(`/notes/${note.id}`, { headers: authHeader(token) });
    const fetched = await noteRes.json() as { tags: { name: string }[] };
    expect(fetched.tags.some((t) => t.name === "mytag")).toBe(true);
  });

  it("detaches a tag from a note", async () => {
    const { token } = await registerUser("tag-detach@test.com", "pass");
    const note = await createNote(token, "Note With Tag");
    const tag = await createTag(token, "removeme");

    await app.request(`/notes/${note.id}/tags/${tag.id}`, {
      method: "POST",
      headers: authHeader(token),
    });

    const delRes = await app.request(`/notes/${note.id}/tags/${tag.id}`, {
      method: "DELETE",
      headers: authHeader(token),
    });
    expect(delRes.status).toBe(200);

    const noteRes = await app.request(`/notes/${note.id}`, { headers: authHeader(token) });
    const fetched = await noteRes.json() as { tags: { name: string }[] };
    expect(fetched.tags.some((t) => t.name === "removeme")).toBe(false);
  });

  it("ignores duplicate tag attach (idempotent)", async () => {
    const { token } = await registerUser("tag-idem@test.com", "pass");
    const note = await createNote(token, "Idem Note");
    const tag = await createTag(token, "idemtag");

    await app.request(`/notes/${note.id}/tags/${tag.id}`, {
      method: "POST",
      headers: authHeader(token),
    });
    const res = await app.request(`/notes/${note.id}/tags/${tag.id}`, {
      method: "POST",
      headers: authHeader(token),
    });
    expect(res.status).toBe(200);
  });
});
