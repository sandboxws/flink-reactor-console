import { defineConfig } from "tsup"

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm"],
  target: "es2022",
  dts: true,
  sourcemap: true,
  clean: true,
  external: [
    "react",
    "react-dom",
    "react/jsx-runtime",
    "@tanstack/react-router",
    "zustand",
    "urql",
    "lucide-react",
    "date-fns",
    "@flink-reactor/ui",
  ],
  banner: { js: '"use client";' },
})
