import { describe, it, expect } from "vitest";
import { app, registerUser, authHeader } from "../helpers/api.js";

describe("Folders CRUD", () => {
  it("creates a folder", async () => {
    const { token } = await registerUser("folder-create@test.com", "pass");
    const res = await app.request("/folders", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeader(token) },
      body: JSON.stringify({ name: "Work" }),
    });
    expect(res.status).toBe(201);
    const folder = await res.json() as { id: number; name: string };
    expect(folder.name).toBe("Work");
    expect(typeof folder.id).toBe("number");
  });

  it("lists folders for authenticated user", async () => {
    const { token } = await registerUser("folder-list@test.com", "pass");
    await app.request("/folders", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeader(token) },
      body: JSON.stringify({ name: "Folder A" }),
    });
    await app.request("/folders", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeader(token) },
      body: JSON.stringify({ name: "Folder B" }),
    });
    const res = await app.request("/folders", { headers: authHeader(token) });
    expect(res.status).toBe(200);
    const folders = await res.json() as { name: string }[];
    expect(folders.length).toBe(2);
  });

  it("creates nested folder with parentId", async () => {
    const { token } = await registerUser("folder-nest@test.com", "pass");
    const parentRes = await app.request("/folders", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeader(token) },
      body: JSON.stringify({ name: "Parent" }),
    });
    const parent = await parentRes.json() as { id: number };

    const childRes = await app.request("/folders", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeader(token) },
      body: JSON.stringify({ name: "Child", parentId: parent.id }),
    });
    const child = await childRes.json() as { parentId: number | null };
    expect(child.parentId).toBe(parent.id);
  });

  it("deletes a folder", async () => {
    const { token } = await registerUser("folder-delete@test.com", "pass");
    const res = await app.request("/folders", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeader(token) },
      body: JSON.stringify({ name: "ToDelete" }),
    });
    const folder = await res.json() as { id: number };

    const delRes = await app.request(`/folders/${folder.id}`, {
      method: "DELETE",
      headers: authHeader(token),
    });
    expect(delRes.status).toBe(200);

    const list = await app.request("/folders", { headers: authHeader(token) });
    const folders = await list.json() as { id: number }[];
    expect(folders.find((f) => f.id === folder.id)).toBeUndefined();
  });

  it("cannot delete another user's folder", async () => {
    const alice = await registerUser("alice-folder@test.com", "pass");
    const bob = await registerUser("bob-folder@test.com", "pass");

    const res = await app.request("/folders", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeader(alice.token) },
      body: JSON.stringify({ name: "Alice's Folder" }),
    });
    const folder = await res.json() as { id: number };

    const delRes = await app.request(`/folders/${folder.id}`, {
      method: "DELETE",
      headers: authHeader(bob.token),
    });
    expect(delRes.status).toBe(403);
  });
});
