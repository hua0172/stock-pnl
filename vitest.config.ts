import path from "node:path";
import { defineConfig } from "vitest/config";

// Mirrors tsconfig.json's "@/*" -> "./src/*" path mapping — vitest doesn't
// read tsconfig paths on its own, and this is the first test whose import
// graph reaches a file using that alias (src/lib/dividend-write.ts, via
// src/lib/prisma.ts).
export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
