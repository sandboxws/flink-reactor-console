import { create } from "zustand";

// ---------------------------------------------------------------------------
// SQL Gateway Store — manages active SQL Gateway tap observation sessions
// ---------------------------------------------------------------------------

/** Column metadata from SQL Gateway result set */
export interface ColumnInfo {
  columnName: string;
  dataType: string;
  nullable: boolean;
}

export interface ActiveTapSession {
  sessionHandle: string;
  operationHandle: string;
  tapNodeId: string;
  tapName: string;
  status: "connecting" | "streaming" | "paused" | "error" | "closed";
  columns: ColumnInfo[];
  error?: string;
}

interface SqlGatewayState {
  /** Active tap sessions keyed by tapNodeId */
  sessions: Record<string, ActiveTapSession>;

  /** Start a tap observation session — opens session, submits SQL, transitions to streaming */
  startTap: (
    tapNodeId: string,
    tapName: string,
    observationSql: string,
  ) => Promise<void>;

  /** Pause result fetching for a session (consumer stops polling) */
  pauseTap: (tapNodeId: string) => void;

  /** Resume result fetching for a paused session */
  resumeTap: (tapNodeId: string) => void;

  /** Stop and close a tap session */
  stopTap: (tapNodeId: string) => Promise<void>;

  /** Stop all active sessions (used on page unmount) */
  stopAll: () => Promise<void>;
}

/** API route base path for SQL Gateway proxy */
const SQL_GATEWAY_API = "/api/flink/sql-gateway";

async function apiRequest<T>(
  path: string,
  method: string = "GET",
  body?: unknown,
): Promise<T> {
  const res = await fetch(`${SQL_GATEWAY_API}/${path}`, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(err.error ?? `SQL Gateway error: ${res.status}`);
  }

  // DELETE may return empty body
  if (res.status === 204 || method === "DELETE") {
    return undefined as T;
  }

  return (await res.json()) as T;
}

export const useSqlGatewayStore = create<SqlGatewayState>((set, get) => ({
  sessions: {},

  startTap: async (tapNodeId, tapName, observationSql) => {
    // Set connecting status
    set((state) => ({
      sessions: {
        ...state.sessions,
        [tapNodeId]: {
          sessionHandle: "",
          operationHandle: "",
          tapNodeId,
          tapName,
          status: "connecting",
          columns: [],
        },
      },
    }));

    try {
      // Open session
      const { sessionHandle } = await apiRequest<{ sessionHandle: string }>(
        "v1/sessions",
        "POST",
        { properties: {} },
      );

      // Submit observation SQL
      const { operationHandle } = await apiRequest<{
        operationHandle: string;
      }>(`v1/sessions/${sessionHandle}/statements`, "POST", {
        statement: observationSql,
      });

      // Fetch first result page for column metadata
      const resultData = await apiRequest<{
        results: {
          columns: Array<{
            name: string;
            logicalType: { type: string; nullable: boolean };
          }>;
        };
        resultType: string;
      }>(
        `v1/sessions/${sessionHandle}/operations/${operationHandle}/result/0`,
      );

      const columns: ColumnInfo[] = (resultData.results?.columns ?? []).map(
        (col) => ({
          columnName: col.name,
          dataType: col.logicalType.type,
          nullable: col.logicalType.nullable,
        }),
      );

      // Transition to streaming
      set((state) => ({
        sessions: {
          ...state.sessions,
          [tapNodeId]: {
            sessionHandle,
            operationHandle,
            tapNodeId,
            tapName,
            status: "streaming",
            columns,
          },
        },
      }));
    } catch (err) {
      const message = err instanceof Error ? err.message : "Connection failed";
      set((state) => ({
        sessions: {
          ...state.sessions,
          [tapNodeId]: {
            ...state.sessions[tapNodeId],
            status: "error",
            error: message,
          },
        },
      }));
    }
  },

  pauseTap: (tapNodeId) => {
    set((state) => {
      const session = state.sessions[tapNodeId];
      if (!session || session.status !== "streaming") return state;
      return {
        sessions: {
          ...state.sessions,
          [tapNodeId]: { ...session, status: "paused" },
        },
      };
    });
  },

  resumeTap: (tapNodeId) => {
    set((state) => {
      const session = state.sessions[tapNodeId];
      if (!session || session.status !== "paused") return state;
      return {
        sessions: {
          ...state.sessions,
          [tapNodeId]: { ...session, status: "streaming" },
        },
      };
    });
  },

  stopTap: async (tapNodeId) => {
    const session = get().sessions[tapNodeId];
    if (!session) return;

    try {
      // Cancel operation if it's active
      if (
        session.operationHandle &&
        (session.status === "streaming" || session.status === "paused")
      ) {
        await apiRequest(
          `v1/sessions/${session.sessionHandle}/operations/${session.operationHandle}/cancel`,
          "POST",
        ).catch(() => {});
      }

      // Close session
      if (session.sessionHandle) {
        await apiRequest(
          `v1/sessions/${session.sessionHandle}`,
          "DELETE",
        ).catch(() => {});
      }
    } finally {
      // Remove from store regardless of cleanup success
      set((state) => {
        const { [tapNodeId]: _, ...remaining } = state.sessions;
        return { sessions: remaining };
      });
    }
  },

  stopAll: async () => {
    const sessions = get().sessions;
    const nodeIds = Object.keys(sessions);

    await Promise.allSettled(
      nodeIds.map((nodeId) => get().stopTap(nodeId)),
    );
  },
}));
