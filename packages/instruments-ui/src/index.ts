// Init
export { initInstrumentsUI } from "./init"

// Types
export type {
  InstrumentInfo,
  InstrumentType,
  InstrumentCapability,
  DatabaseSchema,
  DatabaseTableSummary,
  DatabaseTableDetail,
  DatabaseColumn,
  DatabaseIndex,
  DatabaseConstraint,
  DatabaseQueryResult,
  DatabaseQueryHistoryEntry,
} from "./types"

// Store
export { useInstrumentStore } from "./store"

// API
export {
  fetchInstruments,
  fetchDatabaseSchemas,
  fetchDatabaseTables,
  fetchDatabaseTable,
  fetchDatabaseQueryHistory,
  executeDatabaseQuery,
} from "./api"

// Components
export { InstrumentSidebarSection } from "./components/instrument-sidebar-section"
export { getInstrumentIcon } from "./components/instrument-icons"
export { InstrumentCard } from "./components/instrument-card"
export { InstrumentListPage } from "./components/instrument-list-page"
export { InstrumentShell } from "./components/instrument-shell"
export { InstrumentHealthBadge } from "./components/instrument-health-badge"

// Route components (plain React, receive props)
export { InstrumentsIndexRoute } from "./routes/instruments-index"
export { InstrumentDetailRoute } from "./routes/instrument-detail"
export { DatabaseSchemasRoute } from "./routes/database-schemas"
export { DatabaseQueryRoute } from "./routes/database-query"
export { DatabaseTableRoute } from "./routes/database-table"
