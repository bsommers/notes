const BASE = process.env.NOTES_API_URL ?? "http://localhost:3001";

async function request<T>(
  path: string,
  options?: RequestInit
): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { "Content-Type": "application/json", ...options?.headers },
    ...options,
  });

  if (!res.ok) {
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
  createdAt: string;
  updatedAt: string;
  tags: Tag[];
}

export interface Folder {
  id: number;
  name: string;
  parentId: number | null;
  createdAt: string;
}

export interface Tag {
  id: number;
  name: string;
}

export const api = {
  notes: {
    list: (params?: { folder?: number; tag?: string; q?: string }) => {
      const qs = new URLSearchParams();
      if (params?.folder) qs.set("folder", String(params.folder));
      if (params?.tag) qs.set("tag", params.tag);
      if (params?.q) qs.set("q", params.q);
      const query = qs.toString() ? `?${qs}` : "";
      return request<Note[]>(`/notes${query}`);
    },
    get: (id: number) => request<Note>(`/notes/${id}`),
    create: (data: { title: string; content?: string; folderId?: number; tags?: string[] }) =>
      request<Note>("/notes", { method: "POST", body: JSON.stringify(data) }),
    update: (id: number, data: { title?: string; content?: string; folderId?: number | null }) =>
      request<Note>(`/notes/${id}`, { method: "PUT", body: JSON.stringify(data) }),
    delete: (id: number) =>
      request<{ success: boolean }>(`/notes/${id}`, { method: "DELETE" }),
    clone: (id: number) =>
      request<Note>(`/notes/${id}/clone`, { method: "POST" }),
  },
  folders: {
    list: () => request<Folder[]>("/folders"),
    create: (data: { name: string; parentId?: number }) =>
      request<Folder>("/folders", { method: "POST", body: JSON.stringify(data) }),
    delete: (id: number) =>
      request<{ success: boolean }>(`/folders/${id}`, { method: "DELETE" }),
  },
  tags: {
    list: () => request<Tag[]>("/tags"),
    create: (name: string) =>
      request<Tag>("/tags", { method: "POST", body: JSON.stringify({ name }) }),
    attach: (noteId: number, tagId: number) =>
      request<{ success: boolean }>(`/notes/${noteId}/tags/${tagId}`, { method: "POST" }),
    detach: (noteId: number, tagId: number) =>
      request<{ success: boolean }>(`/notes/${noteId}/tags/${tagId}`, { method: "DELETE" }),
  },
};
