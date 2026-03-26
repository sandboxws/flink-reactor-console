/**
 * @module jm-stdout-tab
 *
 * Job Manager stdout output tab. Delegates rendering to the shared
 * {@link TextViewer} component which provides line numbers and copy support.
 */

import { TextViewer } from "@flink-reactor/ui"

/** Renders Job Manager stdout content using the shared {@link TextViewer}. */
export function JmStdoutTab({ stdout }: { stdout: string }) {
  return (
    <div className="pt-4">
      <TextViewer text={stdout} />
    </div>
  )
}
