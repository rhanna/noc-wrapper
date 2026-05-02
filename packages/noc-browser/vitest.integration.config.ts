import { config as loadDotenv } from "dotenv";
import { defineConfig } from "vitest/config";

for (const path of [".env.test.local", ".env.test", ".env"]) {
  loadDotenv({ path, override: false, quiet: true });
}

export default defineConfig({
  test: {
    include: ["test/integration/**/*.test.ts"],
    globals: true,
    testTimeout: 30000,
  },
});
