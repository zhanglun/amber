import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["packages/*/src/**/*.test.{ts,tsx}"],
    globalSetup: "./vitest.globalSetup.ts",
  },
});
