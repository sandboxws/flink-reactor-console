/**
 * Job KPI strip — six small `<KpiCard>` cells above the tab strip on
 * `/hub/jobs/$id`: Throughput / Watermark / Tasks / Parallelism / Last
 * checkpoint / Checkpoints.
 *
 * Throughput is the input-side records-per-second (records emitted by source
 * vertices). Watermark is the lag in ms between Flink's `now` and the slowest
 * subtask watermark. Both are computed server-side; see
 * server/internal/graphql/mappers.go (computeJobMetrics, computeWatermarkLag).
 */

import { type FlinkJob, KpiCard, Sparkline } from "@flink-reactor/ui"
import { useEffect, useRef } from "react"
import { useSparklineBuffer } from "@/lib/hub/use-sparkline-buffer"

interface JobKpiStripProps {
  job: FlinkJob
}

function timeAgo(date: Date | string | null | undefined): string {
  if (!date) return "—"
  const d = typeof date === "string" ? new Date(date) : date
  const seconds = Math.floor((Date.now() - d.getTime()) / 1000)
  if (seconds < 60) return `${seconds}s ago`
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  return `${Math.floor(hours / 24)}d ago`
}

/** Format a per-second rate with a smart unit (raw / K/s / M/s). */
function formatRate(rate: number): { value: string; unit: string } {
  if (!Number.isFinite(rate) || rate <= 0) return { value: "0", unit: "/s" }
  if (rate >= 1_000_000)
    return { value: (rate / 1_000_000).toFixed(2), unit: "M/s" }
  if (rate >= 1_000) return { value: (rate / 1_000).toFixed(1), unit: "K/s" }
  return { value: rate.toFixed(0), unit: "/s" }
}

/** Format a lag in milliseconds with a smart unit (ms / s / m / h). */
function formatLag(ms: number): { value: string; unit: string } {
  if (!Number.isFinite(ms) || ms < 0) return { value: "—", unit: "" }
  if (ms < 1_000) return { value: ms.toFixed(0), unit: "ms" }
  if (ms < 60_000) return { value: (ms / 1_000).toFixed(1), unit: "s" }
  if (ms < 3_600_000) return { value: (ms / 60_000).toFixed(1), unit: "m" }
  return { value: (ms / 3_600_000).toFixed(1), unit: "h" }
}

export function JobKpiStrip({ job }: JobKpiStripProps) {
  const totalTasks = Object.values(job.tasks).reduce((a, b) => a + b, 0)
  const lastCheckpoint = job.checkpoints[0]

  const throughputIn = job.throughput?.recordsInPerSecond ?? null
  const throughputOut = job.throughput?.recordsOutPerSecond ?? null

  const throughputSpark = useSparklineBuffer(30)
  const watermarkSpark = useSparklineBuffer(30)
  const prevThroughputRef = useRef<number | null>(null)
  const prevWatermarkRef = useRef<number | null>(null)
  useEffect(() => {
    if (throughputIn !== prevThroughputRef.current) {
      prevThroughputRef.current = throughputIn
      throughputSpark.push(throughputIn)
    }
  }, [throughputIn, throughputSpark])
  useEffect(() => {
    const lag = job.watermarkLag ?? null
    if (lag !== prevWatermarkRef.current) {
      prevWatermarkRef.current = lag
      watermarkSpark.push(lag)
    }
  }, [job.watermarkLag, watermarkSpark])
  const inFmt =
    throughputIn != null ? formatRate(throughputIn) : { value: "—", unit: "/s" }
  const outSub =
    throughputOut != null && throughputOut > 0
      ? `${formatRate(throughputOut).value}${formatRate(throughputOut).unit} out`
      : undefined

  const lagFmt =
    job.watermarkLag != null
      ? formatLag(job.watermarkLag)
      : { value: "—", unit: "" }

  return (
    <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-6">
      <KpiCard
        label="Throughput"
        liveDot={throughputIn != null && throughputIn > 0 ? "sage" : undefined}
        value={
          <span>
            {inFmt.value}
            <span className="text-[10px] text-fg-muted">{inFmt.unit}</span>
          </span>
        }
        sub={outSub}
      >
        {throughputSpark.points.length >= 2 ? (
          <Sparkline
            points={throughputSpark.points}
            color="var(--color-fr-sage)"
            height={24}
            className="mt-1.5 w-full"
          />
        ) : null}
      </KpiCard>
      <KpiCard
        label="Watermark"
        value={
          <span>
            {lagFmt.value}
            <span className="text-[10px] text-fg-muted">{lagFmt.unit}</span>
          </span>
        }
        sub={job.watermarkLag != null ? "lag" : undefined}
      >
        {watermarkSpark.points.length >= 2 ? (
          <Sparkline
            points={watermarkSpark.points}
            color="var(--color-fr-amber)"
            height={24}
            className="mt-1.5 w-full"
          />
        ) : null}
      </KpiCard>
      <KpiCard
        label="Tasks"
        value={totalTasks}
        sub={`${job.tasks.running} running`}
      />
      <KpiCard label="Parallelism" value={job.parallelism} />
      <KpiCard
        label="Last ckpt"
        value={
          lastCheckpoint?.duration != null ? (
            <span>
              {lastCheckpoint.duration}
              <span className="text-[10px] text-fg-muted">ms</span>
            </span>
          ) : (
            "—"
          )
        }
        sub={
          lastCheckpoint?.triggerTimestamp
            ? timeAgo(lastCheckpoint.triggerTimestamp)
            : undefined
        }
      />
      <KpiCard
        label="Checkpoints"
        value={job.checkpointCounts?.completed ?? 0}
        sub={
          job.checkpointCounts?.failed
            ? `${job.checkpointCounts.failed} failed`
            : undefined
        }
      />
    </div>
  )
}
