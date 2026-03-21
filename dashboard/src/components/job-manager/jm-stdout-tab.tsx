import { TextViewer } from "@flink-reactor/ui"

// ---------------------------------------------------------------------------
// JmStdoutTab — renders JM stdout using the shared text-viewer
// ---------------------------------------------------------------------------

export function JmStdoutTab({ stdout }: { stdout: string }) {
  return (
    <div className="pt-4">
      <TextViewer text={stdout} />
    </div>
  )
}
