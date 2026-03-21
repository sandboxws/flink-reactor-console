import { create } from "zustand"
import {
  fetchJobHistory,
  type JobHistoryEntry,
  type JobHistoryPage,
} from "@/lib/graphql-api-client"

// ---------------------------------------------------------------------------
// Job History store — unified historical + live job queries
// ---------------------------------------------------------------------------

type TimeRange = "LAST_1H" | "LAST_2H" | "LAST_24H" | "LAST_7D" | "LAST_30D"
type OrderField = "START_TIME" | "END_TIME" | "DURATION" | "NAME" | "STATE"
type OrderDirection = "ASC" | "DESC"

interface JobHistoryState {
  // Data
  entries: JobHistoryEntry[]
  totalCount: number
  hasNextPage: boolean
  endCursor: string | null

  // Filter
  timeRange: TimeRange
  clusterID: string | null
  stateFilter: string | null
  nameFilter: string | null

  // Sort
  orderField: OrderField
  orderDirection: OrderDirection

  // Pagination
  pageSize: number
  currentPage: number
  cursors: string[] // stack of cursors for previous pages

  // Loading
  isLoading: boolean
  error: string | null

  // Actions
  fetch: () => Promise<void>
  setTimeRange: (range: TimeRange) => void
  setOrderBy: (field: OrderField) => void
  setNameFilter: (name: string | null) => void
  setStateFilter: (state: string | null) => void
  setClusterID: (id: string | null) => void
  nextPage: () => Promise<void>
  prevPage: () => Promise<void>
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
