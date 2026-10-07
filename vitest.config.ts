import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  esbuild: {
    // tsconfig uses jsx: "preserve" for Next's own compiler; vitest's esbuild
    // transform needs the automatic runtime explicitly so component tests
    // don't require importing React just to use JSX.
    jsx: "automatic",
  },
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