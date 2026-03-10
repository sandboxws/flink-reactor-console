import type { Client } from "urql"
import { setGraphQLClient } from "./graphql-client"

export function initInstrumentsUI(opts: { graphqlClient: Client }): void {
  setGraphQLClient(opts.graphqlClient)
}
