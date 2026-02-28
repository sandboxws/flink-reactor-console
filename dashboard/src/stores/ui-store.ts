import { create } from "zustand";
import type { TIMESTAMP_FORMATS } from "@/lib/constants";

// ---------------------------------------------------------------------------
// UI store — sidebar, panels, preferences, theme, palette
// ---------------------------------------------------------------------------

type TimestampFormat = keyof typeof TIMESTAMP_FORMATS;

export type Theme = "dark" | "light";
export type Palette = "tokyo-night" | "gruvpuccin";

const THEME_STORAGE_KEY = "fr-theme";
const PALETTE_STORAGE_KEY = "fr-palette";

function getStoredTheme(): Theme {
  if (typeof window === "undefined") return "dark";
  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    if (stored === "light" || stored === "dark") return stored;
  } catch {
    // localStorage may be unavailable
  }
  return "dark";
}

function getStoredPalette(): Palette {
  if (typeof window === "undefined") return "tokyo-night";
  try {
    const stored = localStorage.getItem(PALETTE_STORAGE_KEY);
    if (stored === "tokyo-night" || stored === "gruvpuccin") return stored;
  } catch {
    // localStorage may be unavailable
  }
  return "tokyo-night";
}

function applyTheme(theme: Theme) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  root.classList.remove("dark", "light");
  root.classList.add(theme);
  try {
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    // localStorage may be unavailable
  }
}

function applyPalette(palette: Palette) {
  if (typeof document === "undefined") return;
  document.documentElement.dataset.palette = palette;
  try {
    localStorage.setItem(PALETTE_STORAGE_KEY, palette);
  } catch {
    // localStorage may be unavailable
  }
}

interface UiState {
  sidebarCollapsed: boolean;
  detailPanelOpen: boolean;
  selectedEntryId: string | null;
  commandPaletteOpen: boolean;
  timestampFormat: TimestampFormat;
  theme: Theme;
  palette: Palette;
}

interface UiActions {
  toggleSidebar: () => void;
  setSidebarCollapsed: (collapsed: boolean) => void;
  toggleDetailPanel: () => void;
  setDetailPanelOpen: (open: boolean) => void;
  setSelectedEntryId: (id: string | null) => void;
  toggleCommandPalette: () => void;
  setTimestampFormat: (format: TimestampFormat) => void;
  toggleTheme: () => void;
  setPalette: (palette: Palette) => void;
}

export type UiStore = UiState & UiActions;

export const useUiStore = create<UiStore>((set) => ({
  sidebarCollapsed: false,
  detailPanelOpen: false,
  selectedEntryId: null,
  commandPaletteOpen: false,
  timestampFormat: "time",
  theme: getStoredTheme(),
  palette: getStoredPalette(),

  toggleSidebar: () => {
    set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed }));
  },

  setSidebarCollapsed: (collapsed: boolean) => {
    set({ sidebarCollapsed: collapsed });
  },

  toggleDetailPanel: () => {
    set((state) => ({ detailPanelOpen: !state.detailPanelOpen }));
  },

  setDetailPanelOpen: (open: boolean) => {
    set({ detailPanelOpen: open });
  },

  setSelectedEntryId: (id: string | null) => {
    set({ selectedEntryId: id, detailPanelOpen: id !== null });
  },

  toggleCommandPalette: () => {
    set((state) => ({ commandPaletteOpen: !state.commandPaletteOpen }));
  },

  setTimestampFormat: (format: TimestampFormat) => {
    set({ timestampFormat: format });
  },

  toggleTheme: () => {
    set((state) => {
      const next: Theme = state.theme === "dark" ? "light" : "dark";
      applyTheme(next);
      return { theme: next };
    });
  },

  setPalette: (palette: Palette) => {
    applyPalette(palette);
    set({ palette });
  },
}));
