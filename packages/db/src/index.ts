import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import * as schema from "./schema.js";
import { runMigrations } from "./migrate.js";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

let _db: ReturnType<typeof drizzle<typeof schema>> | null = null;
let _sqlite: Database.Database | null = null;

export function getDb() {
  if (!_db) {
    const dbPath =
      process.env.NOTES_DB_PATH ??
      path.join(__dirname, "..", "..", "..", "notes.db");
    _sqlite = new Database(dbPath);
    runMigrations(_sqlite);
    _db = drizzle(_sqlite, { schema });
  }
  return _db;
}

export function getSqlite(): Database.Database {
  if (!_sqlite) getDb();
  return _sqlite!;
}

export function resetDb(): void {
  _sqlite?.close();
  _sqlite = null;
  _db = null;
}

export { schema };
