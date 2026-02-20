"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Radio, X, Plus, Loader2, AlertTriangle } from "lucide-react";
import { useTapStore, cleanupThroughputTracking } from "@/stores/tap-store";
import { useSqlGatewayStore } from "@/stores/sql-gateway-store";
import type { ColumnInfo, FirstPageResult } from "@/stores/sql-gateway-store";
import { buildRuntimeObservationSql } from "@/lib/tap-manifest";
import { EmptyState } from "@/components/shared/empty-state";
import { TapOperatorSelect } from "./tap-operator-select";
import { TapSourceConfig } from "./tap-source-config";
import { TapControls } from "./tap-controls";
import { TapDataTable } from "./tap-data-table";
import { TapStatusBar } from "./tap-status-bar";
import { cn } from "@/lib/cn";

interface TapPanelProps {
  jobId: string;
}

/** API route base path for SQL Gateway proxy */
const SQL_GATEWAY_API = "/api/flink/sql-gateway";

/**
 * Main tap panel with operator tabs, streaming data table, and controls.
 * Orchestrates the tap manifest, tap store, and SQL Gateway store.
 */
export function TapPanel({ jobId }: TapPanelProps) {
  const {
    availableOperators,
    manifestLoading,
    manifestError,
    tabs,
    activeTabId,
    loadManifest,
    openTab,
    closeTab,
    setActiveTab,
    updateConfig,
    appendRows,
    clearRows,
  } = useTapStore();

  const sessions = useSqlGatewayStore((s) => s.sessions);
  const startTap = useSqlGatewayStore((s) => s.startTap);
  const pauseTap = useSqlGatewayStore((s) => s.pauseTap);
  const resumeTap = useSqlGatewayStore((s) => s.resumeTap);
  const stopTap = useSqlGatewayStore((s) => s.stopTap);
  const stopAll = useSqlGatewayStore((s) => s.stopAll);

  // Active polling refs — keyed by nodeId
  const pollingRefs = useRef<Map<string, boolean>>(new Map());

  // Load manifest on mount
  useEffect(() => {
    loadManifest(jobId);
  }, [jobId, loadManifest]);

  // Cleanup on unmount — stop all sessions and throughput timer
  useEffect(() => {
    return () => {
      pollingRefs.current.forEach((_, key) => {
        pollingRefs.current.set(key, false);
      });
      stopAll();
      cleanupThroughputTracking();
    };
  }, [stopAll]);

  // Result consumption loop — polls SQL Gateway for streaming results.
  // Starts from token 1 because startTap already consumed token 0.
  const startResultConsumption = useCallback(
    async (nodeId: string) => {
      pollingRefs.current.set(nodeId, true);

      const session = useSqlGatewayStore.getState().sessions[nodeId];
      if (!session || session.status !== "streaming") return;

      // Start from token 1 — token 0 was consumed by startTap
      let resultToken = 1;
      const { sessionHandle, operationHandle } = session;

      while (pollingRefs.current.get(nodeId)) {
        const currentSession =
          useSqlGatewayStore.getState().sessions[nodeId];
        if (!currentSession) break;

        // If paused, wait and check again
        if (currentSession.status === "paused") {
          await new Promise((r) => setTimeout(r, 200));
          continue;
        }

        if (
          currentSession.status !== "streaming"
        ) {
          break;
        }

        try {
          const res = await fetch(
            `${SQL_GATEWAY_API}/v1/sessions/${sessionHandle}/operations/${operationHandle}/result/${resultToken}`,
          );

          if (!res.ok) {
            throw new Error(`Result fetch failed: ${res.status}`);
          }

          const data = (await res.json()) as {
            results: {
              columns?: Array<{
                name: string;
                logicalType: { type: string; nullable: boolean };
              }>;
              data: Array<{ kind: string; fields: unknown[] }>;
            };
            resultType: string;
            nextResultUri: string | null;
          };

          // Extract rows
          if (data.results.data && data.results.data.length > 0) {
            const tab = useTapStore.getState().tabs[nodeId];
            if (tab) {
              const colNames = tab.columns.map((c) => c.columnName);

              const rows = data.results.data.map((entry) => {
                const row: Record<string, unknown> = {};
                colNames.forEach((name, idx) => {
                  row[name] = entry.fields[idx] ?? null;
                });
                return row;
              });

              appendRows(nodeId, rows);
            }
          }

          // End of stream
          if (data.resultType === "EOS") {
            break;
          }

          resultToken++;

          // Throttle polling to avoid hammering the server
          await new Promise((r) => setTimeout(r, 500));
        } catch (err) {
          // Check if we're still supposed to be running
          if (!pollingRefs.current.get(nodeId)) break;

          const message =
            err instanceof Error ? err.message : "Result fetch failed";
          useSqlGatewayStore.setState((state) => {
            const s = state.sessions[nodeId];
            if (!s) return state;
            return {
              sessions: {
                ...state.sessions,
                [nodeId]: { ...s, status: "error", error: message },
              },
            };
          });
          break;
        }
      }

      pollingRefs.current.delete(nodeId);
    },
    [appendRows],
  );

  // Play handler
  const handlePlay = useCallback(
    async (nodeId: string) => {
      const tab = useTapStore.getState().tabs[nodeId];
      if (!tab) return;

      const session = sessions[nodeId];

      // Resume if paused
      if (session?.status === "paused") {
        resumeTap(nodeId);
        return;
      }

      // Build observation SQL with runtime overrides
      const sessionId = crypto.randomUUID().slice(0, 8);
      const observationSql = buildRuntimeObservationSql(tab.metadata, {
        offsetMode: tab.config.offsetMode,
        startTimestamp: tab.config.startTimestamp,
        endTimestamp: tab.config.endTimestamp,
        sessionId,
      });

      // Start SQL Gateway session — returns first page data (columns + rows)
      const firstPage = await startTap(nodeId, tab.name, observationSql);

      // Process first page rows (token 0 was consumed by startTap)
      if (firstPage) {
        const colNames = firstPage.columns.map((c) => c.columnName);
        if (firstPage.rows.length > 0) {
          const rows = firstPage.rows.map((entry) => {
            const row: Record<string, unknown> = {};
            colNames.forEach((name, idx) => {
              row[name] = entry.fields[idx] ?? null;
            });
            return row;
          });
          appendRows(nodeId, rows, firstPage.columns);
        } else {
          // No rows yet but set columns
          appendRows(nodeId, [], firstPage.columns);
        }
      }

      // Begin result consumption from token 1
      startResultConsumption(nodeId);
    },
    [sessions, startTap, resumeTap, startResultConsumption],
  );

  // Pause handler
  const handlePause = useCallback(
    (nodeId: string) => {
      pauseTap(nodeId);
    },
    [pauseTap],
  );

  // Stop handler
  const handleStop = useCallback(
    async (nodeId: string) => {
      pollingRefs.current.set(nodeId, false);
      await stopTap(nodeId);
    },
    [stopTap],
  );

  // Close tab handler — stops session then closes tab
  const handleCloseTab = useCallback(
    async (nodeId: string) => {
      pollingRefs.current.set(nodeId, false);
      const session = sessions[nodeId];
      if (
        session &&
        (session.status === "streaming" || session.status === "paused")
      ) {
        await stopTap(nodeId);
      }
      closeTab(nodeId);
    },
    [sessions, stopTap, closeTab],
  );

  // Clear handler
  const handleClear = useCallback(
    (nodeId: string) => {
      clearRows(nodeId);
    },
    [clearRows],
  );

  // Loading state
  if (manifestLoading) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-16 text-zinc-500">
        <Loader2 className="size-6 animate-spin opacity-40" />
        <p className="text-xs">Loading tap manifest...</p>
      </div>
    );
  }

  // Error state
  if (manifestError) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-16 text-zinc-500">
        <AlertTriangle className="size-6 opacity-40 text-fr-amber" />
        <p className="text-xs text-fr-amber">{manifestError}</p>
      </div>
    );
  }

  // Empty state — no tapped operators
  if (availableOperators.length === 0) {
    return (
      <EmptyState
        icon={Radio}
        message="No tapped operators found. Add tap={true} to pipeline components to enable observation."
      />
    );
  }

  const activeTab = activeTabId ? tabs[activeTabId] : null;
  const tabIds = Object.keys(tabs);
  const openNodeIds = tabIds;

  return (
    <div className="flex flex-col gap-3">
      {/* Tab bar + operator selector */}
      <div className="flex items-center gap-2">
        {/* Open tabs */}
        {tabIds.length > 0 && (
          <div className="flex items-center gap-0.5 rounded-md bg-dash-surface p-0.5">
            {tabIds.map((nodeId) => {
              const tab = tabs[nodeId];
              const session = sessions[nodeId];
              const isActive = nodeId === activeTabId;

              return (
                <div
                  key={nodeId}
                  className={cn(
                    "flex items-center gap-1.5 rounded px-2.5 py-1 text-xs transition-colors",
                    isActive
                      ? "bg-fr-purple/20 text-fr-purple"
                      : "text-zinc-500 hover:text-zinc-300",
                  )}
                >
                  <button
                    type="button"
                    onClick={() => setActiveTab(nodeId)}
                    className="flex items-center gap-1.5"
                  >
                    {session?.status === "streaming" && (
                      <span className="relative flex size-1.5">
                        <span className="absolute inline-flex size-full animate-ping rounded-full bg-job-running opacity-75" />
                        <span className="relative inline-flex size-1.5 rounded-full bg-job-running" />
                      </span>
                    )}
                    <span className="max-w-[150px] truncate font-medium">
                      {tab.name}
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleCloseTab(nodeId)}
                    className="rounded p-0.5 text-zinc-600 transition-colors hover:bg-dash-hover hover:text-zinc-300"
                    title="Close tab"
                  >
                    <X className="size-3" />
                  </button>
                </div>
              );
            })}
          </div>
        )}

        {/* Add new tab button (opens selector) */}
        {availableOperators.length > openNodeIds.length && (
          <AddTabDropdown
            operators={availableOperators}
            disabledNodeIds={openNodeIds}
            onSelect={openTab}
          />
        )}
      </div>

      {/* Main content area */}
      {tabIds.length === 0 ? (
        // No tabs open — show full operator selector
        <TapOperatorSelect
          operators={availableOperators}
          onSelect={openTab}
          disabledNodeIds={openNodeIds}
        />
      ) : activeTab ? (
        // Active tab content
        <div className="flex flex-col gap-2">
          {/* Source config (collapsible) */}
          <div className="glass-card overflow-hidden">
            <TapSourceConfig
              config={activeTab.config}
              consumerGroupId={activeTab.metadata.consumerGroupId}
              onConfigChange={(cfg) => updateConfig(activeTabId!, cfg)}
            />
          </div>

          {/* Controls */}
          <div className="glass-card px-3 py-2">
            <TapControls
              status={sessions[activeTabId!]?.status ?? "idle"}
              onPlay={() => handlePlay(activeTabId!)}
              onPause={() => handlePause(activeTabId!)}
              onStop={() => handleStop(activeTabId!)}
              onClear={() => handleClear(activeTabId!)}
            />
          </div>

          {/* Data table */}
          <TapDataTable
            columns={activeTab.columns}
            rows={activeTab.rows}
            isStreaming={sessions[activeTabId!]?.status === "streaming"}
          />

          {/* Status bar */}
          <TapStatusBar
            totalRowCount={activeTab.totalRowCount}
            rowsPerSecond={activeTab.rowsPerSecond}
            bufferSize={activeTab.config.bufferSize}
            currentBufferCount={activeTab.rows.length}
            status={sessions[activeTabId!]?.status ?? "idle"}
            consumerGroupId={activeTab.metadata.consumerGroupId}
            error={sessions[activeTabId!]?.error}
          />
        </div>
      ) : null}
    </div>
  );
}

