import { gql } from "urql"
import { create } from "zustand"
import { mapBlueGreenDeployments } from "@/data/bg-deployment-mappers"
import type { BlueGreenDeployment } from "@flink-reactor/ui"
import { graphqlClient } from "@/lib/graphql-client"

/**
 * Blue-green deployment store — fetches and caches Flink blue-green deployment
 * state from the Go GraphQL backend.
 *
 * Supports listing all deployments (optionally filtered by cluster/namespace)
 * and fetching individual deployment detail. Maps raw GraphQL responses to
 * domain types via {@link mapBlueGreenDeployments}.
 *
 * @module bg-deployment-store
 */

interface BgDeploymentState {
  /** All known blue-green deployments. */
  deployments: BlueGreenDeployment[]
  /** Whether the deployment list is loading. */
  isLoading: boolean
  /** Error from the most recent list fetch. */
  fetchError: string | null
  /** Lazily loaded deployment detail for the selected deployment. */
  selectedDeployment: BlueGreenDeployment | null
  /** Whether a deployment detail fetch is in progress. */
  selectedDeploymentLoading: boolean
  /** Error from the most recent deployment detail fetch. */
  selectedDeploymentError: string | null
}

interface BgDeploymentActions {
  /** Fetch all blue-green deployments, optionally filtered by cluster and namespace. */
  fetchDeployments: (cluster?: string, namespace?: string) => Promise<void>
  /** Fetch detail for a single deployment by name. */
  fetchDeployment: (
    name: string,
    cluster?: string,
    namespace?: string,
  ) => Promise<void>
}

type BgDeploymentStore = BgDeploymentState & BgDeploymentActions

const DEPLOYMENTS_QUERY = gql`
  query BlueGreenDeployments($cluster: String, $namespace: String) {
    blueGreenDeployments(cluster: $cluster, namespace: $namespace) {
      name
      namespace
      state
      jobStatus
      error
      lastReconciledTimestamp
      abortTimestamp
      deploymentReadyTimestamp
      blueDeploymentName
      greenDeploymentName
      activeJobId
      pendingJobId
      abortGracePeriod
      deploymentDeletionDelay
    }
  }
`

const DEPLOYMENT_DETAIL_QUERY = gql`
  query BlueGreenDeploymentDetail(
    $name: String!
    $namespace: String
    $cluster: String
  ) {
    blueGreenDeployment(name: $name, namespace: $namespace, cluster: $cluster) {
      name
      namespace
      state
      jobStatus
      error
      lastReconciledTimestamp
      abortTimestamp
      deploymentReadyTimestamp
      blueDeploymentName
      greenDeploymentName
      activeJobId
      pendingJobId
      abortGracePeriod
      deploymentDeletionDelay
    }
  }
`

export const useBgDeploymentStore = create<BgDeploymentStore>((set) => ({
  deployments: [],
  isLoading: false,
  fetchError: null,
  selectedDeployment: null,
  selectedDeploymentLoading: false,
  selectedDeploymentError: null,

  async fetchDeployments(cluster?: string, namespace?: string) {
    set({ isLoading: true, fetchError: null })
    try {
      const result = await graphqlClient
        .query(DEPLOYMENTS_QUERY, { cluster, namespace })
        .toPromise()
      if (result.error) throw result.error
      const raw = result.data?.blueGreenDeployments ?? []
      set({ deployments: mapBlueGreenDeployments(raw), isLoading: false })
    } catch (err) {
      set({
        fetchError:
          err instanceof Error ? err.message : "Failed to fetch deployments",
        isLoading: false,
      })
    }
  },

  async fetchDeployment(name: string, cluster?: string, namespace?: string) {
    set({ selectedDeploymentLoading: true, selectedDeploymentError: null })
    try {
      const result = await graphqlClient
        .query(DEPLOYMENT_DETAIL_QUERY, { name, cluster, namespace })
        .toPromise()
      if (result.error) throw result.error
      const raw = result.data?.blueGreenDeployment
      if (!raw) throw new Error(`Deployment "${name}" not found`)
      set({
        selectedDeployment: mapBlueGreenDeployments([raw])[0],
        selectedDeploymentLoading: false,
      })
    } catch (err) {
      set({
        selectedDeploymentError:
          err instanceof Error
            ? err.message
            : "Failed to fetch deployment detail",
        selectedDeploymentLoading: false,
      })
    }
  },
}))
