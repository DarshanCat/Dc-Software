import { defineConfig } from "vitest/config";

export default defineConfig({
  css: {
    postcss: {},   // ignore the project's Tailwind PostCSS config during tests
  },
  test: {
    include: ["__tests__/**/*.test.ts"],
    environment: "node",
  },
});