/*
 * console-v2 — ReactFlow job DAG mount
 * ─────────────────────────────────────────────────────────────────────
 * Loads React 18 + @xyflow/react v12 from esm.sh (no build step) and
 * mounts a Flink job DAG into a target div. Mirrors the dashboard's
 * job-graph.tsx contract (320×170 operator cards, Kahn topological
 * column layout, strategy-labeled smooth-step edges) but re-skinned
 * with the FR Gruvpuccin palette via shared/reactflow-dag.css.
 *
 * Usage:
 *   <link rel="stylesheet" href="https://esm.sh/@xyflow/react@12.10.1/dist/style.css">
 *   <link rel="stylesheet" href="shared/reactflow-dag.css">
 *   <div id="jobDag" class="fr-dag-mount loading"></div>
 *   <script type="module" src="shared/job-dag.js"></script>
 *   <script>fr.mountJobDag("jobDag", { vertices, edges }) — auto-called if
 *   window.fr.jobDagSeed is set before this script runs.</script>
 */

import React from "https://esm.sh/react@18.3.1";
import { createRoot } from "https://esm.sh/react-dom@18.3.1/client?deps=react@18.3.1";
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  Handle,
  Position,
  BaseEdge,
  EdgeLabelRenderer,
  getSmoothStepPath,
} from "https://esm.sh/@xyflow/react@12.10.1?deps=react@18.3.1,react-dom@18.3.1";

const h = React.createElement;

// ─── Layout constants (match dashboard) ─────────────────────────────
const NODE_WIDTH = 320;
const NODE_HEIGHT = 170;
const COL_GAP = 80;
const ROW_GAP = 40;

// ─── Compact formatters ─────────────────────────────────────────────
function fmtCount(n) {
  if (n == null) return "—";
  if (n >= 1e9) return (n / 1e9).toFixed(2) + "B";
  if (n >= 1e6) return (n / 1e6).toFixed(2) + "M";
  if (n >= 1e3) return (n / 1e3).toFixed(1) + "K";
  return String(n | 0);
}
function fmtBytes(b) {
  if (b == null) return "—";
  if (b >= 1e12) return (b / 1e12).toFixed(2) + "TB";
  if (b >= 1e9) return (b / 1e9).toFixed(2) + "GB";
  if (b >= 1e6) return (b / 1e6).toFixed(1) + "MB";
  if (b >= 1e3) return (b / 1e3).toFixed(1) + "KB";
  return b + "B";
}
function fmtMsPerS(ms) {
  if (ms == null) return "—";
  if (ms >= 1000) return (ms / 1000).toFixed(2) + "s/s";
  return Math.round(ms) + "ms/s";
}
function fmtDuration(s) {
  if (s == null) return "—";
  if (s >= 86400) return (s / 86400).toFixed(1) + "d";
  if (s >= 3600) return (s / 3600).toFixed(1) + "h";
  if (s >= 60) return (s / 60).toFixed(1) + "m";
  return s + "s";
}

// ─── Categorize a vertex's role from its name prefix ────────────────
function vertexKind(name) {
  if (!name) return "op";
  if (name.startsWith("Source:")) return "source";
  if (name.startsWith("Sink:")) return "sink";
  if (/shuffle|hash|rebalance/i.test(name)) return "shuffle";
  return "op";
}

// ─── Backpressure severity from busy ms/s ───────────────────────────
function bpLevel(busyMsPerS) {
  if (busyMsPerS == null) return "ok";
  if (busyMsPerS >= 600) return "crit";
  if (busyMsPerS >= 300) return "warn";
  return "ok";
}
function bpColor(busyMsPerS) {
  const lvl = bpLevel(busyMsPerS);
  return lvl === "crit" ? "rose" : lvl === "warn" ? "amber" : "sage";
}

