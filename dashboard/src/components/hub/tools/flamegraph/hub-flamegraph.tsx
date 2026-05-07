/**
 * HubFlamegraph — SVG flame graph (icicle-style, top-down) for Flink
 * profiler samples.
 *
 * Layout: each frame's width is proportional to its sample count. Click a
 * frame to "zoom" — the clicked frame becomes the new root, occupying the
 * full width. Click again to zoom out. Hovering a frame shows a tooltip
 * with the symbol, samples, and percentage of the parent.
 *
 * Color scale: sage (cool) → amber → coral (hot) by busy %, where busy %
 * is the frame's value as a fraction of the visible root's value.
 *
 * Truncation: at most 256 rendered frames (depth-first, value-sorted) with
 * a "deeper frames truncated · N more" badge below the chart.
 */

import { useMemo, useState } from "react"
import type { FlamegraphNode } from "@/lib/flamegraph-data"

interface HubFlamegraphProps {
  data: FlamegraphNode
  /** Optional className for the container. */
  className?: string
}

interface RenderedFrame {
  /** Identity path through the tree — used as React key + zoom anchor. */
  path: string
  name: string
  value: number
  depth: number
  /** x position as fraction of visible root [0, 1]. */
  x: number
  /** width as fraction of visible root (0, 1]. */
  width: number
  /** Busy % of visible root. */
  pct: number
}

const ROW_HEIGHT = 18
const MAX_FRAMES = 256

export function HubFlamegraph({ data, className }: HubFlamegraphProps) {
  const [zoomPath, setZoomPath] = useState<string>("")
  const [hover, setHover] = useState<RenderedFrame | null>(null)

  const flat = useMemo(() => layout(data), [data])
  const visible = useMemo(() => {
    if (!zoomPath) return flat
    const root = flat.find((f) => f.path === zoomPath) ?? flat[0]
    const rebased: RenderedFrame[] = []
    for (const f of flat) {
      if (!f.path.startsWith(root.path)) continue
      rebased.push({
        ...f,
        depth: f.depth - root.depth,
        x: (f.x - root.x) / Math.max(0.0001, root.width),
        width: f.width / Math.max(0.0001, root.width),
        pct: f.value === 0 ? 0 : (f.value / root.value) * 100,
      })
    }
    return rebased
  }, [flat, zoomPath])

  const truncated = useMemo(() => {
    if (visible.length <= MAX_FRAMES) return { rows: visible, hidden: 0 }
    const sorted = [...visible].sort((a, b) => b.value - a.value)
    return {
      rows: sorted.slice(0, MAX_FRAMES),
      hidden: visible.length - MAX_FRAMES,
    }
  }, [visible])

  const maxDepth =
    truncated.rows.length > 0
      ? Math.max(...truncated.rows.map((r) => r.depth))
      : 0
  const height = (maxDepth + 1) * ROW_HEIGHT

  return (
    <div className={`relative ${className ?? ""}`}>
      <svg
        viewBox={`0 0 1000 ${Math.max(ROW_HEIGHT, height)}`}
        preserveAspectRatio="none"
        className="block w-full"
        style={{ height: Math.max(ROW_HEIGHT, height) }}
      >
        {truncated.rows.map((frame) => {
          const x = frame.x * 1000
          const w = Math.max(0.5, frame.width * 1000)
          const y = frame.depth * ROW_HEIGHT
          return (
            <g
              key={frame.path}
              role="button"
              tabIndex={0}
              onClick={() =>
                setZoomPath((prev) => (prev === frame.path ? "" : frame.path))
              }
              onMouseEnter={() => setHover(frame)}
              onMouseLeave={() => setHover(null)}
            >
              <rect
                x={x}
                y={y}
                width={w}
                height={ROW_HEIGHT - 1}
                fill={frameColor(frame.pct)}
                stroke="rgba(0,0,0,0.25)"
                strokeWidth={0.5}
                className="cursor-pointer"
              />
              {w > 40 ? (
                <text
                  x={x + 4}
                  y={y + 12}
                  fontSize={10}
                  fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace"
                  fill="rgba(20,20,20,0.85)"
                  pointerEvents="none"
                >
                  {clip(frame.name, w)}
                </text>
              ) : null}
            </g>
          )
        })}
      </svg>

      {hover ? (
        <div className="pointer-events-none absolute left-2 top-2 max-w-[420px] rounded-md border border-dash-border bg-dash-panel/90 px-3 py-2 font-mono text-[11px] text-fg backdrop-blur">
          <div className="text-zinc-100 break-words">{hover.name}</div>
          <div className="mt-0.5 text-fg-muted">
            {hover.value.toLocaleString()} samples · {hover.pct.toFixed(1)}% of
            parent
          </div>
        </div>
      ) : null}

      <div className="mt-2 flex items-center justify-between font-mono text-[10px] text-fg-faint">
        <span>
          {zoomPath ? (
            <button
              type="button"
              className="underline hover:text-fg"
              onClick={() => setZoomPath("")}
            >
              Reset zoom
            </button>
          ) : (
            <>Click a frame to zoom · sage = cool · coral = hot</>
          )}
        </span>
        {truncated.hidden > 0 ? (
          <span className="rounded border border-dash-border px-1.5 py-0.5 text-fg-muted">
            deeper frames truncated · {truncated.hidden} more
          </span>
        ) : null}
      </div>
    </div>
  )
}

/** Flatten the tree into RenderedFrames. The full tree is traversed once
 *  and each frame's x/width is proportional to its value within its
 *  parent. The root spans [0, 1]. */
function layout(node: FlamegraphNode): RenderedFrame[] {
  const out: RenderedFrame[] = []
  const total = Math.max(1, node.value)
  function walk(
    n: FlamegraphNode,
    depth: number,
    parentPath: string,
    x: number,
    width: number,
  ) {
    const path = parentPath ? `${parentPath}/${n.name}` : n.name
    out.push({
      path,
      name: n.name,
      value: n.value,
      depth,
      x,
      width,
      pct: (n.value / total) * 100,
    })
    if (!n.children || n.children.length === 0) return
    const childTotal = n.children.reduce((s, c) => s + Math.max(0, c.value), 0)
    if (childTotal === 0) return
    let cursor = x
    for (const child of n.children) {
      const cw = (child.value / childTotal) * width
      walk(child, depth + 1, path, cursor, cw)
      cursor += cw
    }
  }
  walk(node, 0, "", 0, 1)
  return out
}

/** Sage → amber → coral by pct ∈ [0, 100]. Returns hex; values resolve
 *  through `var(--color-fr-*)` at the call site is preferred but inline
 *  hex is simpler for SVG `fill` attribute and matches Hub palette. */
function frameColor(pct: number): string {
  if (pct < 5) return "#9bb59c" // sage 60
  if (pct < 15) return "#bcc97a" // sage→amber blend
  if (pct < 35) return "#e0c574" // amber 60
  if (pct < 60) return "#e7a76b" // amber→coral blend
  return "#e78a4e" // coral
}

function clip(s: string, pixelWidth: number): string {
  const max = Math.max(0, Math.floor(pixelWidth / 6))
  if (s.length <= max) return s
  return `${s.slice(0, Math.max(0, max - 1))}…`
}
