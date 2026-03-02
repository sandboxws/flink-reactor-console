import { NextResponse } from "next/server"
import type {
  FlinkMetricItem,
  FlinkTaskManagerDetailAggregate,
  FlinkTaskManagerDetailResponse,
} from "@/data/flink-api-types"
import { generateMockTaskManagerDetailApiResponse } from "@/data/mock-api-responses"
import { getConfig } from "@/lib/config"
import { createFlinkFetcher } from "@/lib/flink-fetcher"

/** All TM metrics we request in a single call. */
const TM_METRIC_IDS = [
  "Status.JVM.CPU.Load",
  "Status.JVM.Memory.Heap.Used",
  "Status.JVM.Memory.Heap.Committed",
  "Status.JVM.Memory.Heap.Max",
  "Status.JVM.Memory.NonHeap.Used",
  "Status.JVM.Memory.NonHeap.Committed",
  "Status.JVM.Memory.NonHeap.Max",
  "Status.JVM.Memory.Direct.Count",
  "Status.JVM.Memory.Direct.MemoryUsed",
  "Status.JVM.Memory.Direct.TotalCapacity",
  "Status.JVM.Memory.Mapped.Count",
  "Status.JVM.Memory.Mapped.MemoryUsed",
  "Status.JVM.Memory.Mapped.TotalCapacity",
  "Status.Shuffle.Netty.AvailableMemory",
  "Status.Shuffle.Netty.UsedMemory",
  "Status.Shuffle.Netty.TotalMemory",
  "Status.Shuffle.Netty.AvailableMemorySegments",
  "Status.Shuffle.Netty.UsedMemorySegments",
  "Status.Shuffle.Netty.TotalMemorySegments",
  "Status.Flink.Memory.Managed.Used",
  "Status.Flink.Memory.Managed.Total",
  "Status.JVM.Memory.Metaspace.Used",
  "Status.JVM.Memory.Metaspace.Max",
  "Status.JVM.Threads.Count",
  "Status.JVM.GarbageCollector.G1_Young_Generation.Count",
  "Status.JVM.GarbageCollector.G1_Young_Generation.Time",
  "Status.JVM.GarbageCollector.G1_Old_Generation.Count",
  "Status.JVM.GarbageCollector.G1_Old_Generation.Time",
].join(",")

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ tmId: string }> },
) {
  const { tmId } = await params
  const config = getConfig()

  if (config.mockMode) {
    return NextResponse.json(generateMockTaskManagerDetailApiResponse(tmId))
  }

  try {
    const fetchFlink = createFlinkFetcher(config)

    const [detail, metrics] = await Promise.all([
      fetchFlink<FlinkTaskManagerDetailResponse>(`/taskmanagers/${tmId}`),
      fetchFlink<FlinkMetricItem[]>(
        `/taskmanagers/${tmId}/metrics?get=${TM_METRIC_IDS}`,
      ),
    ])

    const aggregate: FlinkTaskManagerDetailAggregate = { detail, metrics }
    return NextResponse.json(aggregate)
  } catch (err) {
    const message =
      err instanceof Error
        ? err.message
        : "Failed to fetch task manager detail from Flink"
    return NextResponse.json({ error: message }, { status: 502 })
  }
}
