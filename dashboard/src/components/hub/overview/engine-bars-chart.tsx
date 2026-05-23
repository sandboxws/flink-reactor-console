/**
 * Engine bars chart — last-38-minutes throughput sparkline rendered as
 * stacked SVG `<rect>` bars. Sage = success, coral = failed checkpoint.
 *
 * Renders three explicit states from `useEngineBarsData`:
 *  - `loading`: 38 low-opacity skeleton bars at a uniform height
 *  - `empty`: "Collecting metrics" message when storage has no series yet
 *  - live: real bars with `live` badge
 */

export interface EngineBar {
  height: number
  failed: boolean
}

interface EngineBarsChartProps {
  bars: EngineBar[]
  loading: boolean
  empty: boolean
  /** Optional error message — surfaces in the badge tooltip when present. */
  errorMessage?: string | null
}

const SKELETON_BAR: EngineBar = { height: 30, failed: false }

export function EngineBarsChart({
  bars,
  loading,
  empty,
  errorMessage,
}: EngineBarsChartProps) {
  const skeletonBars: EngineBar[] = loading
    ? Array.from({ length: 38 }, () => SKELETON_BAR)
    : []
  const rendered = loading ? skeletonBars : bars
  const showEmptyOverlay = !loading && (empty || rendered.length === 0)
  const showErrorOverlay = !!errorMessage && !loading

  const badge = loading ? (
    <span className="sev-badge muted">loading</span>
  ) : showErrorOverlay ? (
    <span className="sev-badge fail" title={errorMessage ?? undefined}>
      error
    </span>
  ) : showEmptyOverlay ? (
    <span
      className="sev-badge muted"
      title="no numRecordsOutPerSecond series in storage yet"
    >
      no data yet
    </span>
  ) : (
    <span className="sev-badge ok">live</span>
  )

  return (
    <div className="col-span-12 lg:col-span-7">
      <div className="glass-card-static h-full p-5">
        <div className="mb-3 flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-sans text-[14px] font-medium text-zinc-100">
                Streaming engine
              </h3>
              {badge}
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
            <g opacity={loading ? 0.3 : 1}>
              {rendered.map((bar, i) => {
                const x = (i / Math.max(rendered.length, 1)) * 600
                const barWidth = 600 / Math.max(rendered.length, 1) - 2
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
                    opacity={loading ? 0.4 : 0.7}
                  />
                )
              })}
            </g>
          </svg>
          {showEmptyOverlay ? (
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
              <span className="text-[11px] font-mono text-fg-muted">
                Collecting metrics — first bars appear after ~60s
              </span>
            </div>
          ) : null}
        </div>
        <div className="mt-3 flex items-center justify-between text-[10px] font-mono text-fg-faint">
          <span>38m ago</span>
          <span>peak across all sources</span>
          <span>now</span>
        </div>
      </div>
    </div>
  )
}
