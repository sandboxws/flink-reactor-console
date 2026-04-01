/** Vite configuration for the FlinkReactor dashboard — TanStack Router plugin, dev server proxy. */
import { readFileSync } from "node:fs"
import tailwindcss from "@tailwindcss/vite"
import { TanStackRouterVite } from "@tanstack/router-plugin/vite"
import react from "@vitejs/plugin-react"
import { parse } from "smol-toml"
import { defineConfig } from "vite"
import tsconfigPaths from "vite-tsconfig-paths"

const dashboardConfig = parse(
  readFileSync("./dashboard.config.toml", "utf-8"),
)

export default defineConfig({
  define: {
    __DASHBOARD_CONFIG__: JSON.stringify(dashboardConfig),
  },
  plugins: [
    TanStackRouterVite({
      routesDirectory: "./src/routes",
      generatedRouteTree: "./src/routeTree.gen.ts",
    }),
    react(),
    tailwindcss(),
    tsconfigPaths(),
  ],
  optimizeDeps: {
    include: ["dagre"],
  },
})
