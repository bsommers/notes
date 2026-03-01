# Notes App

A self-hosted, full-stack notes application with markdown support, full-text search, folders, tags, and multi-user authentication.

## Features

- **Markdown notes** with live preview, formatting toolbar, and syntax highlighting
- **Folders** — organize notes in nested hierarchies
- **Tags** — label and filter notes
- **Full-text search** — powered by SQLite FTS5
- **Clone notes** — duplicate any note you can read
- **Import** — paste text/markdown or upload `.md`, `.txt`, `.docx`, `.pdf` files
- **Export** — download notes as `.md`, `.txt`, `.pdf`, `.docx`, or `.json`
- **Bulk export** — JSON backup of all your notes
- **Multi-user auth** — JWT-based sessions with three roles: `standard`, `team`, `admin`
- **CLI** — full-featured command-line interface

## Quick Start

```bash
# 1. Install dependencies
npm install -g pnpm
pnpm install

# 2. Start the API server
cd packages/api && node_modules/.bin/tsx src/index.ts

# 3. Start the web app (new terminal)
cd packages/web && pnpm dev
```

Open http://localhost:5173 and register an account.

## CLI Usage

```bash
cd packages/cli
node_modules/.bin/tsx src/index.ts --help
```

See [docs/cli.md](cli.md) for all commands.

## Docker

```bash
docker compose up
```

See [docs/deployment.md](deployment.md) for details.

## Documentation

- [Architecture](architecture.md) — monorepo layout, data flow, auth model
- [API Reference](api.md) — all HTTP endpoints
- [CLI Reference](cli.md) — command-line usage
- [Development Guide](development.md) — setup, env vars, known issues
- [Deployment Guide](deployment.md) — Docker, production config
