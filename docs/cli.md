# CLI Reference

The CLI (`@notes/cli`) talks to the running API server over HTTP.

## Setup

```bash
cd packages/cli
# Run directly with tsx (dev):
node_modules/.bin/tsx src/index.ts <command>

# Or build and run:
pnpm build && node dist/index.js <command>
```

Set the API URL (default: `http://localhost:3001`):
```bash
export NOTES_API_URL=http://localhost:3001
```

> **Note:** The CLI currently uses a hardcoded dev token. Full auth (login command + token storage) is planned for a future release.

---

## Notes Commands

### `notes new [title]`
Create a new note. Opens `$EDITOR` for content if `--content` is not provided.

```bash
notes new "Meeting Notes"
notes new "TODO" --content "- Buy milk\n- Call dentist"
notes new "Work Note" --folder 2
```

**Options:**
- `--content <text>` — note content (markdown)
- `--folder <id>` — place in folder

---

### `notes list`
List all your notes.

```bash
notes list
notes list --folder 2
notes list --tag work
```

**Options:**
- `--folder <id>` — filter by folder ID
- `--tag <name>` — filter by tag name

**Output:**
```
#1  Meeting Notes  [work, q1]  (2024-01-15 10:30:00)
#2  TODO  [personal]  (2024-01-14 09:00:00)
```

---

### `notes view <id>`
View a note with rendered markdown (terminal rendering via `marked-terminal`).

```bash
notes view 1
```

---

### `notes edit <id>`
Open a note in `$EDITOR` and save changes on exit.

```bash
notes edit 1
EDITOR=vim notes edit 1
```

---

### `notes clone <id>`
Clone a note. Creates a copy with "Copy of " prepended to the title.

```bash
notes clone 1
# Output: Cloned note #5: Copy of Meeting Notes
```

---

### `notes delete <id>`
Delete a note.

```bash
notes delete 1
```

---

### `notes search <query>`
Full-text search across your notes.

```bash
notes search "meeting agenda"
notes search "TODO"
```

**Output:**
```
#3  Q1 Planning Meeting
#7  Team Meeting Notes
```

---

## Folder Commands

### `folders list`
List all folders with hierarchy.

```bash
notes folders list
# Output:
# #1  Work
# #2    Work / Projects
# #3  Personal
```

---

### `folders new <name>`
Create a folder.

```bash
notes folders new "Work"
notes folders new "Projects" --parent 1
```

**Options:**
- `--parent <id>` — parent folder ID

---

### `folders delete <id>`
Delete a folder.

```bash
notes folders delete 2
```

---

## Tag Commands

### `tags list`
List all tags.

```bash
notes tags list
# Output:
# #1  work
# #2  personal
# #3  urgent
```

---

### `tags new <name>`
Create a tag.

```bash
notes tags new "urgent"
```

---

### `tags add <noteId> <tagName>`
Attach a tag to a note (creates the tag if it doesn't exist).

```bash
notes tags add 1 work
notes tags add 3 urgent
```

---

### `tags remove <noteId> <tagName>`
Detach a tag from a note.

```bash
notes tags remove 1 work
```
