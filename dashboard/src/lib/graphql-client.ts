import { createClient as createWSClient } from "graphql-ws"
import {
  Client,
  cacheExchange,
  fetchExchange,
  subscriptionExchange,
} from "urql"

/**
 * Creates a urql GraphQL client.
 *
 * Default URL is `/graphql` (relative — works when the dashboard is served
 * by reactor-server). For development, set `VITE_GRAPHQL_URL` to point
 * at the Go server (e.g., `http://localhost:8080/graphql`).
 *
 * Subscriptions use the `graphql-transport-ws` protocol over a WebSocket
 * derived from the same URL (http(s) → ws(s)). The server speaks
 * `graphql-transport-ws` via gqlgen's `transport.Websocket`, matching the
 * existing `jobStatusChanged` and `sqlResults` subscriptions.
 */
export function createGraphQLClient(url?: string): Client {
  const graphqlUrl = url ?? import.meta.env.VITE_GRAPHQL_URL ?? "/graphql"

  const wsClient = createWSClient({
    url: httpToWs(graphqlUrl),
  })

  return new Client({
    url: graphqlUrl,
    exchanges: [
      cacheExchange,
      fetchExchange,
      subscriptionExchange({
        forwardSubscription(request) {
          const input = { ...request, query: request.query ?? "" }
          return {
            subscribe(sink) {
              const unsubscribe = wsClient.subscribe(input, sink)
              return { unsubscribe }
            },
          }
        },
      }),
    ],
  })
}

/**
 * Convert an http(s) GraphQL URL to its ws(s) equivalent. Relative URLs
 * (e.g. `/graphql`) are resolved against `window.location` so the WS uses
 * the page's host.
 */
function httpToWs(url: string): string {
  if (url.startsWith("ws://") || url.startsWith("wss://")) return url

  if (url.startsWith("http://")) return `ws://${url.slice("http://".length)}`
  if (url.startsWith("https://")) return `wss://${url.slice("https://".length)}`

  if (typeof window !== "undefined") {
    const scheme = window.location.protocol === "https:" ? "wss" : "ws"
    const path = url.startsWith("/") ? url : `/${url}`
    return `${scheme}://${window.location.host}${path}`
  }

  return url
}

/** Singleton client instance for use across stores. */
export const graphqlClient = createGraphQLClient()
