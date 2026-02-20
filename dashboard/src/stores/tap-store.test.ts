import { describe, it, expect, vi, beforeEach } from "vitest";
import { useTapStore } from "./tap-store";
import { generateMockTapManifest } from "@/data/mock-tap-manifest";

// Mock the fetch call used by loadTapManifest
const mockManifest = generateMockTapManifest();

vi.stubGlobal(
  "fetch",
  vi.fn().mockResolvedValue({
    ok: true,
    json: () => Promise.resolve(mockManifest),
  }),
);

beforeEach(() => {
  // Reset the store between tests
  useTapStore.setState({
    currentJobId: null,
    availableOperators: [],
    manifestLoading: false,
    manifestError: null,
    tabs: {},
    activeTabId: null,
  });
});

// ---------------------------------------------------------------------------
// loadManifest
// ---------------------------------------------------------------------------

describe("loadManifest", () => {
  it("loads manifest and populates available operators", async () => {
    await useTapStore.getState().loadManifest("job-123");

    const state = useTapStore.getState();
    expect(state.currentJobId).toBe("job-123");
    expect(state.availableOperators.length).toBe(mockManifest.taps.length);
    expect(state.manifestLoading).toBe(false);
    expect(state.manifestError).toBeNull();
  });

  it("clears tabs when switching to a different job", async () => {
    // Load first job
    await useTapStore.getState().loadManifest("job-1");
    useTapStore.getState().openTab(mockManifest.taps[0].nodeId);

    // Load different job
    await useTapStore.getState().loadManifest("job-2");

    const state = useTapStore.getState();
    expect(state.currentJobId).toBe("job-2");
    expect(Object.keys(state.tabs).length).toBe(0);
    expect(state.activeTabId).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// openTab
// ---------------------------------------------------------------------------

describe("openTab", () => {
  it("creates a new tab with default config", async () => {
    await useTapStore.getState().loadManifest("job-123");

    const op = mockManifest.taps[0];
    useTapStore.getState().openTab(op.nodeId);

    const state = useTapStore.getState();
    const tab = state.tabs[op.nodeId];

    expect(tab).toBeDefined();
    expect(tab.nodeId).toBe(op.nodeId);
    expect(tab.name).toBe(op.name);
    expect(tab.config.offsetMode).toBe("latest");
    expect(tab.config.bufferSize).toBe(10_000);
    expect(tab.rows).toEqual([]);
    expect(tab.columns).toEqual([]);
    expect(tab.totalRowCount).toBe(0);
    expect(state.activeTabId).toBe(op.nodeId);
  });

  it("switches to existing tab instead of re-creating", async () => {
    await useTapStore.getState().loadManifest("job-123");

    const op = mockManifest.taps[0];
    useTapStore.getState().openTab(op.nodeId);

    // Append some rows
    useTapStore
      .getState()
      .appendRows(op.nodeId, [{ id: 1 }, { id: 2 }]);

    // Open same tab again
    useTapStore.getState().openTab(op.nodeId);

    const tab = useTapStore.getState().tabs[op.nodeId];
    // Rows should still be there (not re-created)
    expect(tab.rows.length).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// closeTab
// ---------------------------------------------------------------------------

describe("closeTab", () => {
  it("removes the tab", async () => {
    await useTapStore.getState().loadManifest("job-123");

    const op = mockManifest.taps[0];
    useTapStore.getState().openTab(op.nodeId);
    useTapStore.getState().closeTab(op.nodeId);

    const state = useTapStore.getState();
    expect(state.tabs[op.nodeId]).toBeUndefined();
  });

  it("switches active tab to another tab when closing active", async () => {
    await useTapStore.getState().loadManifest("job-123");

    const op1 = mockManifest.taps[0];
    const op2 = mockManifest.taps[1];
    useTapStore.getState().openTab(op1.nodeId);
    useTapStore.getState().openTab(op2.nodeId);

    // op2 is now active
    expect(useTapStore.getState().activeTabId).toBe(op2.nodeId);

    // Close op2 — should switch to op1
    useTapStore.getState().closeTab(op2.nodeId);
    expect(useTapStore.getState().activeTabId).toBe(op1.nodeId);
  });

  it("sets activeTabId to null when closing last tab", async () => {
    await useTapStore.getState().loadManifest("job-123");

    const op = mockManifest.taps[0];
    useTapStore.getState().openTab(op.nodeId);
    useTapStore.getState().closeTab(op.nodeId);

    expect(useTapStore.getState().activeTabId).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// appendRows
// ---------------------------------------------------------------------------

describe("appendRows", () => {
  it("appends rows to the tab buffer", async () => {
    await useTapStore.getState().loadManifest("job-123");

    const op = mockManifest.taps[0];
    useTapStore.getState().openTab(op.nodeId);

    useTapStore
      .getState()
      .appendRows(op.nodeId, [{ id: 1 }, { id: 2 }, { id: 3 }]);

    const tab = useTapStore.getState().tabs[op.nodeId];
    expect(tab.rows.length).toBe(3);
    expect(tab.totalRowCount).toBe(3);
  });

  it("evicts oldest rows when buffer exceeds bufferSize", async () => {
    await useTapStore.getState().loadManifest("job-123");

    const op = mockManifest.taps[0];
    useTapStore.getState().openTab(op.nodeId);

    // Set a small buffer size
    useTapStore.getState().updateConfig(op.nodeId, { bufferSize: 5 });

    // Add 8 rows (should keep last 5)
    const rows = Array.from({ length: 8 }, (_, i) => ({ id: i + 1 }));
    useTapStore.getState().appendRows(op.nodeId, rows);

    const tab = useTapStore.getState().tabs[op.nodeId];
    expect(tab.rows.length).toBe(5);
    expect(tab.totalRowCount).toBe(8);
    // First row should be id:4 (oldest 3 evicted)
    expect(tab.rows[0]).toEqual({ id: 4 });
    expect(tab.rows[4]).toEqual({ id: 8 });
  });

  it("updates columns when provided", async () => {
    await useTapStore.getState().loadManifest("job-123");

    const op = mockManifest.taps[0];
    useTapStore.getState().openTab(op.nodeId);

    const columns = [
      { columnName: "id", dataType: "BIGINT", nullable: false },
      { columnName: "name", dataType: "VARCHAR(255)", nullable: true },
    ];

    useTapStore
      .getState()
      .appendRows(op.nodeId, [{ id: 1, name: "test" }], columns);

    const tab = useTapStore.getState().tabs[op.nodeId];
    expect(tab.columns).toEqual(columns);
  });
});

// ---------------------------------------------------------------------------
// clearRows
// ---------------------------------------------------------------------------

describe("clearRows", () => {
  it("removes all rows and resets counters", async () => {
    await useTapStore.getState().loadManifest("job-123");

    const op = mockManifest.taps[0];
    useTapStore.getState().openTab(op.nodeId);
    useTapStore
      .getState()
      .appendRows(op.nodeId, [{ id: 1 }, { id: 2 }]);

    useTapStore.getState().clearRows(op.nodeId);

    const tab = useTapStore.getState().tabs[op.nodeId];
    expect(tab.rows).toEqual([]);
    expect(tab.totalRowCount).toBe(0);
    expect(tab.rowsPerSecond).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// updateConfig
// ---------------------------------------------------------------------------

describe("updateConfig", () => {
  it("updates offset mode", async () => {
    await useTapStore.getState().loadManifest("job-123");

    const op = mockManifest.taps[0];
    useTapStore.getState().openTab(op.nodeId);
    useTapStore
      .getState()
      .updateConfig(op.nodeId, { offsetMode: "earliest" });

    const tab = useTapStore.getState().tabs[op.nodeId];
    expect(tab.config.offsetMode).toBe("earliest");
  });

  it("updates buffer size without affecting other config fields", async () => {
    await useTapStore.getState().loadManifest("job-123");

    const op = mockManifest.taps[0];
    useTapStore.getState().openTab(op.nodeId);
    useTapStore
      .getState()
      .updateConfig(op.nodeId, { bufferSize: 5000 });

    const tab = useTapStore.getState().tabs[op.nodeId];
    expect(tab.config.bufferSize).toBe(5000);
    expect(tab.config.offsetMode).toBe("latest"); // unchanged
  });
});
