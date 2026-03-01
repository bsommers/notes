import { useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import {
  Box,
  Button,
  Flex,
  Heading,
  HStack,
  Input,
  NativeSelect,
  Spinner,
  Tabs,
  Text,
  Textarea,
  Tooltip,
} from "@chakra-ui/react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkBreaks from "remark-breaks";
import rehypeHighlight from "rehype-highlight";
import { api } from "../api";

interface Props {
  noteId?: number;
  onSave: () => void;
}

// Toolbar button definition
interface ToolbarItem {
  label: string;
  title: string;
  wrap?: [string, string];   // wraps selection: [prefix, suffix]
  line?: string;             // inserts at start of line
  block?: string;            // inserts as a block on a new line
}

const TOOLBAR: ToolbarItem[] = [
  { label: "B",  title: "Bold",          wrap: ["**", "**"] },
  { label: "I",  title: "Italic",        wrap: ["_", "_"] },
  { label: "~~", title: "Strikethrough", wrap: ["~~", "~~"] },
  { label: "H1", title: "Heading 1",     line: "# " },
  { label: "H2", title: "Heading 2",     line: "## " },
  { label: "H3", title: "Heading 3",     line: "### " },
  { label: "</>", title: "Inline code",  wrap: ["`", "`"] },
  { label: "```", title: "Code block",   block: "```\n\n```" },
  { label: "—",  title: "Horizontal rule", block: "\n---\n" },
  { label: "[]", title: "Link",          wrap: ["[", "](url)"] },
  { label: "•",  title: "Bullet list",   line: "- " },
  { label: "1.", title: "Numbered list", line: "1. " },
  { label: "> ", title: "Blockquote",    line: "> " },
];

export function NoteEditor({ noteId, onSave }: Props) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const { data: existingNote, isLoading } = useQuery({
    queryKey: ["notes", noteId],
    queryFn: () => api.notes.get(noteId!),
    enabled: noteId != null,
  });

  const [title, setTitle] = useState<string | undefined>(undefined);
  const [content, setContent] = useState<string | undefined>(undefined);
  const [folderId, setFolderId] = useState<string | undefined>(undefined);

  const { data: folders = [] } = useQuery({
    queryKey: ["folders"],
    queryFn: () => api.folders.list(),
  });

  const resolvedTitle = title ?? existingNote?.title ?? "";
  const resolvedContent = content ?? existingNote?.content ?? "";
  const resolvedFolderId =
    folderId !== undefined
      ? folderId
      : existingNote?.folderId != null
      ? String(existingNote.folderId)
      : "";

  const createMutation = useMutation({
    mutationFn: () =>
      api.notes.create({
        title: resolvedTitle,
        content: resolvedContent,
        folderId: resolvedFolderId ? Number(resolvedFolderId) : undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notes"] });
      onSave();
    },
  });

  const updateMutation = useMutation({
    mutationFn: () =>
      api.notes.update(noteId!, {
        title: resolvedTitle,
        content: resolvedContent,
        folderId: resolvedFolderId ? Number(resolvedFolderId) : null,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notes"] });
      queryClient.invalidateQueries({ queryKey: ["notes", noteId] });
      onSave();
    },
  });

  const isPending = createMutation.isPending || updateMutation.isPending;

  if (noteId != null && isLoading) {
    return <Flex p={8} justify="center"><Spinner /></Flex>;
  }

  function handleSave() {
    if (!resolvedTitle.trim()) return;
    if (noteId != null) updateMutation.mutate();
    else createMutation.mutate();
  }

  function applyFormat(item: ToolbarItem) {
    const el = textareaRef.current;
    if (!el) return;

    const start = el.selectionStart;
    const end = el.selectionEnd;
    const selected = resolvedContent.slice(start, end);
    let newContent = resolvedContent;
    let newCursor = start;

    if (item.wrap) {
      const [pre, post] = item.wrap;
      newContent =
        resolvedContent.slice(0, start) +
        pre + selected + post +
        resolvedContent.slice(end);
      newCursor = start + pre.length + selected.length + post.length;
    } else if (item.line) {
      // Find start of line
      const lineStart = resolvedContent.lastIndexOf("\n", start - 1) + 1;
      newContent =
        resolvedContent.slice(0, lineStart) +
        item.line +
        resolvedContent.slice(lineStart);
      newCursor = start + item.line.length;
    } else if (item.block) {
      const prefix = resolvedContent[start - 1] !== "\n" && start > 0 ? "\n" : "";
      newContent =
        resolvedContent.slice(0, start) +
        prefix + item.block + "\n" +
        resolvedContent.slice(end);
      newCursor = start + prefix.length + item.block.length + 1;
    }

    setContent(newContent);
    // Restore focus + cursor after React re-render
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(newCursor, newCursor);
    });
  }

  return (
    <Box p={6} maxW="960px" mx="auto">
      <Flex justify="space-between" align="center" mb={4}>
        <Heading size="lg">{noteId != null ? "Edit Note" : "New Note"}</Heading>
        <Button size="sm" variant="ghost" onClick={() => navigate({ to: "/notes" })}>
          ← Cancel
        </Button>
      </Flex>

      <Input
        placeholder="Note title"
        value={resolvedTitle}
        onChange={(e) => setTitle(e.target.value)}
        mb={3}
        size="lg"
        fontWeight="semibold"
      />

      <NativeSelect.Root mb={4} size="sm">
        <NativeSelect.Field
          value={resolvedFolderId}
          onChange={(e) => setFolderId(e.target.value)}
        >
          <option value="">No folder</option>
          {folders.map((f) => (
            <option key={f.id} value={String(f.id)}>{f.name}</option>
          ))}
        </NativeSelect.Field>
      </NativeSelect.Root>

      <Tabs.Root defaultValue="write" mb={4}>
        <Flex justify="space-between" align="center" flexWrap="wrap" gap={2} mb={1}>
          <Tabs.List>
            <Tabs.Trigger value="write">Write</Tabs.Trigger>
            <Tabs.Trigger value="preview">Preview</Tabs.Trigger>
          </Tabs.List>

          {/* Formatting toolbar — only visible on Write tab */}
          <Tabs.Content value="write" asChild>
            <HStack gap={1} flexWrap="wrap">
              {TOOLBAR.map((item) => (
                <Tooltip.Root key={item.label} openDelay={400}>
                  <Tooltip.Trigger asChild>
                    <Button
                      size="xs"
                      variant="ghost"
                      fontFamily={item.label.includes("`") || item.label === "```" ? "mono" : undefined}
                      fontWeight="semibold"
                      minW="30px"
                      onClick={() => applyFormat(item)}
                      tabIndex={-1}
                    >
                      {item.label}
                    </Button>
                  </Tooltip.Trigger>
                  <Tooltip.Positioner>
                    <Tooltip.Content>{item.title}</Tooltip.Content>
                  </Tooltip.Positioner>
                </Tooltip.Root>
              ))}
            </HStack>
          </Tabs.Content>
        </Flex>

        <Tabs.Content value="write">
          <Textarea
            ref={textareaRef}
            value={resolvedContent}
            onChange={(e) => setContent(e.target.value)}
            rows={22}
            fontFamily="mono"
            fontSize="sm"
            placeholder="Write your note in Markdown..."
            onKeyDown={(e) => {
              // Ctrl/Cmd+B → bold, Ctrl/Cmd+I → italic
              if (e.metaKey || e.ctrlKey) {
                if (e.key === "b") { e.preventDefault(); applyFormat(TOOLBAR[0]!); }
                if (e.key === "i") { e.preventDefault(); applyFormat(TOOLBAR[1]!); }
                if (e.key === "s") { e.preventDefault(); handleSave(); }
              }
            }}
          />
          <Text fontSize="xs" color="gray.400" mt={1}>
            Ctrl+B bold · Ctrl+I italic · Ctrl+S save
          </Text>
        </Tabs.Content>

        <Tabs.Content value="preview">
          <Box
            mt={2}
            p={4}
            borderWidth="1px"
            borderRadius="md"
            minH="450px"
            lineHeight="tall"
          >
            {resolvedContent ? (
              <div className="prose">
                <ReactMarkdown
                  remarkPlugins={[remarkGfm, remarkBreaks]}
                  rehypePlugins={[rehypeHighlight]}
                >
                  {resolvedContent}
                </ReactMarkdown>
              </div>
            ) : (
              <Text color="gray.400">Nothing to preview.</Text>
            )}
          </Box>
        </Tabs.Content>
      </Tabs.Root>

      <Button
        colorPalette="blue"
        onClick={handleSave}
        disabled={!resolvedTitle.trim() || isPending}
      >
        {isPending ? <Spinner size="sm" /> : noteId != null ? "Save Changes" : "Create Note"}
      </Button>
    </Box>
  );
}
