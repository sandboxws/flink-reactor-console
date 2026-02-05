import { readFileSync } from "node:fs";
import { relative } from "node:path";
import type { ContentChunk } from "../types.js";

/**
 * Extract semantic chunks from CSS files.
 *
 * We split by section comments (/* ── Section name ──... *​/) and treat
 * each section as a separate chunk. This matches the conventions in
 * tokens.css and components.css.
 */
export function extractStyleChunks(
  absolutePath: string,
  repoRoot: string,
): ContentChunk[] {
  const content = readFileSync(absolutePath, "utf-8");
  const relPath = relative(repoRoot, absolutePath);
  const chunks: ContentChunk[] = [];

  // Split by section header comments: /* ── Section Name ── */
  const sectionRe = /\/\*\s*──\s*(.+?)\s*──+\s*\*\//g;
  const sections: Array<{ name: string; start: number }> = [];
  let match: RegExpExecArray | null;

  while ((match = sectionRe.exec(content)) !== null) {
    sections.push({ name: match[1].trim(), start: match.index });
  }

  if (sections.length === 0) {
    // No section headers — treat entire file as one chunk
    if (content.trim().length > 20) {
      chunks.push({
        id: slugify(relPath),
        type: "css-tokens",
        content: content.trim(),
        path: relPath,
        metadata: {},
      });
    }
    return chunks;
  }

  for (let i = 0; i < sections.length; i++) {
    const section = sections[i];
    const end = i + 1 < sections.length ? sections[i + 1].start : content.length;
    const sectionContent = content.slice(section.start, end).trim();

    if (sectionContent.length < 20) continue;

    // Detect chunk type based on content
    const hasCustomProperties = sectionContent.includes("--color-") || sectionContent.includes("--font-");
    const chunkType = hasCustomProperties ? "css-tokens" as const : "css-class" as const;

    chunks.push({
      id: `${slugify(relPath)}-${slugify(section.name)}`,
      type: chunkType,
      content: sectionContent,
      path: relPath,
      metadata: { sectionName: section.name },
    });
  }

  return chunks;
}

/** Convert "src/styles/tokens.css" → "styles-tokens" */
function slugify(input: string): string {
  return input
    .replace(/^.*?src\//, "")
    .replace(/\.[^.]+$/, "")
    .replace(/[/\\]/g, "-")
    .replace(/[^a-z0-9-]/gi, "")
    .toLowerCase();
}
