import { Menu, Button } from "@chakra-ui/react";
import { getToken } from "../auth";

interface Props {
  noteId?: number;
  noteTitle?: string;
}

export function ExportButton({ noteId, noteTitle }: Props) {
  function download(path: string, filename: string) {
    const token = getToken();
    // Use fetch so we can include the auth header, then trigger download
    fetch(path, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
      .then((res) => res.blob())
      .then((blob) => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);
      });
  }

  const slug = noteTitle
    ? noteTitle.replace(/[^a-z0-9]/gi, "-").toLowerCase()
    : "notes";

  return (
    <Menu.Root>
      <Menu.Trigger asChild>
        <Button size="sm" variant="outline">Export ▾</Button>
      </Menu.Trigger>
      <Menu.Positioner>
        <Menu.Content>
          {noteId ? (
            <>
              <Menu.Item
                value="md"
                onClick={() => download(`/api/notes/${noteId}/export/markdown`, `${slug}.md`)}
              >
                Markdown (.md)
              </Menu.Item>
              <Menu.Item
                value="txt"
                onClick={() => download(`/api/notes/${noteId}/export/txt`, `${slug}.txt`)}
              >
                Plain text (.txt)
              </Menu.Item>
              <Menu.Item
                value="pdf"
                onClick={() => download(`/api/notes/${noteId}/export/pdf`, `${slug}.pdf`)}
              >
                PDF (.pdf)
              </Menu.Item>
              <Menu.Item
                value="docx"
                onClick={() => download(`/api/notes/${noteId}/export/docx`, `${slug}.docx`)}
              >
                Word document (.docx)
              </Menu.Item>
              <Menu.Item
                value="json"
                onClick={() => download(`/api/notes/${noteId}/export/json`, `${slug}.json`)}
              >
                JSON (raw data)
              </Menu.Item>
            </>
          ) : (
            <Menu.Item
              value="backup"
              onClick={() => download("/api/export/json", "notes-backup.json")}
            >
              Download all notes (JSON backup)
            </Menu.Item>
          )}
        </Menu.Content>
      </Menu.Positioner>
    </Menu.Root>
  );
}
