import type { Client } from "urql"

let _client: Client | null = null

export function setGraphQLClient(client: Client): void {
  _client = client
}

export function getGraphQLClient(): Client {
  if (!_client) {
    throw new Error(
      "@flink-reactor/instruments-ui: GraphQL client not initialized. " +
      "Call initInstrumentsUI({ graphqlClient }) before using instrument components."
    )
  }
  return _client
}
