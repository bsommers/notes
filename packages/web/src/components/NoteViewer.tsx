import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import {
  Box,
  Button,
  Flex,
  Heading,
  HStack,
  Spinner,
  Text,
  Badge,
} from "@chakra-ui/react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkBreaks from "remark-breaks";
import rehypeHighlight from "rehype-highlight";
import { api } from "../api";
import { ExportButton } from "./ExportButton";

interface Props {
  noteId: number;
}

export function NoteViewer({ noteId }: Props) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: note, isLoading, error } = useQuery({
    queryKey: ["notes", noteId],
    queryFn: () => api.notes.get(noteId),
  });

  const deleteMutation = useMutation({
    mutationFn: () => api.notes.delete(noteId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notes"] });
      navigate({ to: "/notes" });
    },
  });

  const cloneMutation = useMutation({
    mutationFn: () => api.notes.clone(noteId),
    onSuccess: (cloned) => {
      queryClient.invalidateQueries({ queryKey: ["notes"] });
      navigate({ to: "/notes/$noteId", params: { noteId: String(cloned.id) } });
    },
  });

  if (isLoading) return <Flex p={8} justify="center"><Spinner /></Flex>;
  if (error || !note) return <Box p={8}><Text color="red.500">Failed to load note.</Text></Box>;

  return (
    <Box p={8} maxW="800px" mx="auto">
      <Flex justify="space-between" align="center" mb={4}>
        <Heading size="xl">{note.title}</Heading>
        <HStack>
          <Button
            size="sm"
            variant="outline"
            onClick={() =>
              navigate({ to: "/notes/$noteId/edit", params: { noteId: String(noteId) } })
            }
          >
            Edit
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => cloneMutation.mutate()}
          >
            Clone
          </Button>
          <ExportButton noteId={noteId} noteTitle={note.title} />
          <Button
            size="sm"
            colorPalette="red"
            variant="ghost"
            onClick={() => {
              if (confirm(`Delete "${note.title}"?`)) {
                deleteMutation.mutate();
              }
            }}
          >
            Delete
          </Button>
          <Button size="sm" variant="ghost" onClick={() => navigate({ to: "/notes" })}>
            ← Back
          </Button>
        </HStack>
      </Flex>

      {note.tags.length > 0 && (
        <HStack mb={4} flexWrap="wrap">
          {note.tags.map((tag) => (
            <Badge key={tag.id} colorPalette="blue">{tag.name}</Badge>
          ))}
        </HStack>
      )}

      <Text fontSize="sm" color="gray.500" mb={6}>
        Updated {new Date(note.updatedAt).toLocaleString()}
      </Text>

      <div className="prose">
        <ReactMarkdown
          remarkPlugins={[remarkGfm, remarkBreaks]}
          rehypePlugins={[rehypeHighlight]}
        >
          {note.content}
        </ReactMarkdown>
      </div>
    </Box>
  );
}
