import { Compartment } from "@codemirror/state"
import type { EditorView } from "@codemirror/view"
import { useEffect } from "react"
import { gruvpuccinCmTheme } from "./gruvpuccin-cm-theme"
import { tokyoNightCmTheme } from "./tokyo-night-cm-theme"

/** Returns the CodeMirror theme matching the current palette. */
export function getActiveTheme() {
  if (typeof document === "undefined") return gruvpuccinCmTheme
  return document.documentElement.dataset.palette === "tokyo-night"
    ? tokyoNightCmTheme
    : gruvpuccinCmTheme
}

/** Factory — each EditorState needs its own Compartment instance. */
export function createThemeCompartment() {
  return new Compartment()
}

/**
 * Observes `data-palette` mutations on `<html>` and reconfigures
 * the given theme compartment on the referenced EditorView.
 */
export function useCmPaletteObserver(
  viewRef: React.RefObject<EditorView | null>,
  themeCompartment: Compartment,
) {
  useEffect(() => {
    const observer = new MutationObserver(() => {
      const view = viewRef.current
      if (!view) return
      view.dispatch({
        effects: themeCompartment.reconfigure(getActiveTheme()),
      })
    })
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-palette"],
    })
    return () => observer.disconnect()
  }, [viewRef, themeCompartment])
}
