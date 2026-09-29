import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    globals: false,
    coverage: {
      provider: "v8",
      reporter: ["text", "json-summary"],
      // `.tsx` is out of scope: the coverage transform of this toolchain cannot
      // parse JSX and silently drops every component/page file. The numbers
      // below therefore describe the server-side logic (`src/**/*.ts`).
      include: ["src/**/*.ts"],
      exclude: ["src/**/*.d.ts"],
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "@locales": path.resolve(__dirname, "./locales"),
      // `server-only` intentionally throws outside a React Server environment.
      "server-only": path.resolve(__dirname, "./tests/stubs/server-only.ts"),
    },
  },
});
