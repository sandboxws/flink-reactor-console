import { NextResponse } from "next/server";
import { getConfig } from "@/lib/config";
import { createFlinkFetcher } from "@/lib/flink-fetcher";
import { generateMockTaskManagerMetricsApiResponse } from "@/data/mock-api-responses";
import type { FlinkMetricItem } from "@/data/flink-api-types";

/** Core TM metrics for live polling. */
const TM_METRIC_IDS = [
  "Status.JVM.CPU.Load",
  "Status.JVM.Memory.Heap.Used",
  "Status.JVM.Memory.Heap.Committed",
  "Status.JVM.Memory.Heap.Max",
  "Status.JVM.Memory.NonHeap.Used",
  "Status.JVM.Memory.NonHeap.Committed",
  "Status.JVM.Memory.NonHeap.Max",
  "Status.JVM.Memory.Metaspace.Used",
  "Status.JVM.Memory.Metaspace.Max",
  "Status.JVM.Threads.Count",
  "Status.JVM.GarbageCollector.G1_Young_Generation.Count",
  "Status.JVM.GarbageCollector.G1_Young_Generation.Time",
  "Status.JVM.GarbageCollector.G1_Old_Generation.Count",
  "Status.JVM.GarbageCollector.G1_Old_Generation.Time",
].join(",");

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ tmId: string }> },
) {
  const { tmId } = await params;
  const config = getConfig();

  if (config.mockMode) {
    return NextResponse.json(generateMockTaskManagerMetricsApiResponse(tmId));
  }

  try {
    const fetchFlink = createFlinkFetcher(config);
    const data = await fetchFlink<FlinkMetricItem[]>(
      `/taskmanagers/${tmId}/metrics?get=${TM_METRIC_IDS}`,
    );
    return NextResponse.json(data);
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to fetch TM metrics from Flink";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
