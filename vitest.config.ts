import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  css: {
    postcss: {}, // ignore the project's Tailwind PostCSS config during tests
  },
  test: {
    include: ["__tests__/**/*.test.ts"],
    environment: "node",
  },
});