// ── Inline add-tab dropdown ──────────────────────────────────────────────────

function AddTabDropdown({
  operators,
  disabledNodeIds,
  onSelect,
}: {
  operators: import("@/data/tap-types").TapMetadata[];
  disabledNodeIds: string[];
  onSelect: (nodeId: string) => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1 rounded-md border border-dashed border-dash-border px-2 py-1 text-xs text-zinc-500 transition-colors hover:border-fr-purple hover:text-fr-purple"
        title="Add a new tap tab"
      >
        <Plus className="size-3" />
        Add
      </button>
      {open && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-40"
            onClick={() => setOpen(false)}
          />
          {/* Dropdown */}
          <div className="absolute left-0 top-full z-50 mt-1 min-w-[260px] rounded-lg border border-dash-border bg-dash-panel shadow-xl">
            {operators
              .filter((op) => !disabledNodeIds.includes(op.nodeId))
              .map((op) => (
                <button
                  key={op.nodeId}
                  type="button"
                  onClick={() => {
                    onSelect(op.nodeId);
                    setOpen(false);
                  }}
                  className="flex w-full items-center gap-3 px-3 py-2 text-left text-xs text-zinc-300 transition-colors first:rounded-t-lg last:rounded-b-lg hover:bg-dash-hover"
                >
                  <span className="flex-1 truncate font-medium">
                    {op.name}
                  </span>
                  <span className="shrink-0 rounded bg-dash-elevated px-1.5 py-0.5 font-mono text-[10px] text-zinc-500">
                    {op.connectorType}
                  </span>
                </button>
              ))}
          </div>
        </>
      )}
    </div>
  );
}

