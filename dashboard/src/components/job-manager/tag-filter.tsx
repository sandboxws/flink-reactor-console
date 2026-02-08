"use client";

// ---------------------------------------------------------------------------
// Shared tag badge + filter chip components for config & classpath sections
// ---------------------------------------------------------------------------

// Tokyo Night palette for tag colors — shared across all tag-based UI
const TAG_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  // Classpath tags
  "flink-core": { bg: "rgba(122, 162, 247, 0.12)", text: "#7aa2f7", border: "rgba(122, 162, 247, 0.25)" },
  "flink-sql":  { bg: "rgba(125, 207, 255, 0.12)", text: "#7dcfff", border: "rgba(125, 207, 255, 0.25)" },
  connector:    { bg: "rgba(115, 218, 202, 0.12)", text: "#73daca", border: "rgba(115, 218, 202, 0.25)" },
  log4j:        { bg: "rgba(224, 175, 104, 0.12)", text: "#e0af68", border: "rgba(224, 175, 104, 0.25)" },
  hadoop:       { bg: "rgba(155, 107, 191, 0.12)", text: "#9b6bbf", border: "rgba(155, 107, 191, 0.25)" },
  scala:        { bg: "rgba(217, 112, 133, 0.12)", text: "#d97085", border: "rgba(217, 112, 133, 0.25)" },
  // Config tags
  jobmanager:   { bg: "rgba(122, 162, 247, 0.12)", text: "#7aa2f7", border: "rgba(122, 162, 247, 0.25)" },
  taskmanager:  { bg: "rgba(115, 218, 202, 0.12)", text: "#73daca", border: "rgba(115, 218, 202, 0.25)" },
  state:        { bg: "rgba(155, 107, 191, 0.12)", text: "#9b6bbf", border: "rgba(155, 107, 191, 0.25)" },
  checkpoint:   { bg: "rgba(224, 175, 104, 0.12)", text: "#e0af68", border: "rgba(224, 175, 104, 0.25)" },
  restart:      { bg: "rgba(247, 118, 142, 0.12)", text: "#f7768e", border: "rgba(247, 118, 142, 0.25)" },
  kubernetes:   { bg: "rgba(125, 207, 255, 0.12)", text: "#7dcfff", border: "rgba(125, 207, 255, 0.25)" },
  ha:           { bg: "rgba(217, 112, 133, 0.12)", text: "#d97085", border: "rgba(217, 112, 133, 0.25)" },
  metrics:      { bg: "rgba(187, 154, 247, 0.12)", text: "#bb9af7", border: "rgba(187, 154, 247, 0.25)" },
  rest:         { bg: "rgba(212, 212, 216, 0.10)", text: "#a1a1aa", border: "rgba(212, 212, 216, 0.20)" },
  web:          { bg: "rgba(212, 212, 216, 0.10)", text: "#a1a1aa", border: "rgba(212, 212, 216, 0.20)" },
  pipeline:     { bg: "rgba(115, 218, 202, 0.12)", text: "#73daca", border: "rgba(115, 218, 202, 0.25)" },
  security:     { bg: "rgba(247, 118, 142, 0.12)", text: "#f7768e", border: "rgba(247, 118, 142, 0.25)" },
  table:        { bg: "rgba(125, 207, 255, 0.12)", text: "#7dcfff", border: "rgba(125, 207, 255, 0.25)" },
  // Fallback
  other:        { bg: "rgba(86, 95, 137, 0.12)", text: "#565f89", border: "rgba(86, 95, 137, 0.25)" },
};

export function getTagStyle(tag: string) {
  return TAG_COLORS[tag] ?? TAG_COLORS.other;
}

export function TagBadge({ tag }: { tag: string }) {
  const style = getTagStyle(tag);

  return (
    <span
      className="inline-flex items-center rounded-full px-2 py-0.5 font-mono text-[10px] font-medium leading-none"
      style={{
        backgroundColor: style.bg,
        color: style.text,
        border: `1px solid ${style.border}`,
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
  const style = getTagStyle(tag);

  return (
    <button
      onClick={onClick}
      className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 font-mono text-[10px] font-medium transition-all duration-200"
      style={{
        backgroundColor: active ? style.bg : "transparent",
        color: active ? style.text : "#71717a",
        border: `1px solid ${active ? style.border : "rgba(255, 255, 255, 0.06)"}`,
      }}
    >
      {tag}
      <span
        className="rounded-full px-1 py-0.5 text-[9px] leading-none"
        style={{
          backgroundColor: active ? style.border : "rgba(255, 255, 255, 0.04)",
          color: active ? style.text : "#52525b",
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
