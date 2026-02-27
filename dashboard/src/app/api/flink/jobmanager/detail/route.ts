import { NextResponse } from "next/server";
import { getConfig } from "@/lib/config";
import { createFlinkFetcher } from "@/lib/flink-fetcher";
import { generateMockJobManagerDetailApiResponse } from "@/data/mock-api-responses";
import type {
  FlinkJobManagerConfigResponse,
  FlinkJobManagerEnvironmentResponse,
  FlinkMetricItem,
  FlinkJobManagerDetailAggregate,
} from "@/data/flink-api-types";

/** Core JM metrics fetched alongside config/environment. */
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
    return NextResponse.json(generateMockJobManagerDetailApiResponse());
  }

  try {
    const fetchFlink = createFlinkFetcher(config);

    const [jmConfig, environment, metrics] = await Promise.all([
      fetchFlink<FlinkJobManagerConfigResponse>("/jobmanager/config"),
      fetchFlink<FlinkJobManagerEnvironmentResponse>("/jobmanager/environment"),
      fetchFlink<FlinkMetricItem[]>(
        `/jobmanager/metrics?get=${JM_METRIC_IDS}`,
      ),
    ]);

    const aggregate: FlinkJobManagerDetailAggregate = {
      config: jmConfig,
      environment,
      metrics,
    };

    return NextResponse.json(aggregate);
  } catch (err) {
    const message =
      err instanceof Error
        ? err.message
        : "Failed to fetch job manager detail from Flink";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
