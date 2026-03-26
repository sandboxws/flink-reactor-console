/** Vite client type declarations for import.meta.env. */
/// <reference types="vite/client" />

/** Environment variables available via import.meta.env in the dashboard. */
interface ImportMetaEnv {
  readonly VITE_GRAPHQL_URL: string
  readonly VITE_THEME?: string
  readonly VITE_ACCENT_COLOR?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
