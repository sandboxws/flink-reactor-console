import type { JvmInfo } from "@flink-reactor/ui"
import { formatBytes } from "@flink-reactor/ui"
import { Cpu, Database, Terminal } from "lucide-react"
import { ConfigValue } from "./config-value"

function pct(used: number, max: number): number {
  if (max === 0) return 0
  return Math.min(100, Math.round((used / max) * 100))
}

function JvmArg({ arg }: { arg: string }) {
  if (arg.startsWith("-XX:")) {
    return (
      <span>
        <span className="text-fr-purple">-XX:</span>
        <span className="text-fg">{arg.slice(4)}</span>
      </span>
    )
  }
  if (arg.startsWith("-Xm") || arg.startsWith("-Xss")) {
    return (
      <span>
        <span className="text-fr-coral">{arg.slice(0, 4)}</span>
        <span className="text-fg">{arg.slice(4)}</span>
      </span>
    )
  }
  if (arg.startsWith("-D")) {
    const eqIdx = arg.indexOf("=")
    if (eqIdx > 0) {
      return (
        <span>
          <span className="text-log-info">-D</span>
          <span className="text-fg">{arg.slice(2, eqIdx)}</span>
          <span className="text-fg-faint">=</span>
          <span className="text-fg-muted">{arg.slice(eqIdx + 1)}</span>
        </span>
      )
    }
    return (
      <span>
        <span className="text-log-info">-D</span>
        <span className="text-fg">{arg.slice(2)}</span>
      </span>
    )
  }
  return <span className="text-fg">{arg}</span>
}

function MemoryStat({
  label,
  used,
  max,
  color,
}: {
  label: string
  used: number
  max: number
  color: string
}) {
  const percent = pct(used, max)

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-baseline justify-between">
        <span className="section-heading">{label}</span>
        <span className="font-mono text-[10px] text-fg-muted">
          {formatBytes(used)} / {formatBytes(max)}
        </span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-dash-surface">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${percent}%`, backgroundColor: color }}
        />
      </div>
      <span className="text-right font-mono text-[10px] text-fg-faint">
        {percent}%
      </span>
    </div>
  )
}

export function JmJvmSectionHub({ jvm }: { jvm: JvmInfo }) {
  const mem = jvm.memoryConfig

  return (
    <div className="glass-card-static overflow-hidden">
      <div className="flex items-center gap-2 border-b border-dash-border px-4 py-3">
        <Cpu className="size-3.5 text-fg-dim" />
        <h3 className="section-heading">JVM</h3>
      </div>

      <div className="flex flex-col gap-4 p-4">
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <Terminal className="size-3 text-fg-faint" />
            <span className="section-heading">Arguments</span>
          </div>
          <div className="overflow-x-auto rounded-md bg-dash-surface p-3">
            <div className="flex flex-col gap-0.5">
              {jvm.arguments.map((arg) => (
                <code key={arg} className="font-mono text-xs leading-relaxed">
                  <JvmArg arg={arg} />
                </code>
              ))}
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <Database className="size-3 text-fg-faint" />
            <span className="section-heading">System Properties</span>
          </div>
          <div className="overflow-hidden rounded-md border border-dash-border">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-dash-border bg-dash-surface text-[10px] font-mono uppercase tracking-wider text-fg-faint">
                  <th className="px-3 py-1.5 text-left">Property</th>
                  <th className="px-3 py-1.5 text-left">Value</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-dash-border/40">
                {jvm.systemProperties.map((prop) => (
                  <tr
                    key={prop.key}
                    className="transition-colors even:bg-dash-panel/50 hover:bg-dash-elevated/30"
                  >
                    <td className="w-1/3 px-3 py-1 font-mono text-fg">
                      {prop.key}
                    </td>
                    <td className="w-2/3 px-3 py-1 font-mono break-all">
                      <ConfigValue value={prop.value} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <span className="section-heading">Memory Configuration</span>
          <div className="grid gap-3 sm:grid-cols-2">
            <MemoryStat
              label="Heap"
              used={mem.heapUsed}
              max={mem.heapMax}
              color="var(--color-fr-coral)"
            />
            <MemoryStat
              label="Non-Heap"
              used={mem.nonHeapUsed}
              max={mem.nonHeapMax}
              color="var(--color-fr-purple)"
            />
            <MemoryStat
              label="Metaspace"
              used={mem.metaspaceUsed}
              max={mem.metaspaceMax}
              color="var(--color-log-debug)"
            />
            <MemoryStat
              label="Direct"
              used={mem.directUsed}
              max={mem.directMax}
              color="var(--color-fr-amber)"
            />
          </div>
        </div>
      </div>
    </div>
  )
}
