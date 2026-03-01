# API Reference

Base URL (development): `http://localhost:3001`
Base URL (production Docker): `http://localhost:3001/api`

All endpoints except `/auth/register` and `/auth/login` require a JWT in the `Authorization` header:
```
Authorization: Bearer <token>
```

## Auth

### `POST /auth/register`
Register a new user.

**Body:**
```json
{
  "email": "user@example.com",
  "password": "mypassword",
  "role": "standard",       // optional: "standard" | "team" | "admin"
  "teamName": "Engineering" // optional: creates or joins team (required for role=team)
}
```

**Response 201:**
```json
{
  "token": "<jwt>",
  "expiresIn": "7d",
  "user": { "id": 1, "email": "user@example.com", "role": "standard", "teamId": null, "createdAt": "..." }
}
```

**Errors:** 400 (missing fields), 409 (email already registered)

---

### `POST /auth/login`
Login with existing credentials.

**Body:** `{ "email": "...", "password": "..." }`
**Response 200:** Same shape as register
**Errors:** 401 (wrong credentials)

---

### `GET /auth/me`
Get the currently authenticated user.

**Response 200:**
```json
{ "userId": 1, "email": "user@example.com", "role": "standard", "teamId": null }
```

---

### `GET /auth/users` _(admin only)_
List all registered users.

**Response 200:** Array of user objects.

---

### `PUT /auth/users/:id/role` _(admin only)_
Change a user's role.

**Body:** `{ "role": "team" | "standard" | "admin" }`

---

## Notes

### `GET /notes`
List accessible notes. Filtered by role (standard: own, team: own+team, admin: all).

**Query params:**
- `folder=<id>` — filter by folder
- `tag=<name>` — filter by tag name
- `q=<query>` — full-text search (FTS5)

**Response 200:** Array of note objects (with `tags` array).

---

### `POST /notes`
Create a note.

**Body:**
```json
{
  "title": "My Note",
  "content": "# Hello\n\nMarkdown content",
  "folderId": 1,           // optional
  "tags": ["work", "todo"], // optional
  "shareWithTeam": false   // optional
}
```
**Response 201:** Note object.

---

### `GET /notes/:id`
Get a single note.

**Response 200:** Note object with `tags`.
**Errors:** 404 (not found), 403 (access denied)

---

### `PUT /notes/:id`
Update a note. Partial update — only provided fields are changed.

**Body:** `{ "title"?, "content"?, "folderId"?, "shareWithTeam"? }`
**Response 200:** Updated note object.

---

### `DELETE /notes/:id`
Delete a note (owner or admin only).

**Response 200:** `{ "success": true }`

---

### `POST /notes/:id/clone`
Clone a note. The caller becomes owner of the clone. Title is prefixed with "Copy of". Tags are copied. `teamId` is not inherited.

**Response 201:** New note object.

---

### `POST /notes/:id/tags/:tagId`
Attach a tag to a note.

**Response 200:** `{ "success": true }`

---

### `DELETE /notes/:id/tags/:tagId`
Detach a tag from a note.

**Response 200:** `{ "success": true }`

---

## Folders

### `GET /folders`
List accessible folders.

**Response 200:** Array of folder objects.

---

### `POST /folders`
Create a folder.

**Body:** `{ "name": "Work", "parentId"?: 1, "shareWithTeam"?: false }`
**Response 201:** Folder object.

---

### `DELETE /folders/:id`
Delete a folder (owner or admin only).

**Response 200:** `{ "success": true }`

---

## Tags

### `GET /tags`
List all tags.

**Response 200:** `[{ "id": 1, "name": "work" }, ...]`

---

### `POST /tags`
Create a tag (or get existing if name already exists).

**Body:** `{ "name": "urgent" }`
**Response 201:** `{ "id": 1, "name": "urgent" }`

---

## Export

### `GET /notes/:id/export/markdown`
Export note as `.md` file.

**Response 200:** Markdown text with `Content-Disposition: attachment; filename="<title>.md"`

---

### `GET /notes/:id/export/txt`
Export note as `.txt` file (markdown stripped).

---

### `GET /notes/:id/export/pdf`
Export note as `.pdf` file (basic markdown rendering).

---

### `GET /notes/:id/export/docx`
Export note as `.docx` Word document.

---

### `GET /notes/:id/export/json`
Export note as `.json` (full note object with tags).

---

### `GET /export/json`
Bulk export — all accessible notes, folders, and tags as a JSON backup.

---

## Import

### `POST /import/text`
Import a note from a text/JSON body.

**Body:**
```json
{
  "title": "My Note",    // optional — inferred from first line/heading
  "content": "...",
  "folderId": 1,         // optional
  "tags": ["work"]       // optional
}
```
**Response 201:** Created note object.

---

### `POST /import/json`
Restore notes from a bulk backup JSON.

**Body:** `{ "notes": [{ "title", "content", "folderId"?, "tags"? }] }`
**Response 201:** `{ "imported": 5, "ids": [1, 2, 3, 4, 5] }`

---

### `POST /import/file`
Upload a file as a note. Supports `.md`, `.txt`, `.docx`, `.pdf`.

**Form fields:**
- `file` — the file to import
- `title` (optional) — override inferred title
- `folderId` (optional) — folder to place the note in

**Response 201:** Created note object.

---

## Note Object Shape

```json
{
  "id": 1,
  "title": "My Note",
  "content": "# Hello\n\nMarkdown content",
  "folderId": null,
  "ownerId": 1,
  "teamId": null,
  "createdAt": "2024-01-01 12:00:00",
  "updatedAt": "2024-01-01 12:00:00",
  "tags": [{ "id": 1, "name": "work" }]
}
```

## Error Shape

```json
{ "error": "Not found" }
```

Common HTTP status codes: 400 (bad request), 401 (unauthenticated), 403 (forbidden), 404 (not found), 409 (conflict), 500 (server error).
