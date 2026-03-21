import { TextViewer } from "@flink-reactor/ui"

// ---------------------------------------------------------------------------
// TmStdoutTab — renders TM stdout using the shared text-viewer
// ---------------------------------------------------------------------------

export function TmStdoutTab({ stdout }: { stdout: string }) {
  return (
    <div className="pt-4">
      <TextViewer text={stdout} />
    </div>
  )
}
