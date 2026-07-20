import { dirname } from "node:path"
import { fileURLToPath } from "node:url"
import { defineConfig } from "vitest/config"

// Black-box e2e suite. Deliberately NOT part of the root vitest config:
// `pnpm test` stays fast, and — critically — this config defines NO `@`
// path alias and no jsx-runtime aliases. Their absence is the black-box
// enforcement: any accidental import of repo source (`@/...`) fails to
// resolve. Tests may import only the published artifact (via the temp
// projects the harness installs) and ordinary npm libraries.

const e2eRoot = dirname(fileURLToPath(import.meta.url))
const runNightly = process.env.FR_E2E_ALL === "1"

export default defineConfig({
  root: e2eRoot,
  test: {
    include: ["**/*.e2e.test.ts"],
    exclude: ["**/node_modules/**", ...(runNightly ? [] : ["nightly/**"])],
    globalSetup: ["./global-setup.ts"],
    environment: "node",
    // Scaffold + pnpm install happen in beforeAll — generous budgets.
    testTimeout: 120_000,
    hookTimeout: 600_000,
    // Temp projects are filesystem-heavy; serialize files to keep pnpm
    // store contention (and disk churn) predictable in CI.
    fileParallelism: false,
  },
})
