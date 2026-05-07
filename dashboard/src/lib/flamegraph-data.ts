/**
 * Flame graph data wrapper. Calls the existing `flamegraph(jobId,
 * vertexId, type)` GraphQL query (defined in
 * `server/internal/graphql/schema/jobs.graphqls`) and returns the
 * normalized tree.
 *
 * The backend resolver proxies Flink REST `/jobs/:jid/vertices/:vid/flamegraph`,
 * so this is pure consumer-side wiring.
 */

import { gql } from "urql"
import { graphqlClient } from "./graphql-client"

export interface FlamegraphNode {
  name: string
  /** Leaf "weight" — total samples represented by this frame, including
   *  its descendants. The root's value is the denominator for percentages. */
  value: number
  children?: FlamegraphNode[] | null
}

export interface FlamegraphResult {
  endTimestamp: string
  data: FlamegraphNode
}

const FLAMEGRAPH_QUERY = gql`
  query Flamegraph(
    $jobId: ID!
    $vertexId: ID!
    $type: String!
    $cluster: String
  ) {
    flamegraph(jobId: $jobId, vertexId: $vertexId, type: $type, cluster: $cluster) {
      endTimestamp
      data {
        ...FrameFields
      }
    }
  }

  fragment FrameFields on FlamegraphNode {
    name
    value
    children {
      name
      value
      children {
        name
        value
        children {
          name
          value
          children {
            name
            value
          }
        }
      }
    }
  }
`

/** Fetch a flame graph. The backend value field is a string (Int64); we
 *  parse to number client-side because flame totals are well within safe
 *  integer range for sampled data. */
export async function fetchFlamegraph(
  jobId: string,
  vertexId: string,
  type: "ON_CPU" | "OFF_CPU" | "FULL" = "ON_CPU",
  cluster?: string,
): Promise<FlamegraphResult> {
  const res = await graphqlClient
    .query(
      FLAMEGRAPH_QUERY,
      { jobId, vertexId, type, cluster },
      { requestPolicy: "network-only" },
    )
    .toPromise()
  if (res.error) throw new Error(res.error.message)
  const fg = res.data?.flamegraph
  if (!fg) throw new Error("Empty flamegraph response")
  return {
    endTimestamp: fg.endTimestamp,
    data: parseNode(fg.data),
  }
}

function parseNode(raw: any): FlamegraphNode {
  return {
    name: raw.name,
    value: typeof raw.value === "string" ? Number(raw.value) : raw.value,
    children: Array.isArray(raw.children) ? raw.children.map(parseNode) : null,
  }
}
