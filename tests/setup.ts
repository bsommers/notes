import { beforeEach } from "vitest";
import { resetDb } from "@notes/db";

beforeEach(() => {
  process.env.NOTES_DB_PATH = ":memory:";
  process.env.NODE_ENV = "test";
  process.env.JWT_SECRET = "test-secret";
  resetDb();
});
