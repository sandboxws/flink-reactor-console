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
