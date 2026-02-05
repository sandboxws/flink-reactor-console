import type { LogSource } from "@/data/types";

const SHORT_LABELS: Record<string, string> = {
  jobmanager: "JM",
  taskmanager: "TM",
  client: "CLI",
};

export function SourceBadge({ source }: { source: LogSource }) {
  const short = SHORT_LABELS[source.type] ?? source.type;
  // For TMs, append the numeric part of the id (e.g. "TM-1")
  const label =
    source.type === "taskmanager"
      ? `${short}-${source.id.replace(/\D/g, "") || source.id}`
      : short;

  return (
    <span className="source-badge border border-fr-purple/20 text-fr-purple/70">
      {label}
    </span>
  );
}
