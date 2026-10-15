import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["src/**/*.test.ts", "evals/**/*.test.ts", "web/src/**/*.test.ts"],
  },
});
