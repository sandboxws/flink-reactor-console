import { create } from "zustand";
import type { TIMESTAMP_FORMATS } from "@/lib/constants";

// ---------------------------------------------------------------------------
// UI store — sidebar, panels, preferences
// ---------------------------------------------------------------------------

type TimestampFormat = keyof typeof TIMESTAMP_FORMATS;

interface UiState {
  sidebarCollapsed: boolean;
  detailPanelOpen: boolean;
  selectedEntryId: string | null;
  commandPaletteOpen: boolean;
  timestampFormat: TimestampFormat;
}

interface UiActions {
  toggleSidebar: () => void;
  setSidebarCollapsed: (collapsed: boolean) => void;
  toggleDetailPanel: () => void;
  setDetailPanelOpen: (open: boolean) => void;
  setSelectedEntryId: (id: string | null) => void;
  toggleCommandPalette: () => void;
  setTimestampFormat: (format: TimestampFormat) => void;
}

export type UiStore = UiState & UiActions;

export const useUiStore = create<UiStore>((set) => ({
  sidebarCollapsed: false,
  detailPanelOpen: false,
  selectedEntryId: null,
  commandPaletteOpen: false,
  timestampFormat: "time",

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
}));
