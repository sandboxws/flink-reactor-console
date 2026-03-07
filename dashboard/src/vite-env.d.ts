/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_GRAPHQL_URL: string
  readonly VITE_THEME?: string
  readonly VITE_ACCENT_COLOR?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
