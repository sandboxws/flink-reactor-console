import type {
  ClasspathEntry,
  JobManagerConfig,
  JvmInfo,
} from "@flink-reactor/ui"
import { JmClasspathSectionHub } from "./jm-classpath-section-hub"
import { JmConfigSectionHub } from "./jm-config-section-hub"
import { JmJvmSectionHub } from "./jm-jvm-section-hub"

export function JmConfigTabHub({
  config,
  jvm,
  classpath,
}: {
  config: JobManagerConfig[]
  jvm: JvmInfo
  classpath: ClasspathEntry[]
}) {
  return (
    <div className="flex flex-col gap-6">
      <JmConfigSectionHub config={config} />
      <JmJvmSectionHub jvm={jvm} />
      <JmClasspathSectionHub classpath={classpath} />
    </div>
  )
}
