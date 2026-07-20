// A stand-in for the real synthesis worker, used by isolated-runner.test.ts to
// exercise the boot-grace / timeout logic deterministically without loading the
// DSL. It echoes back a trivial result after `input.delayMs`, so a test can make
// a "synthesis" appear to take a controlled amount of wall-clock time.
import { parentPort } from "node:worker_threads"

if (!parentPort) throw new Error("must run as a worker thread")

parentPort.on("message", ({ id, input }) => {
  const delay = input?.delayMs || 0
  setTimeout(() => {
    parentPort.postMessage({ id, result: { ok: true, statements: [] } })
  }, delay)
})
