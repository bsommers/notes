#!/usr/bin/env node
import { Command } from "commander";
import { execSync, spawnSync } from "child_process";
import { mkdtempSync, writeFileSync, readFileSync, unlinkSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { marked } from "marked";
import { markedTerminal } from "marked-terminal";
import { api, type Note, type Folder } from "./api.js";

// @ts-ignore — marked-terminal types mismatch
marked.use(markedTerminal());

const program = new Command();
program
  .name("notes")
  .description("A CLI for managing notes")
  .version("0.0.0");

// ── notes new ───────────────────────────────────────────────────────────────
program
  .command("new [title]")
  .description("Create a new note")
  .option("--content <text>", "Note content (markdown)")
  .option("--folder <id>", "Folder ID")
  .action(async (title: string | undefined, opts: { content?: string; folder?: string }) => {
    let content = opts.content ?? "";
    const noteTitle = title ?? "Untitled";

    if (!opts.content) {
      content = openInEditor("");
    }

    const note = await api.notes.create({
      title: noteTitle,
      content,
      folderId: opts.folder ? Number(opts.folder) : undefined,
    });
    console.log(`Created note #${note.id}: ${note.title}`);
  });

// ── notes list ──────────────────────────────────────────────────────────────
program
  .command("list")
  .description("List notes")
  .option("--folder <id>", "Filter by folder ID")
  .option("--tag <name>", "Filter by tag name")
  .action(async (opts: { folder?: string; tag?: string }) => {
    const notes = await api.notes.list({
      folder: opts.folder ? Number(opts.folder) : undefined,
      tag: opts.tag,
    });
    if (!notes.length) {
      console.log("No notes found.");
      return;
    }
    for (const n of notes) {
      const tagStr = n.tags.length ? `  [${n.tags.map((t) => t.name).join(", ")}]` : "";
      console.log(`#${n.id}  ${n.title}${tagStr}  (${n.updatedAt})`);
    }
  });

// ── notes view ──────────────────────────────────────────────────────────────
program
  .command("view <id>")
  .description("View a note (rendered markdown)")
  .action(async (id: string) => {
    const note = await api.notes.get(Number(id));
    console.log(`\n# ${note.title}\n`);
    console.log(marked(note.content));
  });

// ── notes edit ──────────────────────────────────────────────────────────────
program
  .command("edit <id>")
  .description("Edit a note in $EDITOR")
  .action(async (id: string) => {
    const note = await api.notes.get(Number(id));
    const newContent = openInEditor(note.content);
    const updated = await api.notes.update(Number(id), { content: newContent });
    console.log(`Updated note #${updated.id}`);
  });

// ── notes delete ─────────────────────────────────────────────────────────────
program
  .command("delete <id>")
  .description("Delete a note")
  .action(async (id: string) => {
    await api.notes.delete(Number(id));
    console.log(`Deleted note #${id}`);
  });

// ── notes clone ──────────────────────────────────────────────────────────────
program
  .command("clone <id>")
  .description("Clone a note (creates a copy)")
  .action(async (id: string) => {
    const note = await api.notes.clone(Number(id));
    console.log(`Cloned note #${note.id}: ${note.title}`);
  });

// ── notes search ─────────────────────────────────────────────────────────────
program
  .command("search <query>")
  .description("Full-text search notes")
  .action(async (query: string) => {
    const notes = await api.notes.list({ q: query });
    if (!notes.length) {
      console.log("No results.");
      return;
    }
    for (const n of notes) {
      console.log(`#${n.id}  ${n.title}`);
    }
  });

// ── folders ──────────────────────────────────────────────────────────────────
const foldersCmd = program.command("folders").description("Manage folders");

foldersCmd
  .command("list")
  .description("List all folders")
  .action(async () => {
    const folders = await api.folders.list();
    if (!folders.length) {
      console.log("No folders.");
      return;
    }
    const byId = Object.fromEntries(folders.map((f) => [f.id, f]));
    const indent = (f: Folder): string => {
      if (!f.parentId) return f.name;
      return `  ${indent(byId[f.parentId]!)} / ${f.name}`;
    };
    for (const f of folders) {
      console.log(`#${f.id}  ${indent(f)}`);
    }
  });

foldersCmd
  .command("new <name>")
  .description("Create a folder")
  .option("--parent <id>", "Parent folder ID")
  .action(async (name: string, opts: { parent?: string }) => {
    const folder = await api.folders.create({
      name,
      parentId: opts.parent ? Number(opts.parent) : undefined,
    });
    console.log(`Created folder #${folder.id}: ${folder.name}`);
  });

foldersCmd
  .command("delete <id>")
  .description("Delete a folder")
  .action(async (id: string) => {
    await api.folders.delete(Number(id));
    console.log(`Deleted folder #${id}`);
  });

// ── tags ─────────────────────────────────────────────────────────────────────
const tagsCmd = program.command("tags").description("Manage tags");

tagsCmd
  .command("list")
  .description("List all tags")
  .action(async () => {
    const tags = await api.tags.list();
    if (!tags.length) {
      console.log("No tags.");
      return;
    }
    for (const t of tags) {
      console.log(`#${t.id}  ${t.name}`);
    }
  });

tagsCmd
  .command("new <name>")
  .description("Create a tag")
  .action(async (name: string) => {
    const tag = await api.tags.create(name);
    console.log(`Tag: #${tag?.id}  ${tag?.name}`);
  });

tagsCmd
  .command("add <noteId> <tagName>")
  .description("Attach a tag to a note")
  .action(async (noteId: string, tagName: string) => {
    const tag = await api.tags.create(tagName);
    if (!tag) throw new Error("Could not create/find tag");
    await api.tags.attach(Number(noteId), tag.id);
    console.log(`Attached tag "${tagName}" to note #${noteId}`);
  });

tagsCmd
  .command("remove <noteId> <tagName>")
  .description("Detach a tag from a note")
  .action(async (noteId: string, tagName: string) => {
    const tags = await api.tags.list();
    const tag = tags.find((t) => t.name === tagName);
    if (!tag) {
      console.error(`Tag "${tagName}" not found`);
      process.exit(1);
    }
    await api.tags.detach(Number(noteId), tag.id);
    console.log(`Removed tag "${tagName}" from note #${noteId}`);
  });

program.parseAsync(process.argv).catch((err) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
});

// ── Helpers ──────────────────────────────────────────────────────────────────
function openInEditor(initialContent: string): string {
  const editor = process.env.EDITOR ?? "nano";
  const dir = mkdtempSync(join(tmpdir(), "notes-"));
  const file = join(dir, "note.md");
  writeFileSync(file, initialContent);
  spawnSync(editor, [file], { stdio: "inherit" });
  const result = readFileSync(file, "utf8");
  unlinkSync(file);
  return result;
}
