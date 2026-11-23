import { defineConfig } from "vitest/config";

// Kept separate from vite.config.js so tests don't load the React plugin.
export default defineConfig({
  test: { environment: "node", include: ["src/**/*.test.js"] },
});
