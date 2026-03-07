import { createRootRoute, Outlet } from "@tanstack/react-router"
import { Shell } from "@/components/layout/shell"
import "../global.css"

export const Route = createRootRoute({
  component: () => (
    <Shell>
      <Outlet />
    </Shell>
  ),
})
