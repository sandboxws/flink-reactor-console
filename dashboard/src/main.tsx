import { createRouter, RouterProvider } from "@tanstack/react-router"
import { initInstrumentsUI } from "@flink-reactor/instruments-ui"
import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import { graphqlClient } from "./lib/graphql-client"
import { routeTree } from "./routeTree.gen"

// Initialize the instruments UI package with the shared GraphQL client.
initInstrumentsUI({ graphqlClient })

const router = createRouter({ routeTree })

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
