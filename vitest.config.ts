import { defineConfig } from "vitest/config";
export default defineConfig({
  test: {
    include: ["tests/**/*.test.ts"],
    fileParallelism: false,
    pool: "forks",
    environment: "node",
    testTimeout: 20000,
    globalSetup: "tests/setup.ts",
    env: {
      DATABASE_URL: "file:../data/rules-test.db",
      SESSION_SECRET: "tests-only-secret-0123456789abcdef0123456789abcdef",
      APP_MODE: "demo",
      APP_URL: "http://localhost:5173",
    },
  },
});
