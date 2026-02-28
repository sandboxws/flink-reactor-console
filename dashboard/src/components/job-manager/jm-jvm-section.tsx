"use client";

import { Cpu, Terminal, Database } from "lucide-react";
import type { JvmInfo } from "@/data/cluster-types";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const GB = 1024 ** 3;
const MB = 1024 ** 2;

function formatBytes(bytes: number): string {
  if (bytes >= GB) return `${(bytes / GB).toFixed(1)} GB`;
  if (bytes >= MB) return `${(bytes / MB).toFixed(0)} MB`;
  return `${(bytes / 1024).toFixed(0)} KB`;
}

function pct(used: number, max: number): number {
  if (max === 0) return 0;
  return Math.min(100, Math.round((used / max) * 100));
}

// Syntax-highlight JVM argument prefixes
function JvmArg({ arg }: { arg: string }) {
  if (arg.startsWith("-XX:")) {
    return (
      <span>
        <span className="text-fr-purple">-XX:</span>
        <span className="text-zinc-300">{arg.slice(4)}</span>
      </span>
    );
  }
  if (arg.startsWith("-Xm") || arg.startsWith("-Xss")) {
    return (
      <span>
        <span className="text-fr-coral">{arg.slice(0, 4)}</span>
        <span className="text-zinc-300">{arg.slice(4)}</span>
      </span>
    );
  }
  if (arg.startsWith("-D")) {
    const eqIdx = arg.indexOf("=");
    if (eqIdx > 0) {
      return (
        <span>
          <span className="text-log-info">-D</span>
          <span className="text-zinc-300">{arg.slice(2, eqIdx)}</span>
          <span className="text-zinc-600">=</span>
          <span className="text-zinc-400">{arg.slice(eqIdx + 1)}</span>
        </span>
      );
    }
    return (
      <span>
        <span className="text-log-info">-D</span>
        <span className="text-zinc-300">{arg.slice(2)}</span>
      </span>
    );
  }
  return <span className="text-zinc-300">{arg}</span>;
}

// Memory stat bar
function MemoryStat({
  label,
  used,
  max,
  color,
}: {
  label: string;
  used: number;
  max: number;
  color: string;
}) {
  const percent = pct(used, max);

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-baseline justify-between">
        <span className="text-[10px] font-medium uppercase tracking-wide text-zinc-500">
          {label}
        </span>
        <span className="font-mono text-[10px] text-zinc-400">
          {formatBytes(used)} / {formatBytes(max)}
        </span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-dash-surface">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${percent}%`, backgroundColor: color }}
        />
      </div>
      <span className="text-right font-mono text-[10px] text-zinc-600">
        {percent}%
      </span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// JmJvmSection — JVM arguments, system properties, memory config
// ---------------------------------------------------------------------------

export function JmJvmSection({ jvm }: { jvm: JvmInfo }) {
  const mem = jvm.memoryConfig;

  return (
    <div className="glass-card overflow-hidden">
      {/* Section header */}
      <div className="flex items-center gap-2 border-b border-dash-border px-4 py-3">
        <Cpu className="size-3.5 text-zinc-500" />
        <h3 className="text-xs font-medium uppercase tracking-wide text-zinc-500">
          JVM
        </h3>
      </div>

      <div className="flex flex-col gap-4 p-4">
        {/* JVM Arguments */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <Terminal className="size-3 text-zinc-600" />
            <span className="text-[10px] font-medium uppercase tracking-wide text-zinc-500">
              Arguments
            </span>
          </div>
          <div className="overflow-x-auto rounded-md bg-dash-surface p-3">
            <div className="flex flex-col gap-0.5">
              {jvm.arguments.map((arg, i) => (
                <code key={i} className="font-mono text-xs leading-relaxed">
                  <JvmArg arg={arg} />
                </code>
              ))}
            </div>
          </div>
        </div>

        {/* System Properties */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <Database className="size-3 text-zinc-600" />
            <span className="text-[10px] font-medium uppercase tracking-wide text-zinc-500">
              System Properties
            </span>
          </div>
          <div className="overflow-hidden rounded-md border border-dash-border">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-dash-border bg-dash-surface">
                  <th className="px-3 py-1.5 text-left font-medium text-zinc-500">
                    Property
                  </th>
                  <th className="px-3 py-1.5 text-left font-medium text-zinc-500">
                    Value
                  </th>
                </tr>
              </thead>
              <tbody>
                {jvm.systemProperties.map((prop) => (
                  <tr
                    key={prop.key}
                    className="border-b border-dash-border/50 even:bg-dash-panel transition-colors hover:bg-dash-hover"
                  >
                    <td className="w-1/3 px-3 py-1 font-mono text-zinc-300">
                      {prop.key}
                    </td>
                    <td className="w-2/3 px-3 py-1 font-mono text-zinc-400 break-all">
                      {prop.value}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Memory Configuration */}
        <div className="flex flex-col gap-2">
          <span className="text-[10px] font-medium uppercase tracking-wide text-zinc-500">
            Memory Configuration
          </span>
          <div className="grid gap-3 sm:grid-cols-2">
            <MemoryStat label="Heap" used={mem.heapUsed} max={mem.heapMax} color="var(--color-fr-coral)" />
            <MemoryStat label="Non-Heap" used={mem.nonHeapUsed} max={mem.nonHeapMax} color="var(--color-fr-purple)" />
            <MemoryStat label="Metaspace" used={mem.metaspaceUsed} max={mem.metaspaceMax} color="var(--color-log-debug)" />
            <MemoryStat label="Direct" used={mem.directUsed} max={mem.directMax} color="var(--color-fr-amber)" />
          </div>
        </div>
      </div>
    </div>
  );
}
