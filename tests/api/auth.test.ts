import { describe, it, expect } from "vitest";
import { app, registerUser, authHeader } from "../helpers/api.js";

describe("POST /auth/register", () => {
  it("registers a new user", async () => {
    const res = await app.request("/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "user@test.com", password: "pass123" }),
    });
    expect(res.status).toBe(201);
    const body = await res.json() as { token: string; user: { email: string; role: string } };
    expect(body.token).toBeTruthy();
    expect(body.user.email).toBe("user@test.com");
    expect(body.user.role).toBe("standard");
  });

  it("rejects duplicate email", async () => {
    await registerUser("dup@test.com", "pass");
    const res = await app.request("/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "dup@test.com", password: "pass2" }),
    });
    expect(res.status).toBe(409);
  });

  it("rejects missing fields", async () => {
    const res = await app.request("/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "no-pass@test.com" }),
    });
    expect(res.status).toBe(400);
  });
});

describe("POST /auth/login", () => {
  it("logs in with correct credentials", async () => {
    await registerUser("login@test.com", "mypassword");
    const res = await app.request("/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "login@test.com", password: "mypassword" }),
    });
    expect(res.status).toBe(200);
    const body = await res.json() as { token: string };
    expect(body.token).toBeTruthy();
  });

  it("rejects wrong password", async () => {
    await registerUser("wp@test.com", "correct");
    const res = await app.request("/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "wp@test.com", password: "wrong" }),
    });
    expect(res.status).toBe(401);
  });

  it("rejects unknown email", async () => {
    const res = await app.request("/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "ghost@test.com", password: "x" }),
    });
    expect(res.status).toBe(401);
  });
});

describe("GET /auth/me", () => {
  it("returns user info with valid token", async () => {
    const { token, email } = await registerUser("me@test.com", "pass");
    const res = await app.request("/auth/me", {
      headers: authHeader(token),
    });
    expect(res.status).toBe(200);
    const body = await res.json() as { email: string };
    expect(body.email).toBe(email);
  });

  it("rejects without token", async () => {
    const res = await app.request("/auth/me");
    expect(res.status).toBe(401);
  });
});
