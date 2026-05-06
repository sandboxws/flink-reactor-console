/*
 * Tailwind v3 CDN config — registers the FR/Gruvpuccin palette + custom max-widths.
 * Loaded BEFORE Tailwind itself so utility classes resolve correctly.
 *
 * Pulled from packages/ui/src/styles/tokens.css and the
 * flink-reactor-hub.html demo. Keep in sync with shared/styles.css.
 */

tailwind.config = {
  darkMode: "class",
  theme: {
    extend: {
      fontFamily: {
        sans: ["Geist", "system-ui", "sans-serif"],
        mono: ['"Geist Mono"', "ui-monospace", "monospace"],
      },
      maxWidth: {
        page: "1400px",
        "page-wide": "1680px",
        "page-narrow": "1120px",
      },
      // Override Tailwind preflight default (rgb(229,231,235), bright gray)
      // so any `border` / `border-{side}` without an explicit color resolves
      // to our warm dark separator, matching the Gruvpuccin theme.
      borderColor: {
        DEFAULT: "#2e2c2b",
      },
      divideColor: {
        DEFAULT: "#2e2c2b",
      },
      ringColor: {
        DEFAULT: "rgba(231, 138, 78, 0.4)",
      },
      colors: {
        // Page surfaces
        "fr-bg":          "#101213",
        "fr-subtle":      "#141617",
        "dash-surface":   "#141617",
        "dash-panel":     "#181a1b",
        "dash-elevated":  "#242424",
        "dash-border":    "#2e2c2b",
        "dash-hover":     "#242424",

        // FR brand accents
        "fr-coral":       "#e78a4e",
        "fr-sage":        "#a9b665",
        "fr-amber":       "#d8a657",
        "fr-teal":        "#7daea3",
        "fr-rose":        "#ea6962",
        "fr-violet":      "#bb9af7",

        // Job status (semantic mapping)
        "job-running":    "#a9b665",
        "job-finished":   "#7daea3",
        "job-cancelled":  "#d8a657",
        "job-failed":     "#ea6962",

        // Foreground (Gruvpuccin warm earth tones)
        fg:               "#d4be98",
        "fg-secondary":   "#bfb3a2",
        "fg-muted":       "#a69a8a",
        "fg-dim":         "#7c7269",
        "fg-faint":       "#5a524c",

        // Heatmap levels (mirrors hm-0..hm-4 in styles.css)
        "hm-0":           "rgba(212,190,152,0.04)",
        "hm-1":           "rgba(125,174,163,0.35)",
        "hm-2":           "rgba(169,182,101,0.55)",
        "hm-3":           "rgba(216,166,87,0.75)",
        "hm-4":           "rgba(231,138,78,0.95)",
      },
    },
  },
};
