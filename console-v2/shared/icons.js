/*
 * console-v2 — shared JS
 * ─────────────────────────────────────────────────────────────────────
 *  - lucide loader (stroke-width 1.6)
 *  - brand-glyph injector via .brand-glyph[data-size]
 *  - page-nav auto-highlighter via [data-page] attribute
 *  - engine-bars chart builder
 *  - checkpoint heatmap builder
 *  - throughput ticker
 *  - demo cast (cluster, pipelines, instruments, users)
 */

// ── Demo cast ──────────────────────────────────────────────────────
window.fr = window.fr || {};
window.fr.cast = {
  cluster: {
    name: "acme-prod-1.fr",
    env: "prod",
    flinkVersion: "1.20.1",
    region: "us-west-2",
    others: ["acme-stage-1.fr", "dev-local"],
  },
  pipelines: [
    { id: "a3f2c891", name: "reactor-core",        status: "running",  throughput: "4.21M", tasks: 247, parallelism: 32, owner: "ahmed", uptime: "12d 4h" },
    { id: "b7d4e102", name: "fluss-ingest",        status: "running",  throughput: "1.83M", tasks: 96,  parallelism: 16, owner: "kira",  uptime: "8d 12h" },
    { id: "c8e1d233", name: "paimon-sink",         status: "running",  throughput: "920K",  tasks: 64,  parallelism: 12, owner: "liam",  uptime: "6d 2h" },
    { id: "d9f0e344", name: "schema-registry-sync", status: "running", throughput: "12K",   tasks: 8,   parallelism: 2,  owner: "mei",   uptime: "23d 1h" },
    { id: "e0a1b455", name: "datalake-connect",    status: "warning",  throughput: "440K",  tasks: 48,  parallelism: 8,  owner: "nora",  uptime: "3d 4h", alert: "backpressure on op.4" },
    { id: "f1b2c566", name: "clickstream-enrich",  status: "running",  throughput: "3.10M", tasks: 192, parallelism: 24, owner: "omar",  uptime: "15d 9h" },
    { id: "a2c3d677", name: "cdc-loader",          status: "failed",   throughput: "—",     tasks: 32,  parallelism: 8,  owner: "priya", uptime: "—",      lastError: "12m ago" },
  ],
  instruments: [
    { name: "Fluss",            type: "fluss",           status: "ok",   notes: "8 servers · 248 tables" },
    { name: "Paimon",           type: "datalake",        status: "ok",   notes: "5.2 TB · 184 tables" },
    { name: "Redis",            type: "redis",           status: "ok",   notes: "primary + 2 replicas" },
    { name: "Schema Registry",  type: "schema-registry", status: "warn", notes: "1 incompatible subject" },
    { name: "Datalake",         type: "database",        status: "ok",   notes: "28 catalogs · 412 tables" },
  ],
  users: ["ahmed", "kira", "liam", "mei", "nora", "omar", "priya", "quinn"],
};

// ── Brand glyph SVG (concentric reactor rings, coral) ─────────────
window.fr.brandGlyph = function (size) {
  size = size || 22;
  const sw  = (size / 22) * 1.5;
  const sw2 = (size / 22) * 1.2;
  const r1  = size / 2 - 1;
  const r2  = size * (6 / 22);
  const r3  = size * (2.2 / 22);
  const c   = size / 2;
  return (
    `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" fill="none" xmlns="http://www.w3.org/2000/svg">` +
    `<circle cx="${c}" cy="${c}" r="${r1}" stroke="#e78a4e" stroke-width="${sw}"/>` +
    `<circle cx="${c}" cy="${c}" r="${r2}" stroke="#e78a4e" stroke-width="${sw2}" opacity="0.6"/>` +
    `<circle cx="${c}" cy="${c}" r="${r3}" fill="#e78a4e"/>` +
    `</svg>`
  );
};

// ── Render lucide icons (stroke-width 1.6, matches hub demo) ──────
function renderIcons() {
  if (window.lucide && lucide.createIcons) {
    lucide.createIcons({ attrs: { "stroke-width": 1.6 } });
  }
}

// ── Inject brand glyph into all .brand-glyph[data-size] elements ──
function renderGlyphs() {
  document.querySelectorAll(".brand-glyph").forEach((el) => {
    const size = parseInt(el.getAttribute("data-size") || "22", 10);
    el.innerHTML = window.fr.brandGlyph(size);
  });
}

// ── Highlight active sidebar nav based on body[data-page] attr ────
function highlightActivePage() {
  const page = document.body.getAttribute("data-page");
  if (!page) return;
  document.querySelectorAll(`[data-nav="${page}"]`).forEach((el) => {
    el.classList.add("active");
  });
}

