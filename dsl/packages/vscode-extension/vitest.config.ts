import { defineConfig } from "vitest/config"

// Unit tests cover only the PURE logic modules — tsconfig-edit computation,
// workspace-TypeScript detection, project-context/alias resolution. These never
// import `vscode`, so they run in plain Node. The `@vscode/test-electron` E2E
// suite under `test/` runs separately inside a real extension host.
export default defineConfig({
  test: {
    environment: "node",
    include: ["__tests__/**/*.test.ts"],
  },
})
