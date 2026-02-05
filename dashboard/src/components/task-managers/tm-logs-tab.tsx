"use client";

import { useMemo } from "react";
import type { TaskManager } from "@/data/cluster-types";
import { TextViewer } from "@/components/shared/text-viewer";
import {
  TM_LOGGERS,
  PLACEHOLDER_VALUES,
  fillTemplate,
  pickRandom,
} from "@/data/flink-loggers";

// ---------------------------------------------------------------------------
// Generate realistic TM log lines
// ---------------------------------------------------------------------------

function generateTmLogs(tm: TaskManager): string {
  const lines: string[] = [];
  const baseDate = new Date(Date.now() - 60 * 60_000); // 1 hour ago
  const severities = ["INFO", "INFO", "INFO", "INFO", "WARN", "DEBUG"];

  for (let i = 0; i < 40; i++) {
    const ts = new Date(baseDate.getTime() + i * 90_000);
    const dateStr = ts.toISOString().replace("T", " ").slice(0, 23).replace(".", ",");
    const severity = pickRandom(severities);
    const logger = pickRandom(TM_LOGGERS);
    const message = fillTemplate(pickRandom(logger.messages));

    // Pad logger to 60 chars like real Flink logs
    const loggerPadded = logger.logger.padEnd(60);

    lines.push(
      `${dateStr} ${severity.padEnd(5)} ${loggerPadded} - ${message}`,
    );
  }

  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// TmLogsTab
// ---------------------------------------------------------------------------

export function TmLogsTab({ tm }: { tm: TaskManager }) {
  const logs = useMemo(() => generateTmLogs(tm), [tm.id]);

  return (
    <div className="pt-4">
      <TextViewer text={logs} />
    </div>
  );
}
