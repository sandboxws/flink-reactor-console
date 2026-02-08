"use client";

import { ArrowLeft, Settings } from "lucide-react";
import Link from "next/link";
import type { JobManagerInfo } from "@/data/cluster-types";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { JmConfigTab } from "./jm-config-tab";
import { JmMetricsTab } from "./jm-metrics-tab";
import { JmLogsTab } from "./jm-logs-tab";
import { JmStdoutTab } from "./jm-stdout-tab";
import { JmLogListTab } from "./jm-log-list-tab";
import { JmThreadDumpTab } from "./jm-thread-dump-tab";
import { JmProfilerTab } from "./jm-profiler-tab";

// ---------------------------------------------------------------------------
// JobManagerPage — tabbed detail view for the Job Manager
// ---------------------------------------------------------------------------

export function JobManagerPage({ jm }: { jm: JobManagerInfo }) {
  return (
    <div className="flex flex-col gap-4 p-4">
      {/* Back link */}
      <Link
        href="/overview"
        className="flex w-fit items-center gap-1 text-xs text-zinc-500 transition-colors hover:text-zinc-300"
      >
        <ArrowLeft className="size-3" />
        Overview
      </Link>

      {/* Header */}
      <div className="flex items-center gap-3">
        <Settings className="size-5 text-fr-purple" />
        <div className="min-w-0">
          <h1 className="text-lg font-semibold text-zinc-100">Job Manager</h1>
          <p className="mt-0.5 font-mono text-xs text-zinc-600">
            flink-jobmanager:6123
          </p>
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="configuration">
        <TabsList className="detail-tabs-list">
          <TabsTrigger value="configuration" className="detail-tab">
            Configuration
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
          <TabsTrigger value="log-list" className="detail-tab">
            Log List
          </TabsTrigger>
          <TabsTrigger value="thread-dump" className="detail-tab">
            Thread Dump
          </TabsTrigger>
          <TabsTrigger value="profiler" className="detail-tab">
            Profiler
          </TabsTrigger>
        </TabsList>

        <TabsContent value="configuration">
          <JmConfigTab
            config={jm.config}
            jvm={jm.jvm}
            classpath={jm.classpath}
          />
        </TabsContent>
        <TabsContent value="metrics">
          <JmMetricsTab metrics={jm.metrics} />
        </TabsContent>
        <TabsContent value="logs">
          <JmLogsTab logs={jm.logs} />
        </TabsContent>
        <TabsContent value="stdout">
          <JmStdoutTab stdout={jm.stdout} />
        </TabsContent>
        <TabsContent value="log-list">
          <JmLogListTab />
        </TabsContent>
        <TabsContent value="thread-dump">
          <JmThreadDumpTab />
        </TabsContent>
        <TabsContent value="profiler">
          <JmProfilerTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
