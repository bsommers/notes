import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  resolve: {
    alias: {
      "@notes/db": path.resolve(__dirname, "packages/db/src/index.ts"),
      "@notes/api": path.resolve(__dirname, "packages/api/src/index.ts"),
    },
  },
  test: {
    globals: true,
    environment: "node",
    pool: "forks",
    setupFiles: ["./tests/setup.ts"],
    include: ["tests/**/*.test.ts"],
  },
});
