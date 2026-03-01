# Development Guide

## Prerequisites

- **Node.js** 20+ (LTS)
- **pnpm** (`npm install -g pnpm`)
- **SQLite** — bundled via `better-sqlite3` (compiled natively on install)

## Install

```bash
git clone <repo-url>
cd notes
pnpm install
```

If `better-sqlite3` fails to build, ensure you have build tools installed:
```bash
# Ubuntu/Debian
sudo apt install build-essential python3

# macOS
xcode-select --install
```

## Running in Development

### API Server (port 3001)

```bash
cd packages/api
node_modules/.bin/tsx src/index.ts
```

Or using the monorepo script:
```bash
pnpm dev:api
```

The database file is created at `notes.db` in the monorepo root.

### Web App (port 5173)

```bash
cd packages/web
pnpm dev
```

Or using the monorepo script:
```bash
pnpm dev:web
```

**Note on inotify limits:** If Vite fails with `ENOSPC: System limit for number of file watchers reached`, add `server.watch.usePolling: true` to `vite.config.ts` or run:
```bash
echo fs.inotify.max_user_watches=524288 | sudo tee -a /etc/sysctl.conf && sudo sysctl -p
```

### CLI

```bash
cd packages/cli
node_modules/.bin/tsx src/index.ts list
```

## Environment Variables

### API (`packages/api`)

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3001` | HTTP port to listen on |
| `JWT_SECRET` | `notes-dev-secret-change-in-prod` | Secret for signing JWTs (change in production!) |
| `NOTES_DB_PATH` | `<root>/notes.db` | Path to SQLite database file. Use `:memory:` for in-memory (tests) |
| `NODE_ENV` | `development` | Set to `production` to enable `/api` prefix and static file serving |

### CLI (`packages/cli`)

| Variable | Default | Description |
|----------|---------|-------------|
| `NOTES_API_URL` | `http://localhost:3001` | Base URL for API calls |
| `EDITOR` | `nano` | Editor used by `notes edit` and `notes new` |

## Testing

```bash
# Run all tests
pnpm test

# Watch mode
pnpm test:watch

# Coverage report
pnpm test:coverage
```

Tests use in-memory SQLite (`NOTES_DB_PATH=:memory:`) — no database file is created.

## Type Checking

```bash
pnpm typecheck    # runs tsc --noEmit in all packages
```

## Building

```bash
pnpm build        # builds all packages
```

This compiles TypeScript in `db/` and `api/` to `dist/`, and runs `vite build` for the web app.

## Known Issues

### EMFILE (too many open files)
Running `tsx --watch` on this system hits the inotify file descriptor limit. Use plain `tsx src/index.ts` without watch mode.

### Vite polling
If `inotify max_user_instances=128` is too low, Vite file watching fails. Set `server.watch.usePolling: true` in `vite.config.ts`.

### better-sqlite3 rebuild
If you switch Node.js versions, you may need to rebuild the native module:
```bash
pnpm -w exec npm rebuild better-sqlite3
```

## Project Structure

```
packages/
  db/src/
    index.ts    — getDb(), getSqlite(), resetDb(), schema export
    schema.ts   — Drizzle table definitions
    migrate.ts  — Raw SQL migration runner

  api/src/
    index.ts    — App factory + server startup
    auth.ts     — JWT sign/verify, requireAuth middleware
    routes/
      authRoutes.ts   — /auth endpoints
      notes.ts        — /notes endpoints
      folders.ts      — /folders endpoints
      tags.ts         — /tags endpoints
      importExport.ts — /import and /export endpoints

  cli/src/
    index.ts    — Commander.js program
    api.ts      — API client

  web/src/
    main.tsx       — App entry point
    router.tsx     — Route definitions
    auth.ts        — Token storage helpers
    api.ts         — API client (with auth headers)
    prose.css      — Markdown prose styles
    components/
      NoteList.tsx    — Note list with clone/delete/edit actions
      NoteViewer.tsx  — Read-only note view with markdown rendering
      NoteEditor.tsx  — Create/edit note with toolbar
      ExportButton.tsx — Export dropdown
      Sidebar.tsx      — Folder/tag navigation
```
