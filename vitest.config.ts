import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

const emptyModule = new URL("./tests/unit/empty-module.ts", import.meta.url).pathname;

export default defineConfig({
  plugins: [react()],
  resolve: { tsconfigPaths: true, alias: { "server-only": emptyModule } },
  test: {
    env: { TZ: process.env.TZ ?? "UTC" },
    projects: [
      {
        extends: true,
        test: { name: "unit", environment: "node", include: ["tests/unit/**/*.test.ts"] },
      },
      {
        extends: true,
        test: {
          name: "components",
          environment: "jsdom",
          include: ["tests/unit/**/*.test.tsx"],
          setupFiles: ["./tests/unit/setup-dom.ts"],
        },
      },
      {
        extends: true,
        test: {
          name: "integration",
          environment: "node",
          include: ["tests/integration/**/*.test.ts"],
          setupFiles: ["./tests/support/integration-setup.ts"],
          testTimeout: 30_000,
          hookTimeout: 60_000,
          fileParallelism: false,
        },
      },
      {
        extends: true,
        test: {
          name: "security",
          environment: "node",
          include: ["tests/security/**/*.test.ts"],
          setupFiles: ["./tests/support/integration-setup.ts"],
          testTimeout: 30_000,
          hookTimeout: 60_000,
          fileParallelism: false,
        },
      },
    ],
    coverage: {
      provider: "v8",
      include: ["packages/**/src/**", "modules/**/domain/**", "modules/**/application/**"],
    },
  },
});