// ── Engine throughput stacked-bar chart (overview hero, job detail)
// Mirrors CheckpointTimelineChart: success bars (sage) stacked with
// failure tops (red). Heights follow a deterministic noise pattern.
function buildEngineBars(targetId, opts) {
  opts = opts || {};
  const g = document.getElementById(targetId);
  if (!g) return;
  const W = opts.width || 600;
  const H = opts.height || 180;
  const bars = opts.bars || 38;
  const gap = opts.gap || 3;
  const baseline = opts.baseline || (H - 15);
  const barW = (W - gap * (bars - 1)) / bars;
  for (let i = 0; i < bars; i++) {
    const t = i / bars;
    const wave =
      0.55 +
      0.35 * Math.sin(t * Math.PI * 2.2 + 0.6) +
      0.18 * Math.sin(t * Math.PI * 6.1 + 1.4);
    const noise = ((i * 9301 + 49297) % 233280) / 233280;
    const success = Math.max(20, wave * (baseline - 35) + noise * 10);
    const failure = i % 7 === 3 || i % 11 === 5 ? 6 + ((noise * 8) | 0) : 0;
    const x = i * (barW + gap);

    const sRect = document.createElementNS("http://www.w3.org/2000/svg", "rect");
    sRect.setAttribute("x", x);
    sRect.setAttribute("y", baseline - success);
    sRect.setAttribute("width", barW);
    sRect.setAttribute("height", success);
    sRect.setAttribute("fill", "#a9b665");
    sRect.setAttribute("opacity", "0.9");
    g.appendChild(sRect);

    if (failure > 0) {
      const fRect = document.createElementNS("http://www.w3.org/2000/svg", "rect");
      fRect.setAttribute("x", x);
      fRect.setAttribute("y", baseline - success - failure);
      fRect.setAttribute("width", barW);
      fRect.setAttribute("height", failure);
      fRect.setAttribute("fill", "#ea6962");
      fRect.setAttribute("rx", "1.5");
      g.appendChild(fRect);
    }
  }
}

// ── Checkpoint heatmap (26 weeks × 7 days) ────────────────────────
function buildHeatmap(targetId, opts) {
  opts = opts || {};
  const root = document.getElementById(targetId);
  if (!root) return;
  const weeks = opts.weeks || 26;
  const cellSize = opts.cellSize || 12;

  for (let w = 0; w < weeks; w++) {
    const col = document.createElement("div");
    col.className = "flex flex-col gap-[3px]";
    for (let d = 0; d < 7; d++) {
      const cell = document.createElement("div");
      const trend = w / weeks;
      const weekendDamp = d >= 5 ? 0.45 : 1;
      const noise = ((w * 73 + d * 19 + 7) % 100) / 100;
      const score = (trend * 0.6 + 0.25 + noise * 0.3) * weekendDamp;
      let level = 0;
      if (score > 0.85) level = 4;
      else if (score > 0.65) level = 3;
      else if (score > 0.45) level = 2;
      else if (score > 0.25) level = 1;
      cell.className = `hm-${level}`;
      cell.style.width = cellSize + "px";
      cell.style.height = cellSize + "px";
      cell.style.borderRadius = "2px";
      const labelDay = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][d];
      cell.title = `Week ${w + 1}, ${labelDay} — ${(score * 200) | 0} checkpoints`;
      col.appendChild(cell);
    }
    root.appendChild(col);
  }
}

// ── Throughput ticker (subtle jitter every ~2.2s) ─────────────────
function tickThroughput(elementIds) {
  const els = (elementIds || ["throughputValue", "rightRailThroughput"])
    .map((id) => document.getElementById(id))
    .filter(Boolean);
  if (els.length === 0) return;
  let value = 4.21;
  setInterval(() => {
    value = Math.max(4.05, Math.min(4.32, value + (Math.random() - 0.5) * 0.08));
    const text = value.toFixed(2) + "M";
    els.forEach((el) => (el.textContent = text));
  }, 2200);
}

// ── Watermark ticker (small jitter, ms units) ─────────────────────
function tickWatermark(elementIds) {
  const els = (elementIds || ["watermarkValue"])
    .map((id) => document.getElementById(id))
    .filter(Boolean);
  if (els.length === 0) return;
  let value = 12;
  setInterval(() => {
    value = Math.max(8, Math.min(28, value + (Math.random() - 0.5) * 3 | 0));
    els.forEach((el) => (el.textContent = value + "ms"));
  }, 2800);
}

// ── DOM ready bootstrap ───────────────────────────────────────────
function frBoot() {
  renderGlyphs();
  renderIcons();
  highlightActivePage();
  buildEngineBars("engineBars");
  buildHeatmap("heatmap");
  tickThroughput();
  tickWatermark();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", frBoot);
} else {
  frBoot();
}

// Expose helpers globally so pages can call buildEngineBars on
// non-default IDs (e.g. job-detail mini bars)
window.fr.buildEngineBars = buildEngineBars;
window.fr.buildHeatmap = buildHeatmap;
window.fr.tickThroughput = tickThroughput;
window.fr.tickWatermark = tickWatermark;
window.fr.renderIcons = renderIcons;
window.fr.renderGlyphs = renderGlyphs;
