/**
 * @module main
 * Application entry point. Creates the TanStack Router instance from the
 * auto-generated route tree, and mounts the React root with strict mode
 * enabled.
 */

import { createRouter, RouterProvider } from "@tanstack/react-router"
import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import { Provider as UrqlProvider } from "urql"
import { graphqlClient } from "./lib/graphql-client"
import { routeTree } from "./routeTree.gen"

/** Router instance created from the file-based {@link routeTree}. */
const router = createRouter({ routeTree })

/**
 * TanStack Router module augmentation for type-safe route navigation
 * throughout the application.
 */
declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router
  }
}

// biome-ignore lint/style/noNonNullAssertion: root element guaranteed by index.html
createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <UrqlProvider value={graphqlClient}>
      <RouterProvider router={router} />
    </UrqlProvider>
  </StrictMode>,
)
