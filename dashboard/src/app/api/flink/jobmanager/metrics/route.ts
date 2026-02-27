import { NextResponse } from "next/server";
import { getConfig } from "@/lib/config";
import { createFlinkFetcher } from "@/lib/flink-fetcher";
import { generateMockJobManagerMetricsApiResponse } from "@/data/mock-api-responses";
import type { FlinkMetricItem } from "@/data/flink-api-types";

const JM_METRIC_IDS = [
  "Status.JVM.Memory.Heap.Used",
  "Status.JVM.Memory.Heap.Max",
  "Status.JVM.Memory.NonHeap.Used",
  "Status.JVM.Memory.NonHeap.Max",
  "Status.JVM.Memory.Metaspace.Used",
  "Status.JVM.Memory.Metaspace.Max",
  "Status.JVM.Memory.Direct.MemoryUsed",
  "Status.JVM.Memory.Direct.TotalCapacity",
  "Status.JVM.Threads.Count",
  "Status.JVM.GarbageCollector.G1_Young_Generation.Count",
  "Status.JVM.GarbageCollector.G1_Young_Generation.Time",
  "Status.JVM.GarbageCollector.G1_Old_Generation.Count",
  "Status.JVM.GarbageCollector.G1_Old_Generation.Time",
].join(",");

export async function GET() {
  const config = getConfig();

  if (config.mockMode) {
    return NextResponse.json(generateMockJobManagerMetricsApiResponse());
  }

  try {
    const fetchFlink = createFlinkFetcher(config);
    const data = await fetchFlink<FlinkMetricItem[]>(
      `/jobmanager/metrics?get=${JM_METRIC_IDS}`,
    );
    return NextResponse.json(data);
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to fetch JM metrics from Flink";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
