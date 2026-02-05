"use client";

import { TextViewer } from "@/components/shared/text-viewer";

// ---------------------------------------------------------------------------
// JmLogsTab — renders JM logs using the shared text-viewer
// ---------------------------------------------------------------------------

export function JmLogsTab({ logs }: { logs: string }) {
  return (
    <div className="pt-4">
      <TextViewer text={logs} />
    </div>
  );
}
