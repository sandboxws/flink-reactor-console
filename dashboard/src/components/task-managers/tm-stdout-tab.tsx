"use client";

import { useMemo } from "react";
import type { TaskManager } from "@/data/cluster-types";
import { TextViewer } from "@/components/shared/text-viewer";

// ---------------------------------------------------------------------------
// Generate realistic TM stdout
// ---------------------------------------------------------------------------

function generateTmStdout(tm: TaskManager): string {
  return [
    `Starting Flink TaskManager (TaskManagerRunner)`,
    `  JVM version: 11.0.21+9`,
    `  Max heap size: ${Math.round(tm.jvmHeapSize / (1024 ** 2))} MB`,
    `  JVM args: -Xmx${Math.round(tm.jvmHeapSize / (1024 ** 2))}m -Xms${Math.round(tm.jvmHeapSize / (1024 ** 2))}m -XX:MaxMetaspaceSize=256m -XX:MaxDirectMemorySize=${Math.round(tm.networkMemory / (1024 ** 2))}m`,
    `  Classpath: /opt/flink/lib/*`,
    `  Working directory: /opt/flink`,
    ``,
    `Flink version: 1.20.0`,
    `Scala version: 2.12`,
    `Build date: 2025-01-10T08:30:00Z`,
    `Commit: a1b2c3d`,
    ``,
    `TaskManager ID: ${tm.id}`,
    `Resource ID: ${tm.id}`,
    `Data port: ${tm.dataPort}`,
    `Total task slots: ${tm.slotsTotal}`,
    `CPU cores: ${tm.cpuCores}`,
    `Physical memory: ${Math.round(tm.physicalMemory / (1024 ** 3))} GB`,
    `JVM heap size: ${Math.round(tm.jvmHeapSize / (1024 ** 2))} MB`,
    `Managed memory: ${Math.round(tm.managedMemory / (1024 ** 2))} MB`,
    `Network memory: ${Math.round(tm.networkMemory / (1024 ** 2))} MB`,
    ``,
    `Connecting to ResourceManager at ${tm.path.split("/user")[0]}`,
    `Successfully registered at ResourceManager.`,
  ].join("\n");
}

// ---------------------------------------------------------------------------
// TmStdoutTab
// ---------------------------------------------------------------------------

export function TmStdoutTab({ tm }: { tm: TaskManager }) {
  const stdout = useMemo(() => generateTmStdout(tm), [tm.id]);

  return (
    <div className="pt-4">
      <TextViewer text={stdout} />
    </div>
  );
}
