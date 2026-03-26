/** Fixture data for execution plans — subtask timelines and flamegraph profiling data. */

import type { FlamegraphNode, FlamegraphData, SubtaskTimeline, SubtaskTimelineEntry } from "../types"

/** Create a subtask timeline with four subtasks across separate hosts. */
export function createSubtaskTimeline(overrides?: Partial<SubtaskTimeline>): SubtaskTimeline {
  const subtasks: SubtaskTimelineEntry[] = Array.from({ length: 4 }, (_, i) => ({
    subtask: i,
    host: `host-0${i}`,
    duration: 3_600_000,
    timestamps: {
      CREATED: Date.now() - 3_600_000,
      RUNNING: Date.now() - 3_599_000,
    },
  }))
  return {
    vertexId: "vertex-1",
    vertexName: "Map → Filter → Watermark",
    now: Date.now(),
    subtasks,
    ...overrides,
  }
}

/** Create a flamegraph with StreamTask invoke, processElement, and emitWatermark frames. */
export function createFlamegraphData(): FlamegraphData {
  return {
    endTimestamp: Date.now(),
    root: {
      name: "root",
      value: 1000,
      children: [
        {
          name: "org.apache.flink.streaming.runtime.tasks.StreamTask.invoke",
          value: 800,
          children: [
            { name: "processElement", value: 500, children: [] },
            { name: "emitWatermark", value: 200, children: [] },
          ],
        },
        { name: "Thread.sleep", value: 200, children: [] },
      ],
    },
  }
}
