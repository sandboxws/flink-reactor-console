import { EditorView } from "@codemirror/view"
import { HighlightStyle, syntaxHighlighting } from "@codemirror/language"
import { tags } from "@lezer/highlight"

const tokyoNightTheme = EditorView.theme(
  {
    "&": {
      backgroundColor: "transparent",
      color: "#a9b1d6",
      fontFamily: "var(--font-mono)",
    },
    ".cm-content": {
      caretColor: "#a9b1d6",
    },
    ".cm-cursor, .cm-dropCursor": {
      borderLeftColor: "#a9b1d6",
    },
    "&.cm-focused .cm-selectionBackground, .cm-selectionBackground, .cm-content ::selection":
      {
        backgroundColor: "rgba(122, 162, 247, 0.15)",
      },
    ".cm-gutters": {
      backgroundColor: "transparent",
      color: "#3b4261",
      borderRight: "none",
    },
    ".cm-activeLineGutter": {
      backgroundColor: "transparent",
      color: "#565f89",
    },
    ".cm-activeLine": {
      backgroundColor: "rgba(122, 162, 247, 0.06)",
    },
    ".cm-matchingBracket": {
      backgroundColor: "rgba(122, 162, 247, 0.2)",
      outline: "none",
    },
    ".cm-tooltip": {
      backgroundColor: "#1a1b26",
      border: "1px solid #292e42",
      borderRadius: "6px",
      boxShadow: "0 4px 16px rgba(0, 0, 0, 0.4)",
    },
    ".cm-tooltip-autocomplete": {
      "& > ul": {
        fontFamily: "var(--font-mono)",
        fontSize: "12px",
        maxHeight: "220px",
      },
      "& > ul > li": {
        padding: "3px 8px",
        lineHeight: "1.4",
      },
      "& > ul > li[aria-selected]": {
        backgroundColor: "rgba(122, 162, 247, 0.15)",
        color: "#c0caf5",
      },
    },
    ".cm-completionLabel": {
      color: "#a9b1d6",
    },
    ".cm-completionDetail": {
      color: "#565f89",
      fontStyle: "italic",
      marginLeft: "8px",
    },
    ".cm-completionInfo": {
      backgroundColor: "#1a1b26",
      border: "1px solid #292e42",
      borderRadius: "6px",
      padding: "6px 10px",
      color: "#9aa5ce",
      fontSize: "11px",
      lineHeight: "1.5",
      maxWidth: "320px",
    },
    ".cm-completionMatchedText": {
      color: "#7aa2f7",
      textDecoration: "none",
      fontWeight: "600",
    },
  },
  { dark: true },
)

const tokyoNightHighlighting = HighlightStyle.define([
  { tag: tags.keyword, color: "#bb9af7" },
  { tag: tags.operator, color: "#89ddff" },
  { tag: tags.variableName, color: "#a9b1d6" },
  { tag: [tags.string, tags.special(tags.brace)], color: "#9ece6a" },
  { tag: tags.number, color: "#ff9e64" },
  { tag: tags.bool, color: "#ff9e64" },
  { tag: tags.null, color: "#ff9e64" },
  { tag: tags.function(tags.variableName), color: "#7aa2f7" },
  { tag: tags.typeName, color: "#2ac3de" },
  { tag: tags.className, color: "#2ac3de" },
  { tag: tags.definition(tags.variableName), color: "#7dcfff" },
  { tag: tags.propertyName, color: "#7dcfff" },
  { tag: tags.comment, color: "#565f89", fontStyle: "italic" },
  { tag: tags.meta, color: "#565f89" },
  { tag: tags.tagName, color: "#f7768e" },
  { tag: tags.attributeName, color: "#bb9af7" },
  { tag: tags.attributeValue, color: "#9ece6a" },
  { tag: tags.angleBracket, color: "#89ddff" },
])

export const tokyoNightCmTheme = [
  tokyoNightTheme,
  syntaxHighlighting(tokyoNightHighlighting),
]
