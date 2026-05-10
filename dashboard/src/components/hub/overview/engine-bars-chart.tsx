/**
 * Engine bars chart — last-38-minutes throughput sparkline rendered as
 * stacked SVG `<rect>` bars. Sage = success, coral = failed checkpoint.
 *
 * The parent decides whether to feed live data (from `useEngineBarsData`)
 * or seeded demo bars; this component only renders. The `isDemo` flag
 * controls the badge ("demo data" vs "live") and tooltip text.
 */

export interface EngineBar {
  height: number
  failed: boolean
}

interface EngineBarsChartProps {
  bars: EngineBar[]
  isDemo: boolean
  /** Optional error message — surfaces in the demo-badge tooltip. */
  errorMessage?: string | null
}

export function EngineBarsChart({
  bars,
  isDemo,
  errorMessage,
}: EngineBarsChartProps) {
  return (
    <div className="col-span-12 lg:col-span-7">
      <div className="glass-card-static h-full p-5">
        <div className="mb-3 flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-sans text-[14px] font-medium text-zinc-100">
                Streaming engine
              </h3>
              {isDemo ? (
                <span
                  className="sev-badge muted"
                  title={
                    errorMessage
                      ? `metric fetch failed: ${errorMessage}`
                      : "no numRecordsOutPerSecond series in storage yet"
                  }
                >
                  demo data
                </span>
              ) : (
                <span className="sev-badge ok">live</span>
              )}
            </div>
            <p className="mt-0.5 text-[11px] text-fg-muted">
              Throughput · last 38 minutes · sage = success, coral = failed
              checkpoint
            </p>
          </div>
        </div>
        <div className="relative">
          <svg
            viewBox="0 0 600 180"
            preserveAspectRatio="none"
            className="h-44 w-full"
            role="img"
            aria-label="Engine throughput bars"
          >
            <g stroke="rgba(212,190,152,0.06)" strokeWidth="1">
              <line x1="0" y1="45" x2="600" y2="45" />
              <line x1="0" y1="90" x2="600" y2="90" />
              <line x1="0" y1="135" x2="600" y2="135" />
            </g>
            <g>
              {bars.map((bar, i) => {
                const x = (i / bars.length) * 600
                const barWidth = 600 / bars.length - 2
                const y = 180 - bar.height
                const fill = bar.failed
                  ? "var(--color-fr-coral)"
                  : "var(--color-fr-sage)"
                return (
                  <rect
                    // biome-ignore lint/suspicious/noArrayIndexKey: positional bar
                    key={i}
                    x={x}
                    y={y}
                    width={barWidth}
                    height={bar.height}
                    fill={fill}
                    opacity={0.7}
                  />
                )
              })}
            </g>
          </svg>
        </div>
        <div className="mt-3 flex items-center justify-between text-[10px] font-mono text-fg-faint">
          <span>38m ago</span>
          <span>
            wire to <code>metricSeries(jobID, metric)</code> in P3
          </span>
          <span>now</span>
        </div>
      </div>
    </div>
  )
}
