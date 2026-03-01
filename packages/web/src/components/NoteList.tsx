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
  VStack,
} from "@chakra-ui/react";
import { api } from "../api";

interface Props {
  folder?: number;
  tag?: string;
  q?: string;
}

export function NoteList({ folder, tag, q }: Props) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: notes = [], isLoading } = useQuery({
    queryKey: ["notes", { folder, tag, q }],
    queryFn: () => api.notes.list({ folder, tag, q }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => api.notes.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["notes"] }),
  });

  const cloneMutation = useMutation({
    mutationFn: (id: number) => api.notes.clone(id),
    onSuccess: (note) => {
      queryClient.invalidateQueries({ queryKey: ["notes"] });
      navigate({ to: "/notes/$noteId", params: { noteId: String(note.id) } });
    },
  });

  const title = q
    ? `Search: "${q}"`
    : tag
    ? `Tag: ${tag}`
    : folder != null
    ? "Folder"
    : "All Notes";

  if (isLoading) return <Flex p={8} justify="center"><Spinner /></Flex>;

  return (
    <Box p={6}>
      <Flex justify="space-between" align="center" mb={4}>
        <Heading size="lg">{title}</Heading>
        <Button
          colorPalette="blue"
          size="sm"
          onClick={() => navigate({ to: "/notes/new" })}
        >
          + New Note
        </Button>
      </Flex>

      {notes.length === 0 ? (
        <Text color="gray.500">No notes found.</Text>
      ) : (
        <VStack align="stretch" gap={3}>
          {notes.map((note) => (
            <Box
              key={note.id}
              borderWidth="1px"
              borderRadius="md"
              p={4}
              _hover={{ bg: "gray.50" }}
            >
              <Flex justify="space-between" align="start">
                <Box
                  flex={1}
                  minW={0}
                  cursor="pointer"
                  onClick={() =>
                    navigate({ to: "/notes/$noteId", params: { noteId: String(note.id) } })
                  }
                >
                  <Heading size="sm" mb={1} _hover={{ textDecoration: "underline" }}>
                    {note.title}
                  </Heading>
                  <Text fontSize="sm" color="gray.500" mb={2}>
                    {new Date(note.updatedAt).toLocaleDateString()}
                  </Text>
                  {note.tags.length > 0 && (
                    <HStack flexWrap="wrap" gap={1}>
                      {note.tags.map((t) => (
                        <Badge key={t.id} colorPalette="blue" size="sm">
                          {t.name}
                        </Badge>
                      ))}
                    </HStack>
                  )}
                </Box>
                <HStack ml={4}>
                  <Button
                    size="xs"
                    variant="outline"
                    onClick={() =>
                      navigate({
                        to: "/notes/$noteId/edit",
                        params: { noteId: String(note.id) },
                      })
                    }
                  >
                    Edit
                  </Button>
                  <Button
                    size="xs"
                    variant="outline"
                    onClick={() => cloneMutation.mutate(note.id)}
                  >
                    Clone
                  </Button>
                  <Button
                    size="xs"
                    colorPalette="red"
                    variant="ghost"
                    onClick={() => {
                      if (confirm(`Delete "${note.title}"?`)) {
                        deleteMutation.mutate(note.id);
                      }
                    }}
                  >
                    Delete
                  </Button>
                </HStack>
              </Flex>
            </Box>
          ))}
        </VStack>
      )}
    </Box>
  );
}
