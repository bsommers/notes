import { useState } from "react";
import {
  Box,
  Button,
  Flex,
  Heading,
  Input,
  Spinner,
  Text,
  VStack,
} from "@chakra-ui/react";
import { api } from "../api";
import { setToken } from "../auth";

interface Props {
  mode: "login" | "register";
  onSuccess: () => void;
  onSwitch: () => void;
}

export function AuthForm({ mode, onSuccess, onSwitch }: Props) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const resp =
        mode === "login"
          ? await api.auth.login({ email, password })
          : await api.auth.register({ email, password });
      setToken(resp.token);
      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Flex minH="100vh" align="center" justify="center" bg="gray.50">
      <Box bg="white" p={8} borderRadius="lg" boxShadow="md" w="360px">
        <Heading size="lg" mb={6} textAlign="center">
          {mode === "login" ? "Sign In" : "Create Account"}
        </Heading>
        <form onSubmit={handleSubmit}>
          <VStack gap={4}>
            <Box w="full">
              <Text fontSize="sm" mb={1} fontWeight="medium">Email</Text>
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoFocus
              />
            </Box>
            <Box w="full">
              <Text fontSize="sm" mb={1} fontWeight="medium">Password</Text>
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
              />
            </Box>
            {error && (
              <Text color="red.500" fontSize="sm" textAlign="center">
                {error}
              </Text>
            )}
            <Button type="submit" colorPalette="blue" w="full" disabled={loading}>
              {loading ? <Spinner size="sm" /> : mode === "login" ? "Sign In" : "Create Account"}
            </Button>
          </VStack>
        </form>
        <Text fontSize="sm" mt={4} textAlign="center" color="gray.500">
          {mode === "login" ? (
            <>No account?{" "}
              <Box as="span" color="blue.500" cursor="pointer" onClick={onSwitch}>
                Register
              </Box>
            </>
          ) : (
            <>Already have an account?{" "}
              <Box as="span" color="blue.500" cursor="pointer" onClick={onSwitch}>
                Sign In
              </Box>
            </>
          )}
        </Text>
      </Box>
    </Flex>
  );
}
