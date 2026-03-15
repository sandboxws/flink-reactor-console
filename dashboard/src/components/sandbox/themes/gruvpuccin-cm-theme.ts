import { EditorView } from "@codemirror/view"
import { HighlightStyle, syntaxHighlighting } from "@codemirror/language"
import { tags } from "@lezer/highlight"

const gruvpuccinTheme = EditorView.theme(
  {
    "&": {
      backgroundColor: "transparent",
      color: "#ebdbb2",
      fontFamily: "var(--font-mono)",
    },
    ".cm-content": {
      caretColor: "#ebdbb2",
    },
    ".cm-cursor, .cm-dropCursor": {
      borderLeftColor: "#ebdbb2",
    },
    "&.cm-focused .cm-selectionBackground, .cm-selectionBackground, .cm-content ::selection":
      {
        backgroundColor: "rgba(212, 190, 152, 0.15)",
      },
    ".cm-gutters": {
      backgroundColor: "transparent",
      color: "#665c54",
      borderRight: "none",
    },
    ".cm-activeLineGutter": {
      backgroundColor: "transparent",
      color: "#928374",
    },
    ".cm-activeLine": {
      backgroundColor: "rgba(212, 190, 152, 0.06)",
    },
    ".cm-matchingBracket": {
      backgroundColor: "rgba(212, 190, 152, 0.2)",
      outline: "none",
    },
  },
  { dark: true },
)

const gruvpuccinHighlighting = HighlightStyle.define([
  { tag: tags.keyword, color: "#fb4934" },
  { tag: tags.operator, color: "#fe8019" },
  { tag: tags.variableName, color: "#ebdbb2" },
  { tag: [tags.string, tags.special(tags.brace)], color: "#b8bb26" },
  { tag: tags.number, color: "#d3869b" },
  { tag: tags.bool, color: "#d3869b" },
  { tag: tags.null, color: "#d3869b" },
  { tag: tags.function(tags.variableName), color: "#fabd2f" },
  { tag: tags.typeName, color: "#8ec07c" },
  { tag: tags.className, color: "#8ec07c" },
  { tag: tags.definition(tags.variableName), color: "#83a598" },
  { tag: tags.propertyName, color: "#83a598" },
  { tag: tags.comment, color: "#928374", fontStyle: "italic" },
  { tag: tags.meta, color: "#928374" },
  { tag: tags.tagName, color: "#8ec07c" },
  { tag: tags.attributeName, color: "#fabd2f" },
  { tag: tags.attributeValue, color: "#b8bb26" },
  { tag: tags.angleBracket, color: "#a89984" },
])

export const gruvpuccinCmTheme = [
  gruvpuccinTheme,
  syntaxHighlighting(gruvpuccinHighlighting),
]
