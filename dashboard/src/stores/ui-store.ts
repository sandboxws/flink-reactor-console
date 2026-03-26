import { create } from "zustand"
import type { TIMESTAMP_FORMATS } from "@/lib/constants"

/**
 * UI store — global UI state for sidebar, detail panel, command palette,
 * theme, color palette, and timestamp format preferences.
 *
 * Theme and palette selections are persisted to localStorage and applied to
 * the document root element via CSS class (theme) and data attribute (palette).
 *
 * @module ui-store
 */

/** Timestamp display format key from the TIMESTAMP_FORMATS constant. */
type TimestampFormat = keyof typeof TIMESTAMP_FORMATS

/** Color scheme: dark or light mode. */
export type Theme = "dark" | "light"
/** Color palette: Gruvpuccin (default, no data attribute) or Tokyo Night. */
export type Palette = "tokyo-night" | "gruvpuccin"

const THEME_STORAGE_KEY = "fr-theme"
const PALETTE_STORAGE_KEY = "fr-palette"

/** Read persisted theme from localStorage, defaulting to "dark". */
function getStoredTheme(): Theme {
  if (typeof window === "undefined") return "dark"
  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY)
    if (stored === "light" || stored === "dark") return stored
  } catch {
    // localStorage may be unavailable
  }
  return "dark"
}

/** Read persisted palette from localStorage, defaulting to "gruvpuccin". */
function getStoredPalette(): Palette {
  if (typeof window === "undefined") return "gruvpuccin"
  try {
    const stored = localStorage.getItem(PALETTE_STORAGE_KEY)
    if (stored === "tokyo-night" || stored === "gruvpuccin") return stored
  } catch {
    // localStorage may be unavailable
  }
  return "gruvpuccin"
}

/** Apply theme to the document root element and persist to localStorage. */
function applyTheme(theme: Theme) {
  if (typeof document === "undefined") return
  const root = document.documentElement
  root.classList.remove("dark", "light")
  root.classList.add(theme)
  try {
    localStorage.setItem(THEME_STORAGE_KEY, theme)
  } catch {
    // localStorage may be unavailable
  }
}

/** Apply palette to the document root via data attribute and persist to localStorage. */
function applyPalette(palette: Palette) {
  if (typeof document === "undefined") return
  if (palette === "gruvpuccin") {
    delete document.documentElement.dataset.palette
  } else {
    document.documentElement.dataset.palette = palette
  }
  try {
    localStorage.setItem(PALETTE_STORAGE_KEY, palette)
  } catch {
    // localStorage may be unavailable
  }
}

interface UiState {
  /** Whether the navigation sidebar is collapsed. */
  sidebarCollapsed: boolean
  /** Whether the log/error detail panel is open. */
  detailPanelOpen: boolean
  /** ID of the selected log/error entry for the detail panel. */
  selectedEntryId: string | null
  /** Whether the command palette overlay is open. */
  commandPaletteOpen: boolean
  /** Current timestamp display format for log entries. */
  timestampFormat: TimestampFormat
  /** Current color scheme (dark/light). */
  theme: Theme
  /** Current color palette (Gruvpuccin or Tokyo Night). */
  palette: Palette
}

interface UiActions {
  /** Toggle the sidebar collapsed/expanded state. */
  toggleSidebar: () => void
  /** Explicitly set the sidebar collapsed state. */
  setSidebarCollapsed: (collapsed: boolean) => void
  /** Toggle the detail panel open/closed. */
  toggleDetailPanel: () => void
  /** Explicitly set the detail panel open state. */
  setDetailPanelOpen: (open: boolean) => void
  /** Select a log/error entry (auto-opens the detail panel). */
  setSelectedEntryId: (id: string | null) => void
  /** Toggle the command palette overlay. */
  toggleCommandPalette: () => void
  /** Change the timestamp display format. */
  setTimestampFormat: (format: TimestampFormat) => void
  /** Toggle between dark and light theme (persists to localStorage). */
  toggleTheme: () => void
  /** Set the color palette (persists to localStorage). */
  setPalette: (palette: Palette) => void
}

export type UiStore = UiState & UiActions

export const useUiStore = create<UiStore>((set) => ({
  sidebarCollapsed: false,
  detailPanelOpen: false,
  selectedEntryId: null,
  commandPaletteOpen: false,
  timestampFormat: "time",
  theme: getStoredTheme(),
  palette: getStoredPalette(),

  toggleSidebar: () => {
    set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed }))
  },

  setSidebarCollapsed: (collapsed: boolean) => {
    set({ sidebarCollapsed: collapsed })
  },

  toggleDetailPanel: () => {
    set((state) => ({ detailPanelOpen: !state.detailPanelOpen }))
  },

  setDetailPanelOpen: (open: boolean) => {
    set({ detailPanelOpen: open })
  },

  setSelectedEntryId: (id: string | null) => {
    set({ selectedEntryId: id, detailPanelOpen: id !== null })
  },

  toggleCommandPalette: () => {
    set((state) => ({ commandPaletteOpen: !state.commandPaletteOpen }))
  },

  setTimestampFormat: (format: TimestampFormat) => {
    set({ timestampFormat: format })
  },

  toggleTheme: () => {
    set((state) => {
      const next: Theme = state.theme === "dark" ? "light" : "dark"
      applyTheme(next)
      return { theme: next }
    })
  },

  setPalette: (palette: Palette) => {
    applyPalette(palette)
    set({ palette })
  },
}))
