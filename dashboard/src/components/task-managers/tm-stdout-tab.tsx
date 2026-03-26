/**
 * @module tm-stdout-tab
 *
 * Task manager stdout output tab, rendering raw standard output text
 * through the shared {@link TextViewer} component.
 */
import { TextViewer } from "@flink-reactor/ui"

// ---------------------------------------------------------------------------
// TmStdoutTab — renders TM stdout using the shared text-viewer
// ---------------------------------------------------------------------------

/**
 * Renders pre-fetched task manager stdout content using the shared
 * {@link TextViewer}, which provides monospace formatting, line numbers,
 * and copy-to-clipboard functionality.
 */
export function TmStdoutTab({ stdout }: { stdout: string }) {
  return (
    <div className="pt-4">
      <TextViewer text={stdout} />
    </div>
  )
}
