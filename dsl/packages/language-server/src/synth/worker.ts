// Synthesis isolation worker.
//
// Runs `synthesizeDocument` in a separate thread so a throwing, infinite-
// looping, or memory-hungry user pipeline degrades to a terminated worker
// (which the host respawns) instead of taking down the server. Communicates
// over the worker message channel with id-correlated request/response frames.

import { parentPort } from "node:worker_threads"
import { synthesizeDocument } from "./runner.js"
import type { SynthesisInput } from "./types.js"

interface WorkerRequest {
  readonly id: number
  readonly input: SynthesisInput
}

if (!parentPort) {
  throw new Error("worker.ts must be run as a worker thread")
}

const port = parentPort

port.on("message", (msg: WorkerRequest) => {
  // `synthesizeDocument` is designed not to throw, but guard anyway so a
  // truly unexpected failure still produces a response frame.
  synthesizeDocument(msg.input)
    .then((result) => {
      port.postMessage({ id: msg.id, result })
    })
    .catch((err: unknown) => {
      port.postMessage({
        id: msg.id,
        error: {
          message: err instanceof Error ? err.message : String(err),
          stack: err instanceof Error ? err.stack : undefined,
        },
      })
    })
})
