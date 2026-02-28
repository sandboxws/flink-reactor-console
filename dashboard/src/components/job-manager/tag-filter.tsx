"use client";

// ---------------------------------------------------------------------------
// Shared tag badge + filter chip components for config & classpath sections
// ---------------------------------------------------------------------------

// Tag color map — uses CSS custom properties so colors adapt to light/dark theme.
// bg and border are derived via color-mix() at render time.
const TAG_COLORS: Record<string, string> = {
  // Classpath tags
  "flink-core": "var(--color-log-debug)",
  "flink-sql":  "var(--color-log-info)",
  connector:    "var(--color-job-running)",
  log4j:        "var(--color-log-warn)",
  hadoop:       "var(--color-fr-purple)",
  scala:        "var(--color-fr-coral)",
  // Config tags
  jobmanager:   "var(--color-log-debug)",
  taskmanager:  "var(--color-job-running)",
  state:        "var(--color-fr-purple)",
  checkpoint:   "var(--color-log-warn)",
  restart:      "var(--color-log-error)",
  kubernetes:   "var(--color-log-info)",
  ha:           "var(--color-fr-coral)",
  metrics:      "var(--color-fr-purple)",
  rest:         "var(--color-fg-muted)",
  web:          "var(--color-fg-muted)",
  pipeline:     "var(--color-job-running)",
  security:     "var(--color-log-error)",
  table:        "var(--color-log-info)",
  // Fallback
  other:        "var(--color-log-trace)",
};

function getTagColor(tag: string): string {
  return TAG_COLORS[tag] ?? TAG_COLORS.other;
}

function tagStyle(color: string) {
  return {
    bg: `color-mix(in srgb, ${color} 12%, transparent)`,
    text: color,
    border: `color-mix(in srgb, ${color} 25%, transparent)`,
  };
}

export function TagBadge({ tag }: { tag: string }) {
  const color = getTagColor(tag);
  const s = tagStyle(color);

  return (
    <span
      className="inline-flex items-center rounded-full px-2 py-0.5 font-mono text-[10px] font-medium leading-none"
      style={{
        backgroundColor: s.bg,
        color: s.text,
        border: `1px solid ${s.border}`,
      }}
    >
      {tag}
    </span>
  );
}

export function TagChip({
  tag,
  count,
  active,
  onClick,
}: {
  tag: string;
  count: number;
  active: boolean;
  onClick: () => void;
}) {
  const color = getTagColor(tag);
  const s = tagStyle(color);

  return (
    <button
      onClick={onClick}
      className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 font-mono text-[10px] font-medium transition-all duration-200"
      style={{
        backgroundColor: active ? s.bg : "transparent",
        color: active ? s.text : "var(--color-fg-dim)",
        border: `1px solid ${active ? s.border : "var(--color-dash-border)"}`,
      }}
    >
      {tag}
      <span
        className="rounded-full px-1 py-0.5 text-[9px] leading-none"
        style={{
          backgroundColor: active ? s.border : "var(--color-chart-cursor-fill)",
          color: active ? s.text : "var(--color-fg-faint)",
        }}
      >
        {count}
      </span>
    </button>
  );
}

// ---------------------------------------------------------------------------
// Config key → tag classifier
// ---------------------------------------------------------------------------

const CONFIG_TAG_MAP: Record<string, string> = {
  "jobmanager": "jobmanager",
  "taskmanager": "taskmanager",
  "state": "state",
  "execution": "checkpoint",
  "restart-strategy": "restart",
  "rest": "rest",
  "web": "web",
  "parallelism": "pipeline",
  "pipeline": "pipeline",
  "high-availability": "ha",
  "kubernetes": "kubernetes",
  "metrics": "metrics",
  "blob": "other",
  "classloader": "other",
  "akka": "other",
  "security": "security",
  "table": "table",
};

export function classifyConfigKey(key: string): string {
  // Try the first dotted segment, then check for hyphenated prefixes
  const firstDot = key.indexOf(".");
  const firstSegment = firstDot > 0 ? key.slice(0, firstDot) : key;

  if (CONFIG_TAG_MAP[firstSegment]) return CONFIG_TAG_MAP[firstSegment];

  // Handle hyphenated keys like "restart-strategy"
  const hyphenatedPrefix = key.split(".")[0];
  if (CONFIG_TAG_MAP[hyphenatedPrefix]) return CONFIG_TAG_MAP[hyphenatedPrefix];

  return "other";
}