// ─── Lucide-style mini SVG icons (avoid extra DOM dependencies) ─────
const Icons = {
  source: h("svg", { viewBox: "0 0 24 24", className: "icon source", fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round" },
    h("path", { d: "M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" }),
    h("polyline", { points: "7 10 12 15 17 10" }),
    h("line", { x1: "12", y1: "15", x2: "12", y2: "3" })
  ),
  sink: h("svg", { viewBox: "0 0 24 24", className: "icon sink", fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round" },
    h("path", { d: "M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" }),
    h("polyline", { points: "17 8 12 3 7 8" }),
    h("line", { x1: "12", y1: "3", x2: "12", y2: "15" })
  ),
  op: h("svg", { viewBox: "0 0 24 24", className: "icon op", fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round" },
    h("polygon", { points: "22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" })
  ),
  shuffle: h("svg", { viewBox: "0 0 24 24", className: "icon shuffle", fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round" },
    h("circle", { cx: "18", cy: "18", r: "3" }),
    h("circle", { cx: "6", cy: "6", r: "3" }),
    h("path", { d: "M6 21V9a9 9 0 0 0 9 9" })
  ),
};

// ─── Custom OperatorNode ────────────────────────────────────────────
function OperatorNode(props) {
  const { data } = props;
  const v = data.vertex;
  const kind = vertexKind(v.name);
  const bp = bpLevel(v.busy);

  // Split "Source: kafka.events" → prefix "Source:" + rest "kafka.events"
  let prefix = null;
  let rest = v.name;
  const m = v.name && v.name.match(/^([A-Z][a-zA-Z]+:)\s*(.*)$/);
  if (m) { prefix = m[1]; rest = m[2]; }

  // Status pill
  const statusKey = (v.status || "running").toLowerCase();
  const statusLabel = (v.status || "RUNNING").toUpperCase();

  // Mini task bar segments — synthesize from parallelism + status
  const tasks = v.tasks || (() => {
    const total = v.parallelism || 1;
    if (statusKey === "failed")   return { failed: total };
    if (statusKey === "finished") return { finished: total };
    if (statusKey === "canceled") return { canceling: total };
    if (statusKey === "created")  return { created: total };
    return { running: total };
  })();
  const totalTasks = Object.values(tasks).reduce((a, b) => a + b, 0);
  const taskSegs = ["created", "running", "finished", "canceling", "failed"]
    .map((k) => tasks[k] ? h("div", { key: k, className: `seg ${k}`, style: { width: `${(tasks[k] / totalTasks) * 100}%` } }) : null)
    .filter(Boolean);

  return h(React.Fragment, null,
    h(Handle, { type: "target", position: Position.Left, isConnectable: false }),
    h("div", { className: "fr-op-node", "data-bp": bp },
      h("div", { className: "head" },
        Icons[kind],
        h("div", { className: "name", title: v.name },
          prefix && h("span", { className: "prefix" }, prefix + " "),
          rest
        ),
        h("span", { className: `pill ${statusKey}` },
          statusKey === "running" && h("span", { className: "live-dot" }),
          statusLabel
        )
      ),
      h("div", { className: "metrics" },
        h("div", { className: "metric" },
          h("div", { className: "label" }, "parallelism"),
          h("div", { className: "value" }, "×" + (v.parallelism || 1))
        ),
        h("div", { className: "metric" },
          h("div", { className: "label" }, "records in"),
          h("div", { className: "value" }, fmtCount(v.recordsIn))
        ),
        h("div", { className: "metric" },
          h("div", { className: "label" }, "records out"),
          h("div", { className: "value" }, fmtCount(v.recordsOut))
        ),
        h("div", { className: "metric" },
          h("div", { className: "label" }, "duration"),
          h("div", { className: "value muted" }, fmtDuration(v.duration))
        ),
        h("div", { className: "metric" },
          h("div", { className: "label" }, "bytes in"),
          h("div", { className: "value muted" }, fmtBytes(v.bytesIn))
        ),
        h("div", { className: "metric" },
          h("div", { className: "label" }, "bytes out"),
          h("div", { className: "value muted" }, fmtBytes(v.bytesOut))
        ),
        h("div", { className: "metric" },
          h("div", { className: "label" }, "busy"),
          h("div", { className: `value ${bpColor(v.busy)}` }, fmtMsPerS(v.busy))
        ),
        h("div", { className: "metric" },
          h("div", { className: "label" }, "backpressure"),
          h("div", { className: `value ${bpColor(v.backpressure)}` }, fmtMsPerS(v.backpressure))
        )
      ),
      h("div", { className: "task-bar", title: `${totalTasks} subtasks` }, ...taskSegs)
    ),
    h(Handle, { type: "source", position: Position.Right, isConnectable: false })
  );
}

// ─── Custom StrategyEdge ────────────────────────────────────────────
function StrategyEdge(props) {
  const { id, sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, data, markerEnd } = props;
  const [edgePath, labelX, labelY] = getSmoothStepPath({
    sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition,
    borderRadius: 12,
  });

  return h(React.Fragment, null,
    h(BaseEdge, { id, path: edgePath, markerEnd }),
    data && data.shipStrategy && h(EdgeLabelRenderer, null,
      h("div", {
        style: {
          position: "absolute",
          transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
          pointerEvents: "all",
          background: "rgba(20,22,23,0.92)",
          border: "1px solid #2e2c2b",
          borderRadius: 4,
          padding: "1px 6px",
          fontFamily: '"Geist Mono", monospace',
          fontSize: 9.5,
          color: "#a69a8a",
          fontWeight: 500,
          letterSpacing: "0.04em",
          backdropFilter: "blur(4px)",
        },
        className: "fr-edge-label",
      }, data.shipStrategy)
    )
  );
}

const NODE_TYPES = { operator: OperatorNode };
const EDGE_TYPES = { strategy: StrategyEdge };

// ─── Kahn topological sort layout ───────────────────────────────────
function layoutDag(vertices, edges) {
  const adj = new Map();
  const inDeg = new Map();
  vertices.forEach((v) => { adj.set(v.id, []); inDeg.set(v.id, 0); });
  edges.forEach((e) => {
    if (!adj.has(e.source) || !adj.has(e.target)) return;
    adj.get(e.source).push(e.target);
    inDeg.set(e.target, (inDeg.get(e.target) || 0) + 1);
  });

  // BFS by column (Kahn)
  const cols = [];
  let frontier = vertices.filter((v) => inDeg.get(v.id) === 0).map((v) => v.id);
  const seen = new Set();
  while (frontier.length) {
    cols.push(frontier);
    const next = new Set();
    frontier.forEach((id) => {
      seen.add(id);
      adj.get(id).forEach((n) => {
        const d = (inDeg.get(n) || 0) - 1;
        inDeg.set(n, d);
        if (d <= 0 && !seen.has(n)) next.add(n);
      });
    });
    frontier = Array.from(next);
  }
  // Any leftover (cycle / disconnected) → trail column
  const leftover = vertices.filter((v) => !seen.has(v.id)).map((v) => v.id);
  if (leftover.length) cols.push(leftover);

  // Assign x,y per column, vertically centered around 0
  const positions = new Map();
  cols.forEach((col, ci) => {
    const totalH = col.length * NODE_HEIGHT + (col.length - 1) * ROW_GAP;
    col.forEach((id, ri) => {
      positions.set(id, {
        x: ci * (NODE_WIDTH + COL_GAP),
        y: ri * (NODE_HEIGHT + ROW_GAP) - totalH / 2,
      });
    });
  });
  return positions;
}

// ─── Mount ──────────────────────────────────────────────────────────
function Dag({ vertices, edges }) {
  const positions = React.useMemo(() => layoutDag(vertices, edges), [vertices, edges]);

  const rfNodes = React.useMemo(() => vertices.map((v) => ({
    id: v.id,
    type: "operator",
    position: positions.get(v.id) || { x: 0, y: 0 },
    data: { vertex: v },
    selected: !!v.selected,
    draggable: true,
  })), [vertices, positions]);

  const rfEdges = React.useMemo(() => edges.map((e, i) => ({
    id: `e-${i}-${e.source}-${e.target}`,
    source: e.source,
    target: e.target,
    type: "strategy",
    data: { shipStrategy: e.shipStrategy || "FORWARD" },
    animated: !!e.hot,
  })), [edges]);

  return h(ReactFlow, {
    nodes: rfNodes,
    edges: rfEdges,
    nodeTypes: NODE_TYPES,
    edgeTypes: EDGE_TYPES,
    fitView: true,
    fitViewOptions: { padding: 0.18, minZoom: 0.4, maxZoom: 1.4 },
    minZoom: 0.25,
    maxZoom: 2,
    proOptions: { hideAttribution: true },
    nodesDraggable: true,
    nodesConnectable: false,
    elementsSelectable: true,
    panOnScroll: false,
    zoomOnScroll: true,
    zoomOnDoubleClick: false,
  },
    h(Background, { variant: "dots", gap: 24, size: 1.2 }),
    h(Controls, { showInteractive: false, position: "bottom-right" }),
    rfNodes.length >= 5 && h(MiniMap, {
      pannable: true, zoomable: true, position: "top-right",
      nodeColor: (n) => {
        const bp = bpLevel(n.data && n.data.vertex && n.data.vertex.busy);
        return bp === "crit" ? "#ea6962" : bp === "warn" ? "#d8a657" : "#a9b665";
      },
      nodeStrokeColor: "#2e2c2b",
      maskColor: "rgba(16, 18, 19, 0.7)",
    })
  );
}

// ─── Public API ──────────────────────────────────────────────────────
window.fr = window.fr || {};
window.fr.mountJobDag = function (targetId, seed) {
  const el = document.getElementById(targetId);
  if (!el) {
    console.warn("[fr.mountJobDag] no element with id", targetId);
    return;
  }
  el.classList.remove("loading");
  const root = createRoot(el);
  root.render(h(Dag, { vertices: seed.vertices, edges: seed.edges }));
  return root;
};

// Auto-mount if a seed was set before this script ran
if (window.fr.jobDagSeed) {
  window.fr.mountJobDag(window.fr.jobDagSeed.target || "jobDag", window.fr.jobDagSeed);
}
