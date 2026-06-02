import type { PositionMap } from "./mappers/source-position-mapper.js"
import type { SynthesisResult } from "./synth/types.js"

/** The shared per-document synthesis state every provider reads from, so that
 *  diagnostics, hover, completion, etc. all see the same result + source map
 *  for a given document version (spec: "Synthesis result is shared across
 *  providers"). */
export interface DocumentSynthState {
  readonly uri: string
  readonly version: number
  readonly result: SynthesisResult
  readonly positionMap: PositionMap
}

/** Process-wide store of the latest synthesis state per open document. */
export class DocumentStateStore {
  private readonly states = new Map<string, DocumentSynthState>()

  set(state: DocumentSynthState): void {
    this.states.set(state.uri, state)
  }

  get(uri: string): DocumentSynthState | undefined {
    return this.states.get(uri)
  }

  delete(uri: string): void {
    this.states.delete(uri)
  }

  clear(): void {
    this.states.clear()
  }
}
