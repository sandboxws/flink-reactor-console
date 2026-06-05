// Pipeline identity from a file path (cli-lifecycle-integration §5). Pure
// (no `vscode` import) so the unit suite can pin it; the CodeLens provider
// and the palette commands both derive `-p <name>` from it.

import { basename, dirname, sep } from "node:path"

/** `pipelines/<name>/index.tsx` → `<name>`; `undefined` for anything else. */
export function pipelineNameFor(fsPath: string): string | undefined {
  if (basename(fsPath) !== "index.tsx") return undefined
  const pipelineDir = dirname(fsPath)
  const parent = dirname(pipelineDir)
  if (basename(parent) !== "pipelines") return undefined
  const name = basename(pipelineDir)
  return name.length > 0 && !name.includes(sep) ? name : undefined
}
