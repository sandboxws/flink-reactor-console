import { create } from "zustand"
import {
  fetchJobHistory,
  type JobHistoryEntry,
  type JobHistoryPage,
} from "@/lib/graphql-api-client"

/**
 * Job history store — paginated historical job queries with filtering and sorting.
 *
 * Fetches job history from the Go GraphQL backend with cursor-based pagination.
 * Supports time range, state, name, and cluster filters with configurable sort
 * order. Changing any filter resets pagination to page 0.
 *
 * @module job-history-store
 */

/** Time range filter for job history queries. */
type TimeRange = "LAST_1H" | "LAST_2H" | "LAST_24H" | "LAST_7D" | "LAST_30D"
/** Sortable field for job history results. */
type OrderField = "START_TIME" | "END_TIME" | "DURATION" | "NAME" | "STATE"
/** Sort direction. */
type OrderDirection = "ASC" | "DESC"

interface JobHistoryState {
  /** Current page of job history entries. */
  entries: JobHistoryEntry[]
  /** Total number of matching entries across all pages. */
  totalCount: number
  /** Whether more pages are available after the current one. */
  hasNextPage: boolean
  /** Cursor for the end of the current page (used for forward pagination). */
  endCursor: string | null

  /** Active time range filter. */
  timeRange: TimeRange
  /** Filter to a specific cluster, or null for all. */
  clusterID: string | null
  /** Filter to a specific job state, or null for all. */
  stateFilter: string | null
  /** Filter by job name substring, or null for no filter. */
  nameFilter: string | null

  /** Current sort field. */
  orderField: OrderField
  /** Current sort direction (toggles on re-click of same field). */
  orderDirection: OrderDirection

  /** Number of entries per page. */
  pageSize: number
  /** Zero-based current page index. */
  currentPage: number
  /** Stack of cursors for previous pages (enables backward navigation). */
  cursors: string[]

  /** Whether a fetch is in progress. */
  isLoading: boolean
  /** Error from the most recent failed fetch. */
  error: string | null

  /** Fetch the current page with active filters and sort. */
  fetch: () => Promise<void>
  /** Change time range filter (resets pagination). */
  setTimeRange: (range: TimeRange) => void
  /** Change sort field (toggles direction if same field, resets pagination). */
  setOrderBy: (field: OrderField) => void
  /** Set the job name filter (resets pagination). */
  setNameFilter: (name: string | null) => void
  /** Set the state filter (resets pagination). */
  setStateFilter: (state: string | null) => void
  /** Set the cluster filter (resets pagination). */
  setClusterID: (id: string | null) => void
  /** Navigate to the next page. */
  nextPage: () => Promise<void>
  /** Navigate to the previous page. */
  prevPage: () => Promise<void>
  /** Reset pagination to page 0. */
  resetPagination: () => void
}

export const useJobHistoryStore = create<JobHistoryState>((set, get) => ({
  entries: [],
  totalCount: 0,
  hasNextPage: false,
  endCursor: null,

  timeRange: "LAST_24H",
  clusterID: null,
  stateFilter: null,
  nameFilter: null,

  orderField: "START_TIME",
  orderDirection: "DESC",

  pageSize: 20,
  currentPage: 0,
  cursors: [],

  isLoading: false,
  error: null,

  fetch: async () => {
    const state = get()
    set({ isLoading: true, error: null })
    try {
      const result: JobHistoryPage = await fetchJobHistory({
        filter: {
          timeRange: state.timeRange,
          clusterID: state.clusterID ?? undefined,
          state: state.stateFilter ?? undefined,
          name: state.nameFilter ?? undefined,
        },
        pagination: {
          first: state.pageSize,
          after:
            state.currentPage > 0 ? (state.endCursor ?? undefined) : undefined,
        },
        orderBy: {
          field: state.orderField,
          direction: state.orderDirection,
        },
      })
      set({
        entries: result.entries,
        totalCount: result.totalCount,
        hasNextPage: result.hasNextPage,
        endCursor: result.endCursor,
        isLoading: false,
      })
    } catch (err) {
      set({
        error:
          err instanceof Error ? err.message : "Failed to fetch job history",
        isLoading: false,
      })
    }
  },

  setTimeRange: (range) => {
    set({ timeRange: range, currentPage: 0, cursors: [], endCursor: null })
    get().fetch()
  },

  setOrderBy: (field) => {
    const state = get()
    const direction: OrderDirection =
      state.orderField === field
        ? state.orderDirection === "ASC"
          ? "DESC"
          : "ASC"
        : "DESC"
    set({
      orderField: field,
      orderDirection: direction,
      currentPage: 0,
      cursors: [],
      endCursor: null,
    })
    get().fetch()
  },

  setNameFilter: (name) => {
    set({ nameFilter: name, currentPage: 0, cursors: [], endCursor: null })
    get().fetch()
  },

  setStateFilter: (state) => {
    set({ stateFilter: state, currentPage: 0, cursors: [], endCursor: null })
    get().fetch()
  },

  setClusterID: (id) => {
    set({ clusterID: id, currentPage: 0, cursors: [], endCursor: null })
    get().fetch()
  },

  nextPage: async () => {
    const state = get()
    if (!state.hasNextPage || !state.endCursor) return
    set((s) => ({
      currentPage: s.currentPage + 1,
      cursors: [...s.cursors, s.endCursor ?? ""],
    }))
    const result = await fetchJobHistory({
      filter: {
        timeRange: state.timeRange,
        clusterID: state.clusterID ?? undefined,
        state: state.stateFilter ?? undefined,
        name: state.nameFilter ?? undefined,
      },
      pagination: {
        first: state.pageSize,
        after: state.endCursor ?? undefined,
      },
      orderBy: {
        field: state.orderField,
        direction: state.orderDirection,
      },
    })
    set({
      entries: result.entries,
      totalCount: result.totalCount,
      hasNextPage: result.hasNextPage,
      endCursor: result.endCursor,
      isLoading: false,
    })
  },

  prevPage: async () => {
    const state = get()
    if (state.currentPage <= 0) return
    const newCursors = [...state.cursors]
    newCursors.pop() // remove current page's cursor
    const prevCursor =
      newCursors.length > 0 ? newCursors[newCursors.length - 1] : undefined
    set({ currentPage: state.currentPage - 1, cursors: newCursors })
    const result = await fetchJobHistory({
      filter: {
        timeRange: state.timeRange,
        clusterID: state.clusterID ?? undefined,
        state: state.stateFilter ?? undefined,
        name: state.nameFilter ?? undefined,
      },
      pagination: {
        first: state.pageSize,
        after: prevCursor,
      },
      orderBy: {
        field: state.orderField,
        direction: state.orderDirection,
      },
    })
    set({
      entries: result.entries,
      totalCount: result.totalCount,
      hasNextPage: result.hasNextPage,
      endCursor: result.endCursor,
      isLoading: false,
    })
  },

  resetPagination: () => {
    set({ currentPage: 0, cursors: [], endCursor: null })
  },
}))
