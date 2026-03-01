# Deployment Guide

## Docker (recommended)

The app ships as a single Docker container:
- Hono serves the API on port 3001
- Built web assets are served as static files from `/public`
- API routes are prefixed with `/api` in production
- Data persists in a mounted volume

### Quick Start

```bash
# Build and run
docker compose up

# Or build the image manually
docker build -t notes .
docker run -p 3001:3001 -v $(pwd)/data:/data \
  -e JWT_SECRET=your-secret-here \
  notes
```

Access the app at http://localhost:3001

### docker-compose.yml

```yaml
services:
  notes:
    build: .
    ports: ["3001:3001"]
    volumes: ["./data:/data"]
    environment:
      JWT_SECRET: ${JWT_SECRET:-change-me}
      NODE_ENV: production
      NOTES_DB_PATH: /data/notes.db
    restart: unless-stopped
```

### Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `JWT_SECRET` | **Yes** | Secret for signing JWTs. Use a long random string in production. |
| `NOTES_DB_PATH` | No | SQLite file path. Default: `notes.db` next to the binary. Set to `/data/notes.db` to use the mounted volume. |
| `PORT` | No | Port to listen on (default: 3001). |
| `NODE_ENV` | No | Set to `production` to enable `/api` prefix and static file serving. |

### Generating a JWT Secret

```bash
openssl rand -base64 32
```

### Database Backups

The database is a single SQLite file. Back it up by copying it:

```bash
# Manual backup
docker exec <container> cp /data/notes.db /data/notes.db.bak

# With cron (host-side)
cp ./data/notes.db ./backups/notes-$(date +%Y%m%d).db
```

Or use the built-in bulk export via the web app (Settings → Export JSON).

---

## Manual Production Deployment

If not using Docker, deploy on any Node.js 20+ server:

```bash
# Build
pnpm install
pnpm build

# The web app builds to packages/web/dist/
# Copy web/dist → packages/api/public/
cp -r packages/web/dist packages/api/public

# Run
NODE_ENV=production \
JWT_SECRET=your-secret \
NOTES_DB_PATH=/var/lib/notes/notes.db \
node packages/api/dist/index.js
```

Or use a process manager:

```ini
# pm2 ecosystem.config.cjs
module.exports = {
  apps: [{
    name: "notes",
    script: "packages/api/dist/index.js",
    env: {
      NODE_ENV: "production",
      JWT_SECRET: "your-secret",
      NOTES_DB_PATH: "/var/lib/notes/notes.db",
      PORT: 3001
    }
  }]
};
```

```bash
pm2 start ecosystem.config.cjs
pm2 save
pm2 startup
```

---

## Reverse Proxy (nginx)

To serve behind nginx with HTTPS:

```nginx
server {
    listen 443 ssl;
    server_name notes.example.com;

    ssl_certificate /etc/letsencrypt/live/notes.example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/notes.example.com/privkey.pem;

    location / {
        proxy_pass http://localhost:3001;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

---

## Production Considerations

- **Change `JWT_SECRET`** — the default is insecure. Use a long random string.
- **Backup the database** — SQLite is a single file; back it up regularly.
- **HTTPS** — use a reverse proxy (nginx, Caddy) with TLS in production.
- **File uploads** — large PDF/DOCX imports are held in memory during processing; set appropriate memory limits.
- **Concurrent writes** — SQLite handles moderate concurrent write loads well with WAL mode (enabled by better-sqlite3 by default for `:memory:` databases; for file DBs, enable it with `PRAGMA journal_mode=WAL`).
