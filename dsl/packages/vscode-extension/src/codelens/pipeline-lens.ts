// Per-pipeline CodeLens (cli-lifecycle-integration §5): one lens row at the
// top of every `pipelines/*/index.tsx` — `▶ Synth · Validate · Graph ·
// Deploy · Run tests` — each invoking the corresponding command SCOPED to
// that pipeline. The pipeline identity is unambiguous from the path
// (`pipelines/<name>/index.tsx` → `<name>`), so no prompt is ever needed;
// non-entry-point `.tsx` files (components, schemas) get no lens.

import * as vscode from "vscode"
import { pipelineNameFor } from "./pipeline-name.js"

export { pipelineNameFor }

interface LensSpec {
  readonly title: string
  readonly command: string
}

const LENSES: readonly LensSpec[] = [
  { title: "$(play) Synth", command: "flinkReactor.synth" },
  { title: "Validate", command: "flinkReactor.validate" },
  { title: "Graph", command: "flinkReactor.graph" },
  { title: "Deploy", command: "flinkReactor.deploy" },
  { title: "Run tests", command: "flinkReactor.runPipelineTests" },
]

export class PipelineLensProvider implements vscode.CodeLensProvider {
  constructor(private readonly isInProject: (fsPath: string) => boolean) {}

  provideCodeLenses(document: vscode.TextDocument): vscode.CodeLens[] {
    const pipeline = pipelineNameFor(document.uri.fsPath)
    if (!pipeline) return []
    if (!this.isInProject(document.uri.fsPath)) return []
    const topOfFile = new vscode.Range(0, 0, 0, 0)
    return LENSES.map(
      (lens) =>
        new vscode.CodeLens(topOfFile, {
          title: lens.title,
          command: lens.command,
          // Each command accepts an optional pipeline argument — the lens
          // passes the path-derived name so no quick pick is shown.
          arguments: [pipeline],
        }),
    )
  }
}
