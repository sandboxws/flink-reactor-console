/**
 * @module main
 * Application entry point. Initializes the instruments UI package, creates the
 * TanStack Router instance from the auto-generated route tree, and mounts the
 * React root with strict mode enabled.
 */

import { initInstrumentsUI } from "@flink-reactor/instruments-ui"
import { createRouter, RouterProvider } from "@tanstack/react-router"
import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import { graphqlClient } from "./lib/graphql-client"
import { routeTree } from "./routeTree.gen"

// Initialize the instruments UI package with the shared GraphQL client.
initInstrumentsUI({ graphqlClient })

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
    <RouterProvider router={router} />
  </StrictMode>,
)
