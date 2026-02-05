"use client";

import { format, formatDistanceToNow } from "date-fns";
import { ExternalLink } from "lucide-react";
import Link from "next/link";
import type { ErrorGroup } from "@/data/types";
import { SourceBadge } from "@/components/shared/source-badge";
import { StackTrace } from "./stack-trace";

// ---------------------------------------------------------------------------
// Field helper (mirrors log-detail-panel pattern)
// ---------------------------------------------------------------------------

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex gap-2 text-xs">
      <span className="w-20 shrink-0 text-zinc-500">{label}</span>
      <span className="min-w-0 text-zinc-200">{children}</span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Error detail
// ---------------------------------------------------------------------------

export function ErrorDetail({ group }: { group: ErrorGroup }) {
  return (
    <div className="flex flex-col gap-4 overflow-auto p-4">
      {/* Exception header */}
      <div>
        <h2 className="text-sm font-semibold text-log-error">
          {group.exceptionClass}
        </h2>
        <p className="mt-1 text-xs leading-relaxed text-zinc-400">
          {group.message || "No message"}
        </p>
      </div>

      {/* Metadata fields */}
      <div className="space-y-2">
        <Field label="Occurrences">
          <span className="font-semibold tabular-nums text-log-error">
            {group.count}
          </span>
        </Field>
        <Field label="First seen">
          {format(group.firstSeen, "yyyy-MM-dd HH:mm:ss.SSS")}
          <span className="ml-1 text-zinc-600">
            ({formatDistanceToNow(group.firstSeen, { addSuffix: true })})
          </span>
        </Field>
        <Field label="Last seen">
          {format(group.lastSeen, "yyyy-MM-dd HH:mm:ss.SSS")}
          <span className="ml-1 text-zinc-600">
            ({formatDistanceToNow(group.lastSeen, { addSuffix: true })})
          </span>
        </Field>
        <Field label="Sources">
          <div className="flex flex-wrap gap-1">
            {group.affectedSources.map((src) => (
              <SourceBadge key={src.id} source={src} />
            ))}
          </div>
        </Field>
      </div>

      {/* Stack trace */}
      {group.sampleEntry.stackTrace && (
        <div>
          <h3 className="mb-2 text-xs font-medium text-zinc-400">
            Stack Trace
          </h3>
          <StackTrace raw={group.sampleEntry.stackTrace} />
        </div>
      )}

      {/* Link to related log entries */}
      <div>
        <Link
          href={`/logs?level=ERROR&from=${group.firstSeen.toISOString()}&to=${group.lastSeen.toISOString()}`}
          className="inline-flex items-center gap-1 text-[11px] text-fr-purple hover:text-fr-purple/80 transition-colors"
        >
          <ExternalLink className="size-3" />
          View related log entries
        </Link>
      </div>
    </div>
  );
}
