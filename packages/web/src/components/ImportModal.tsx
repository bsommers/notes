import { useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Box,
  Button,
  Dialog,
  Flex,
  Input,
  Spinner,
  Tabs,
  Text,
  Textarea,
  VStack,
} from "@chakra-ui/react";

import { getToken } from "../auth";

const BASE = "/api";

interface Props {
  open: boolean;
  onClose: () => void;
}

export function ImportModal({ open, onClose }: Props) {
  const queryClient = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);

  const [pasteTitle, setPasteTitle] = useState("");
  const [pasteContent, setPasteContent] = useState("");
  const [fileTitle, setFileTitle] = useState("");

  const pasteMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`${BASE}/import/text`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${getToken()}` },
        body: JSON.stringify({
          title: pasteTitle || undefined,
          content: pasteContent,
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notes"] });
      setPasteTitle("");
      setPasteContent("");
      onClose();
    },
  });

  const fileMutation = useMutation({
    mutationFn: async () => {
      const file = fileRef.current?.files?.[0];
      if (!file) throw new Error("No file selected");

      const form = new FormData();
      form.append("file", file);
      if (fileTitle) form.append("title", fileTitle);

      const res = await fetch(`${BASE}/import/file`, {
        method: "POST",
        headers: { Authorization: `Bearer ${getToken()}` },
        body: form,
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notes"] });
      setFileTitle("");
      if (fileRef.current) fileRef.current.value = "";
      onClose();
    },
  });

  return (
    <Dialog.Root open={open} onOpenChange={(d) => !d.open && onClose()}>
      <Dialog.Backdrop />
      <Dialog.Positioner>
        <Dialog.Content maxW="600px">
          <Dialog.Header>
            <Dialog.Title>Import Note</Dialog.Title>
            <Dialog.CloseTrigger />
          </Dialog.Header>

          <Dialog.Body>
            <Tabs.Root defaultValue="paste">
              <Tabs.List>
                <Tabs.Trigger value="paste">Paste Text / Markdown</Tabs.Trigger>
                <Tabs.Trigger value="file">Upload File</Tabs.Trigger>
              </Tabs.List>

              {/* Paste tab */}
              <Tabs.Content value="paste">
                <VStack align="stretch" gap={3} mt={3}>
                  <Box>
                    <Text fontSize="sm" mb={1} fontWeight="medium">Title (optional — inferred from # heading)</Text>
                    <Input
                      placeholder="Note title"
                      value={pasteTitle}
                      onChange={(e) => setPasteTitle(e.target.value)}
                      size="sm"
                    />
                  </Box>
                  <Box>
                    <Text fontSize="sm" mb={1} fontWeight="medium">Content (Markdown or plain text)</Text>
                    <Textarea
                      placeholder="Paste your markdown or text here..."
                      value={pasteContent}
                      onChange={(e) => setPasteContent(e.target.value)}
                      rows={12}
                      fontFamily="mono"
                      fontSize="sm"
                    />
                  </Box>
                  {pasteMutation.error && (
                    <Text color="red.500" fontSize="sm">
                      {String(pasteMutation.error)}
                    </Text>
                  )}
                  <Button
                    colorPalette="blue"
                    onClick={() => pasteMutation.mutate()}
                    disabled={!pasteContent.trim() || pasteMutation.isPending}
                  >
                    {pasteMutation.isPending ? <Spinner size="sm" /> : "Import"}
                  </Button>
                </VStack>
              </Tabs.Content>

              {/* File upload tab */}
              <Tabs.Content value="file">
                <VStack align="stretch" gap={3} mt={3}>
                  <Box>
                    <Text fontSize="sm" mb={1} fontWeight="medium">
                      Supported formats: .md, .txt, .docx, .pdf
                    </Text>
                    <input
                      ref={fileRef}
                      type="file"
                      accept=".md,.txt,.docx,.pdf"
                      style={{ width: "100%" }}
                    />
                  </Box>
                  <Box>
                    <Text fontSize="sm" mb={1} fontWeight="medium">Title override (optional)</Text>
                    <Input
                      placeholder="Leave blank to infer from content"
                      value={fileTitle}
                      onChange={(e) => setFileTitle(e.target.value)}
                      size="sm"
                    />
                  </Box>
                  {fileMutation.error && (
                    <Text color="red.500" fontSize="sm">
                      {String(fileMutation.error)}
                    </Text>
                  )}
                  <Button
                    colorPalette="blue"
                    onClick={() => fileMutation.mutate()}
                    disabled={fileMutation.isPending}
                  >
                    {fileMutation.isPending ? <Spinner size="sm" /> : "Upload & Import"}
                  </Button>
                </VStack>
              </Tabs.Content>
            </Tabs.Root>
          </Dialog.Body>
        </Dialog.Content>
      </Dialog.Positioner>
    </Dialog.Root>
  );
}
