import { useState } from "react";
import {
  createRouter,
  createRootRoute,
  createRoute,
  redirect,
  Outlet,
  useNavigate,
} from "@tanstack/react-router";
import { Box, Flex } from "@chakra-ui/react";
import { Sidebar } from "./components/Sidebar";
import { NoteList } from "./components/NoteList";
import { NoteViewer } from "./components/NoteViewer";
import { NoteEditor } from "./components/NoteEditor";
import { AuthForm } from "./components/AuthForm";
import { isAuthenticated, clearToken } from "./auth";

// ── Root layout ──────────────────────────────────────────────────────────────
const rootRoute = createRootRoute({
  component: RootComponent,
});

function RootComponent() {
  return <Outlet />;
}

// ── /login ───────────────────────────────────────────────────────────────────
const loginRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/login",
  component: LoginPage,
});

function LoginPage() {
  const [mode, setMode] = useState<"login" | "register">("login");
  const navigate = useNavigate();
  return (
    <AuthForm
      mode={mode}
      onSuccess={() => navigate({ to: "/notes" })}
      onSwitch={() => setMode((m) => (m === "login" ? "register" : "login"))}
    />
  );
}

// ── Auth-guarded layout ───────────────────────────────────────────────────────
const appRoute = createRoute({
  getParentRoute: () => rootRoute,
  id: "app",
  beforeLoad: () => {
    if (!isAuthenticated()) {
      throw redirect({ to: "/login" });
    }
  },
  component: AppLayout,
});

function AppLayout() {
  return (
    <Flex h="100vh" overflow="hidden">
      <Box w="280px" flexShrink={0} borderRightWidth="1px" overflowY="auto">
        <Sidebar />
      </Box>
      <Box flex={1} overflowY="auto">
        <Outlet />
      </Box>
    </Flex>
  );
}

// ── / → redirect to /notes ───────────────────────────────────────────────────
const indexRoute = createRoute({
  getParentRoute: () => appRoute,
  path: "/",
  beforeLoad: () => {
    throw redirect({ to: "/notes" });
  },
});

// ── /notes ───────────────────────────────────────────────────────────────────
interface NotesSearch {
  folder?: number;
  tag?: string;
  q?: string;
}

const notesRoute = createRoute({
  getParentRoute: () => appRoute,
  path: "/notes",
  validateSearch: (search: Record<string, unknown>): NotesSearch => ({
    folder: search.folder ? Number(search.folder) : undefined,
    tag: typeof search.tag === "string" ? search.tag : undefined,
    q: typeof search.q === "string" ? search.q : undefined,
  }),
  component: () => {
    const { folder, tag, q } = notesRoute.useSearch();
    return <NoteList folder={folder} tag={tag} q={q} />;
  },
});

// ── /notes/new ───────────────────────────────────────────────────────────────
const notesNewRoute = createRoute({
  getParentRoute: () => appRoute,
  path: "/notes/new",
  component: () => {
    const navigate = notesNewRoute.useNavigate();
    return <NoteEditor onSave={() => navigate({ to: "/notes" })} />;
  },
});

// ── /notes/$noteId ───────────────────────────────────────────────────────────
const noteViewRoute = createRoute({
  getParentRoute: () => appRoute,
  path: "/notes/$noteId",
  component: () => {
    const { noteId } = noteViewRoute.useParams();
    return <NoteViewer noteId={Number(noteId)} />;
  },
});

// ── /notes/$noteId/edit ──────────────────────────────────────────────────────
const noteEditRoute = createRoute({
  getParentRoute: () => appRoute,
  path: "/notes/$noteId/edit",
  component: () => {
    const { noteId } = noteEditRoute.useParams();
    const navigate = noteEditRoute.useNavigate();
    return (
      <NoteEditor
        noteId={Number(noteId)}
        onSave={() => navigate({ to: "/notes/$noteId", params: { noteId } })}
      />
    );
  },
});

// ── Route tree ───────────────────────────────────────────────────────────────
const routeTree = rootRoute.addChildren([
  loginRoute,
  appRoute.addChildren([
    indexRoute,
    notesRoute,
    notesNewRoute,
    noteViewRoute,
    noteEditRoute,
  ]),
]);

export const router = createRouter({ routeTree });

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}
