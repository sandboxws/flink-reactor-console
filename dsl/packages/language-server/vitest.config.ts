import { defineConfig } from "vitest/config"

export default defineConfig({
  test: {
    environment: "node",
    include: ["__tests__/**/*.test.ts"],
    // Loading + synthesizing a pipeline (jiti eval) and spawning the
    // isolation worker can exceed vitest's default per-test timeout on a
    // cold cache, so give integration specs more headroom.
    testTimeout: 20_000,
    hookTimeout: 20_000,
  },
})
