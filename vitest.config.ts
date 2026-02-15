import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const rootDir = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(rootDir, "./src"),
    },
  },
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
    coverage: {
      provider: "v8",
      all: true,
      include: [
        "src/lib/natural-date.ts",
        "src/lib/markdown.ts",
        "src/lib/task-filters.ts",
        "src/lib/reminder-settings.ts",
        "src/hooks/use-quick-capture-shortcut.ts",
        "src/hooks/use-task-filters.ts",
        "src/store/app-store.ts",
      ],
      exclude: ["src/test/**"],
      reporter: ["text", "text-summary", "html"],
      thresholds: {
        lines: 100,
        functions: 100,
        statements: 100,
        branches: 100,
      },
    },
  },
});
