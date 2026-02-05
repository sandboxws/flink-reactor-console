import { create } from "zustand";
import type { ErrorGroup, LogEntry, LogSource } from "@/data/types";

// ---------------------------------------------------------------------------
// Error store — auto-groups exceptions by class + message prefix
// ---------------------------------------------------------------------------

type SortBy = "lastSeen" | "count" | "firstSeen";

interface ErrorState {
  groups: Map<string, ErrorGroup>;
  selectedGroupId: string | null;
  sortBy: SortBy;
}

interface ErrorActions {
  processEntry: (entry: LogEntry) => void;
  selectGroup: (groupId: string | null) => void;
  setSortBy: (sortBy: SortBy) => void;
  clear: () => void;
}

export type ErrorStore = ErrorState & ErrorActions;

/** Build a group key from exception class + first 100 chars of message. */
function buildGroupKey(entry: LogEntry): string | null {
  if (!entry.isException || !entry.stackTrace) return null;

  // Extract exception class from first line of stack trace
  const firstLine = entry.stackTrace.split("\n")[0];
  const colonIdx = firstLine.indexOf(":");
  const exceptionClass =
    colonIdx !== -1
      ? firstLine.substring(0, colonIdx).trim()
      : firstLine.trim();
  const message =
    colonIdx !== -1 ? firstLine.substring(colonIdx + 1).trim() : "";

  return `${exceptionClass}|${message.substring(0, 100)}`;
}

function extractExceptionInfo(entry: LogEntry): {
  exceptionClass: string;
  message: string;
} {
  if (!entry.stackTrace) return { exceptionClass: "Unknown", message: "" };

  const firstLine = entry.stackTrace.split("\n")[0];
  const colonIdx = firstLine.indexOf(":");
  const exceptionClass =
    colonIdx !== -1
      ? firstLine.substring(0, colonIdx).trim()
      : firstLine.trim();
  const message =
    colonIdx !== -1 ? firstLine.substring(colonIdx + 1).trim() : "";

  return { exceptionClass, message };
}

function addSourceIfNew(existing: LogSource[], source: LogSource): LogSource[] {
  if (existing.some((s) => s.id === source.id)) return existing;
  return [...existing, source];
}

let groupIdCounter = 0;

export const useErrorStore = create<ErrorStore>((set) => ({
  groups: new Map(),
  selectedGroupId: null,
  sortBy: "lastSeen",

  processEntry: (entry: LogEntry) => {
    const key = buildGroupKey(entry);
    if (!key) return;

    set((state) => {
      const next = new Map(state.groups);
      const existing = next.get(key);

      if (existing) {
        next.set(key, {
          ...existing,
          count: existing.count + 1,
          lastSeen: entry.timestamp,
          occurrences: [...existing.occurrences, entry.timestamp],
          affectedSources: addSourceIfNew(
            existing.affectedSources,
            entry.source,
          ),
        });
      } else {
        const { exceptionClass, message } = extractExceptionInfo(entry);
        const group: ErrorGroup = {
          id: `err-group-${++groupIdCounter}`,
          exceptionClass,
          message,
          count: 1,
          firstSeen: entry.timestamp,
          lastSeen: entry.timestamp,
          occurrences: [entry.timestamp],
          sampleEntry: entry,
          affectedSources: [entry.source],
        };
        next.set(key, group);
      }

      return { groups: next };
    });
  },

  selectGroup: (groupId: string | null) => {
    set({ selectedGroupId: groupId });
  },

  setSortBy: (sortBy: SortBy) => {
    set({ sortBy });
  },

  clear: () => {
    set({ groups: new Map(), selectedGroupId: null });
  },
}));
