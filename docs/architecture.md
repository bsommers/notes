# Architecture

## Monorepo Layout

```
notes/
├── packages/
│   ├── db/      — Database layer (Drizzle ORM + better-sqlite3)
│   ├── api/     — REST API (Hono on Node.js)
│   ├── cli/     — Command-line interface (Commander.js)
│   └── web/     — Frontend (Vite + React + TanStack Router)
├── tests/       — Test suite (Vitest)
├── docs/        — Documentation
├── Dockerfile
└── docker-compose.yml
```

## Package Responsibilities

### `@notes/db`
- Schema definitions (`schema.ts`) using Drizzle ORM
- Raw SQL migrations (`migrate.ts`) — no drizzle-kit; migrations run automatically on startup
- Tables: `teams`, `users`, `folders`, `notes`, `tags`, `note_tags`
- FTS5 virtual table `notes_fts` with triggers for insert/update/delete
- Exports `getDb()`, `getSqlite()`, `resetDb()`, and `schema`

### `@notes/api`
- Hono framework, served by `@hono/node-server` on port 3001
- Routes: `/auth`, `/notes`, `/folders`, `/tags`, `/import`, `/export`
- JWT authentication middleware
- In production: serves built web app from `./public` via `serveStatic`
- In production: all API routes prefixed with `/api`

### `@notes/cli`
- Commander.js CLI calling the API over HTTP
- Commands: `new`, `list`, `view`, `edit`, `clone`, `delete`, `search`, `folders`, `tags`

### `@notes/web`
- Vite + React 19 SPA
- TanStack Router with manual route definitions (not file-based)
- Chakra UI v3 component library
- TanStack Query for server state
- All API calls go through `/api/*` prefix (proxied in dev by Vite)

## Data Flow

```
Browser                   Hono API              SQLite
  │                          │                     │
  │  POST /api/notes         │                     │
  │ ─────────────────────>   │                     │
  │                          │  INSERT INTO notes  │
  │                          │ ──────────────────> │
  │                          │  FTS trigger fires  │
  │                          │ <────────────────── │
  │  201 { id, title, ... }  │                     │
  │ <─────────────────────   │                     │
```

In development, Vite proxies `/api/*` → `http://localhost:3001/*` (without the `/api` prefix). In production, one Docker container serves everything at port 3001.

## Auth Model

Authentication uses JWTs stored in `localStorage` (key: `notes_token`), with a 7-day expiry.

### Roles

| Role | Own notes | Team notes | All notes |
|------|-----------|------------|-----------|
| `standard` | ✓ read/write | ✗ | ✗ |
| `team` | ✓ read/write | ✓ read/write | ✗ |
| `admin` | ✓ read/write | ✓ read/write | ✓ read/write |

Team membership is set at registration by creating/joining a team by name. Notes can be optionally shared with the team (`shareWithTeam: true`).

### JWT Payload

```json
{
  "userId": 1,
  "email": "user@example.com",
  "role": "standard",
  "teamId": null
}
```

### Token Expiry Handling

When any API call returns 401, the web app dispatches an `auth:expired` DOM event which `main.tsx` listens for to redirect to `/login`.

## FTS5 Design

Full-text search uses SQLite's built-in FTS5 extension:

```sql
CREATE VIRTUAL TABLE notes_fts USING fts5(title, content, content=notes, content_rowid=id);
```

Three triggers keep the FTS index in sync with the `notes` table:
- `notes_ai` — AFTER INSERT
- `notes_au` — AFTER UPDATE
- `notes_ad` — AFTER DELETE

Search queries use `MATCH` with FTS5's default BM25 ranking:
```sql
SELECT notes.id FROM notes
JOIN notes_fts ON notes.id = notes_fts.rowid
WHERE notes_fts MATCH ?
ORDER BY rank
```

After getting matching IDs, ownership filtering is applied to respect role-based access.
