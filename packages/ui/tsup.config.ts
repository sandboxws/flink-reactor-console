import { defineConfig } from "tsup"

export default defineConfig({
  entry: ["src/index.ts", "src/fixtures/index.ts"],
  format: ["esm"],
  target: "es2022",
  dts: true,
  sourcemap: true,
  clean: true,
  external: ["react", "react-dom", "react/jsx-runtime", "recharts"],
  banner: { js: '"use client";' },
})
