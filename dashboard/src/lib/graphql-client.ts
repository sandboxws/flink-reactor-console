import { Client, cacheExchange, fetchExchange } from "urql"

/**
 * Creates a urql GraphQL client.
 *
 * Default URL is `/graphql` (relative — works when the dashboard is served
 * by reactor-server). For development, set `VITE_GRAPHQL_URL` to point
 * at the Go server (e.g., `http://localhost:8080/graphql`).
 */
export function createGraphQLClient(url?: string): Client {
  const graphqlUrl = url ?? import.meta.env.VITE_GRAPHQL_URL ?? "/graphql"

  return new Client({
    url: graphqlUrl,
    exchanges: [cacheExchange, fetchExchange],
  })
}

/** Singleton client instance for use across stores. */
export const graphqlClient = createGraphQLClient()
