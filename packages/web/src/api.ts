import { getToken } from "./auth";

const BASE = "/api";

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const token = getToken();
  const res = await fetch(`${BASE}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options?.headers,
    },
    ...options,
  });
  if (!res.ok) {
    if (res.status === 401) {
      // Let auth context handle redirect
      window.dispatchEvent(new Event("auth:expired"));
    }
    const text = await res.text();
    throw new Error(`API error ${res.status}: ${text}`);
  }
  return res.json() as Promise<T>;
}

export interface Note {
  id: number;
  title: string;
  content: string;
  folderId: number | null;
  ownerId: number;
  teamId: number | null;
  createdAt: string;
  updatedAt: string;
  tags: Tag[];
}

export interface Folder {
  id: number;
  name: string;
  parentId: number | null;
  ownerId: number;
  teamId: number | null;
  createdAt: string;
}

export interface Tag {
  id: number;
  name: string;
}

export interface AuthResponse {
  token: string;
  expiresIn: string;
  user: {
    id: number;
    email: string;
    role: string;
    teamId: number | null;
    createdAt: string;
  };
}

export const api = {
  auth: {
    register: (data: { email: string; password: string; role?: string; teamName?: string }) =>
      request<AuthResponse>("/auth/register", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    login: (data: { email: string; password: string }) =>
      request<AuthResponse>("/auth/login", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    me: () => request<{ userId: number; email: string; role: string; teamId: number | null }>("/auth/me"),
  },
  notes: {
    list: (params?: { folder?: number; tag?: string; q?: string }) => {
      const qs = new URLSearchParams();
      if (params?.folder != null) qs.set("folder", String(params.folder));
      if (params?.tag) qs.set("tag", params.tag);
      if (params?.q) qs.set("q", params.q);
      const query = qs.toString() ? `?${qs}` : "";
      return request<Note[]>(`/notes${query}`);
    },
    get: (id: number) => request<Note>(`/notes/${id}`),
    create: (data: { title: string; content?: string; folderId?: number; shareWithTeam?: boolean }) =>
      request<Note>("/notes", { method: "POST", body: JSON.stringify(data) }),
    update: (id: number, data: { title?: string; content?: string; folderId?: number | null; shareWithTeam?: boolean }) =>
      request<Note>(`/notes/${id}`, { method: "PUT", body: JSON.stringify(data) }),
    delete: (id: number) =>
      request<{ success: boolean }>(`/notes/${id}`, { method: "DELETE" }),
    clone: (id: number) =>
      request<Note>(`/notes/${id}/clone`, { method: "POST" }),
    attachTag: (noteId: number, tagId: number) =>
      request<{ success: boolean }>(`/notes/${noteId}/tags/${tagId}`, { method: "POST" }),
    detachTag: (noteId: number, tagId: number) =>
      request<{ success: boolean }>(`/notes/${noteId}/tags/${tagId}`, { method: "DELETE" }),
  },
  folders: {
    list: () => request<Folder[]>("/folders"),
    create: (data: { name: string; parentId?: number; shareWithTeam?: boolean }) =>
      request<Folder>("/folders", { method: "POST", body: JSON.stringify(data) }),
    delete: (id: number) =>
      request<{ success: boolean }>(`/folders/${id}`, { method: "DELETE" }),
  },
  tags: {
    list: () => request<Tag[]>("/tags"),
    create: (name: string) =>
      request<Tag>("/tags", { method: "POST", body: JSON.stringify({ name }) }),
  },
};
