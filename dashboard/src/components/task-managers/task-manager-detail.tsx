"use client";

import { ArrowLeft, Server, Clock, Cpu, HardDrive } from "lucide-react";
import Link from "next/link";
import { format } from "date-fns";
import type { TaskManager } from "@/data/cluster-types";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { TmOverviewTab } from "./tm-overview-tab";
import { TmMetricsTab } from "./tm-metrics-tab";
import { TmLogsTab } from "./tm-logs-tab";
import { TmStdoutTab } from "./tm-stdout-tab";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const GB = 1024 ** 3;
const MB = 1024 ** 2;

function formatBytes(bytes: number): string {
  if (bytes >= GB) return `${(bytes / GB).toFixed(1)} GB`;
  if (bytes >= MB) return `${Math.round(bytes / MB)} MB`;
  return `${Math.round(bytes / 1024)} KB`;
}

function InfoItem({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[10px] font-medium uppercase tracking-wide text-zinc-600">
        {label}
      </span>
      <span className="text-xs text-zinc-300">{value}</span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// TaskManagerDetail — tabbed detail view for a single TM
// ---------------------------------------------------------------------------

export function TaskManagerDetail({ tm }: { tm: TaskManager }) {
  return (
    <div className="flex flex-col gap-4 p-4">
      {/* Back link */}
      <Link
        href="/task-managers"
        className="flex w-fit items-center gap-1 text-xs text-zinc-500 transition-colors hover:text-zinc-300"
      >
        <ArrowLeft className="size-3" />
        Task Managers
      </Link>

      {/* Header */}
      <div className="flex items-center gap-3">
        <Server className="size-5 text-fr-purple" />
        <div className="min-w-0">
          <h1 className="text-lg font-semibold text-zinc-100">Task Manager</h1>
          <p className="mt-0.5 font-mono text-xs text-zinc-600">{tm.id}</p>
        </div>
      </div>

      {/* Info panel */}
      <div className="glass-card grid gap-x-8 gap-y-3 p-4 sm:grid-cols-2 lg:grid-cols-4">
        <InfoItem label="Path" value={
          <span className="font-mono text-[11px] text-zinc-400 break-all">{tm.path}</span>
        } />
        <InfoItem label="Free / All Slots" value={
          <span className="tabular-nums">
            {tm.slotsFree} <span className="text-zinc-600">/</span> {tm.slotsTotal}
          </span>
        } />
        <InfoItem label="Last Heartbeat" value={
          <span className="inline-flex items-center gap-1 tabular-nums">
            <Clock className="size-3 text-zinc-600" />
            {format(tm.lastHeartbeat, "yyyy-MM-dd HH:mm:ss")}
          </span>
        } />
        <InfoItem label="Data Port" value={
          <span className="tabular-nums">{tm.dataPort}</span>
        } />
        <InfoItem label="CPU Cores" value={
          <span className="inline-flex items-center gap-1 tabular-nums">
            <Cpu className="size-3 text-zinc-600" />
            {tm.cpuCores}
          </span>
        } />
        <InfoItem label="Physical Memory" value={
          <span className="inline-flex items-center gap-1 tabular-nums">
            <HardDrive className="size-3 text-zinc-600" />
            {formatBytes(tm.physicalMemory)}
          </span>
        } />
        <InfoItem label="JVM Heap Size" value={
          <span className="tabular-nums">{formatBytes(tm.metrics.heapMax)}</span>
        } />
        <InfoItem label="Flink Managed Memory" value={
          <span className="tabular-nums">{formatBytes(tm.memoryConfiguration.managedMemory)}</span>
        } />
      </div>

      {/* Tabs */}
      <Tabs defaultValue="overview">
        <TabsList className="detail-tabs-list">
          <TabsTrigger value="overview" className="detail-tab">
            Overview
          </TabsTrigger>
          <TabsTrigger value="metrics" className="detail-tab">
            Metrics
          </TabsTrigger>
          <TabsTrigger value="logs" className="detail-tab">
            Logs
          </TabsTrigger>
          <TabsTrigger value="stdout" className="detail-tab">
            Stdout
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <TmOverviewTab tm={tm} />
        </TabsContent>
        <TabsContent value="metrics">
          <TmMetricsTab tm={tm} />
        </TabsContent>
        <TabsContent value="logs">
          <TmLogsTab tm={tm} />
        </TabsContent>
        <TabsContent value="stdout">
          <TmStdoutTab tm={tm} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
