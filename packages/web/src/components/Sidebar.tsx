import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import {
  Box,
  Button,
  Flex,
  Heading,
  HStack,
  Input,
  Text,
  VStack,
  Badge,
} from "@chakra-ui/react";
import { api, type Folder } from "../api";
import { ImportModal } from "./ImportModal";
import { ExportButton } from "./ExportButton";
import { clearToken, getUser as getAuthUser } from "../auth";

export function Sidebar() {
  const [search, setSearch] = useState("");
  const [importOpen, setImportOpen] = useState(false);
  const navigate = useNavigate();
  const authUser = getAuthUser();

  function handleLogout() {
    clearToken();
    navigate({ to: "/login" });
  }

  const { data: folders = [] } = useQuery({
    queryKey: ["folders"],
    queryFn: () => api.folders.list(),
  });

  const { data: tags = [] } = useQuery({
    queryKey: ["tags"],
    queryFn: () => api.tags.list(),
  });

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    if (search.trim()) {
      navigate({ to: "/notes", search: { q: search.trim() } });
    } else {
      navigate({ to: "/notes" });
    }
  }

  const rootFolders = folders.filter((f) => !f.parentId);

  return (
    <Box p={4}>
      <Flex justify="space-between" align="center" mb={1}>
        <Heading size="md">Notes</Heading>
        <Button size="xs" variant="ghost" onClick={handleLogout} color="gray.500">
          Logout
        </Button>
      </Flex>
      {authUser && (
        <Text fontSize="xs" color="gray.400" mb={3}>
          {authUser.email} · {authUser.role}
        </Text>
      )}

      {/* Search */}
      <form onSubmit={handleSearch}>
        <Flex mb={4} gap={2}>
          <Input
            placeholder="Search..."
            size="sm"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <Button type="submit" size="sm">Go</Button>
        </Flex>
      </form>

      {/* New Note + Import buttons */}
      <HStack mb={4}>
        <Button
          flex={1}
          size="sm"
          colorPalette="blue"
          onClick={() => navigate({ to: "/notes/new" })}
        >
          + New Note
        </Button>
        <Button size="sm" variant="outline" onClick={() => setImportOpen(true)}>
          Import
        </Button>
      </HStack>

      {/* Export all */}
      <Box mb={3}>
        <ExportButton />
      </Box>

      <ImportModal open={importOpen} onClose={() => setImportOpen(false)} />

      {/* All Notes */}
      <Text
        fontWeight="semibold"
        mb={2}
        cursor="pointer"
        _hover={{ textDecoration: "underline" }}
        onClick={() => navigate({ to: "/notes" })}
      >
        All Notes
      </Text>

      {/* Folders */}
      {folders.length > 0 && (
        <Box mb={4}>
          <Text fontWeight="semibold" fontSize="xs" color="gray.500" mb={1} textTransform="uppercase">
            Folders
          </Text>
          <VStack align="stretch" gap={0}>
            {rootFolders.map((folder) => (
              <FolderItem key={folder.id} folder={folder} allFolders={folders} depth={0} />
            ))}
          </VStack>
        </Box>
      )}

      {/* Tags */}
      {tags.length > 0 && (
        <Box>
          <Text fontWeight="semibold" fontSize="xs" color="gray.500" mb={2} textTransform="uppercase">
            Tags
          </Text>
          <Flex flexWrap="wrap" gap={1}>
            {tags.map((tag) => (
              <Badge
                key={tag.id}
                colorPalette="blue"
                cursor="pointer"
                _hover={{ opacity: 0.8 }}
                onClick={() => navigate({ to: "/notes", search: { tag: tag.name } })}
              >
                {tag.name}
              </Badge>
            ))}
          </Flex>
        </Box>
      )}
    </Box>
  );
}

function FolderItem({
  folder,
  allFolders,
  depth,
}: {
  folder: Folder;
  allFolders: Folder[];
  depth: number;
}) {
  const [open, setOpen] = useState(true);
  const navigate = useNavigate();
  const children = allFolders.filter((f) => f.parentId === folder.id);

  return (
    <Box>
      <Flex align="center" pl={`${depth * 12}px`}>
        {children.length > 0 && (
          <Button
            size="xs"
            variant="ghost"
            onClick={() => setOpen((o) => !o)}
            mr={1}
            px={1}
          >
            {open ? "▾" : "▸"}
          </Button>
        )}
        <Text
          fontSize="sm"
          cursor="pointer"
          _hover={{ textDecoration: "underline" }}
          py={1}
          onClick={() => navigate({ to: "/notes", search: { folder: folder.id } })}
        >
          {folder.name}
        </Text>
      </Flex>
      {open &&
        children.map((child) => (
          <FolderItem
            key={child.id}
            folder={child}
            allFolders={allFolders}
            depth={depth + 1}
          />
        ))}
    </Box>
  );
}
