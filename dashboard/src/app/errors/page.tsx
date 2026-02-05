"use client";

import { useEffect, useRef } from "react";
import { ErrorExplorer } from "@/components/errors/error-explorer";
import { useErrorStore } from "@/stores/error-store";
import { useLogStore } from "@/stores/log-store";

// ---------------------------------------------------------------------------
// Errors page — subscribes to log store and feeds exceptions into error store
// ---------------------------------------------------------------------------

export default function ErrorsPage() {
  const processEntry = useErrorStore((s) => s.processEntry);
  const startStreaming = useLogStore((s) => s.startStreaming);
  const stopStreaming = useLogStore((s) => s.stopStreaming);
  const processedCountRef = useRef(0);

  // Start streaming if not already running
  useEffect(() => {
    startStreaming();
    return () => stopStreaming();
  }, [startStreaming, stopStreaming]);

  // Subscribe to log store entries and process new exceptions into error store
  useEffect(() => {
    const unsub = useLogStore.subscribe((state) => {
      const entries = state.entries;
      const start = processedCountRef.current;
      if (start >= entries.length) return;

      for (let i = start; i < entries.length; i++) {
        if (entries[i].isException) {
          processEntry(entries[i]);
        }
      }
      processedCountRef.current = entries.length;
    });

    // Process any entries already in the store
    const existing = useLogStore.getState().entries;
    for (let i = processedCountRef.current; i < existing.length; i++) {
      if (existing[i].isException) {
        processEntry(existing[i]);
      }
    }
    processedCountRef.current = existing.length;

    return unsub;
  }, [processEntry]);

  return <ErrorExplorer />;
}
