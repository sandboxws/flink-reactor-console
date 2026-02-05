"use client";

import { ArrowLeft, Server } from "lucide-react";
import Link from "next/link";
import type { TaskManager } from "@/data/cluster-types";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { TmMetricsTab } from "./tm-metrics-tab";
import { TmLogsTab } from "./tm-logs-tab";
import { TmStdoutTab } from "./tm-stdout-tab";

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

      {/* Tabs */}
      <Tabs defaultValue="metrics">
        <TabsList className="detail-tabs-list">
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
