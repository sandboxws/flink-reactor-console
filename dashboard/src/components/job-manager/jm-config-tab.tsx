/**
 * @module jm-config-tab
 *
 * Composition root for the Job Manager "Configuration" tab. Stacks
 * three sections vertically: key-value configuration, JVM details,
 * and classpath entries.
 */

import type {
  ClasspathEntry,
  JobManagerConfig,
  JvmInfo,
} from "@flink-reactor/ui"
import { JmClasspathSection } from "./jm-classpath-section"
import { JmConfigSection } from "./jm-config-section"
import { JmJvmSection } from "./jm-jvm-section"

/**
 * Configuration tab layout composing {@link JmConfigSection},
 * {@link JmJvmSection}, and {@link JmClasspathSection} in a vertical stack.
 */
export function JmConfigTab({
  config,
  jvm,
  classpath,
}: {
  config: JobManagerConfig[]
  jvm: JvmInfo
  classpath: ClasspathEntry[]
}) {
  return (
    <div className="flex flex-col gap-4 pt-4">
      <JmConfigSection config={config} />
      <JmJvmSection jvm={jvm} />
      <JmClasspathSection classpath={classpath} />
    </div>
  )
}
