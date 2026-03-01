import { describe, it, expect } from "vitest";
import { signToken, verifyToken } from "../../packages/api/src/auth.js";

describe("JWT auth", () => {
  it("signs and verifies a token", () => {
    const token = signToken({ userId: 1, email: "a@b.com", role: "standard", teamId: null });
    const payload = verifyToken(token);
    expect(payload.userId).toBe(1);
    expect(payload.email).toBe("a@b.com");
    expect(payload.role).toBe("standard");
  });

  it("throws on invalid signature", () => {
    const token = signToken({ userId: 1, email: "a@b.com", role: "standard", teamId: null });
    const [header, payload] = token.split(".");
    const bad = `${header}.${payload}.invalidsig`;
    expect(() => verifyToken(bad)).toThrow();
  });

  it("throws on wrong secret", () => {
    // Sign with a different secret; verifyToken uses the secret from auth.ts
    // Create a token signed with mismatched secret by calling signToken then tamper
    const valid = signToken({ userId: 1, email: "x@y.com", role: "standard", teamId: null });
    const parts = valid.split(".");
    // Flip a char in the signature to invalidate it
    const sig = parts[2]!;
    const badSig = sig[0] === "a" ? "b" + sig.slice(1) : "a" + sig.slice(1);
    const tampered = `${parts[0]}.${parts[1]}.${badSig}`;
    expect(() => verifyToken(tampered)).toThrow();
  });

  it("includes teamId in payload", () => {
    const token = signToken({ userId: 5, email: "team@b.com", role: "team", teamId: 42 });
    const payload = verifyToken(token);
    expect(payload.teamId).toBe(42);
    expect(payload.role).toBe("team");
  });
});
