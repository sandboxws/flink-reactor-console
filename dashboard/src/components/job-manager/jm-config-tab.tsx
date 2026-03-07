import type {
  ClasspathEntry,
  JobManagerConfig,
  JvmInfo,
} from "@/data/cluster-types"
import { JmClasspathSection } from "./jm-classpath-section"
import { JmConfigSection } from "./jm-config-section"
import { JmJvmSection } from "./jm-jvm-section"

// ---------------------------------------------------------------------------
// JmConfigTab — composes three sections: Configurations, JVM, Classpath
// ---------------------------------------------------------------------------

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
