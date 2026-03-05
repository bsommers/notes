import { serve } from "@hono/node-server";
import { serveStatic } from "@hono/node-server/serve-static";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { notesRouter } from "./routes/notes.js";
import { foldersRouter } from "./routes/folders.js";
import { tagsRouter } from "./routes/tags.js";
import { importExportRouter } from "./routes/importExport.js";
import { authRouter } from "./routes/authRoutes.js";

export const app = new Hono();

const isProd = process.env.NODE_ENV === "production";
const prefix = isProd ? "/api" : "";

app.use(
  "*",
  cors({
    origin: ["http://localhost:5173", "http://localhost:4173"],
    allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowHeaders: ["Content-Type", "Authorization"],
  })
);

app.get("/health", (c) => c.json({ status: "ok" }));
if (prefix) app.get(`${prefix}/health`, (c) => c.json({ status: "ok" }));
app.route(`${prefix}/auth`, authRouter);
app.route(`${prefix}/notes`, notesRouter);
app.route(`${prefix}/folders`, foldersRouter);
app.route(`${prefix}/tags`, tagsRouter);
app.route(prefix || "/", importExportRouter);

if (isProd) {
  app.use("/*", serveStatic({ root: "./packages/api/public" }));
}

if (process.env.NODE_ENV !== "test") {
  const PORT = Number(process.env.PORT ?? 3001);
  serve({ fetch: app.fetch, port: PORT }, () => {
    console.log(`Notes API running on http://localhost:${PORT}`);
  });
}
