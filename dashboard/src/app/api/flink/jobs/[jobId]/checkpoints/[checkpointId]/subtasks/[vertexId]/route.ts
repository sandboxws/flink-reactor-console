import { NextResponse } from "next/server"
import type { FlinkCheckpointSubtaskDetailResponse } from "@/data/flink-api-types"
import { generateMockCheckpointSubtaskDetailResponse } from "@/data/mock-api-responses"
import { getConfig } from "@/lib/config"
import { createFlinkFetcher } from "@/lib/flink-fetcher"
import { createServerLogger } from "@/lib/logger"

const log = createServerLogger().getSubLogger({
  name: "api:jobs:checkpoints:subtasks",
})

export async function GET(
  _request: Request,
  {
    params,
  }: {
    params: Promise<{
      jobId: string
      checkpointId: string
      vertexId: string
    }>
  },
) {
  const { jobId, checkpointId, vertexId } = await params
  const config = getConfig()

  if (config.mockMode) {
    log.info("MOCK → generateMockCheckpointSubtaskDetailResponse", {
      screen: "Checkpoint Subtask Detail",
      file: "mock-api-responses.ts",
      generator: "generateMockCheckpointSubtaskDetailResponse",
    })
    return NextResponse.json(
      generateMockCheckpointSubtaskDetailResponse(vertexId),
    )
  }

  try {
    const fetchFlink = createFlinkFetcher(config)
    const data = await fetchFlink<FlinkCheckpointSubtaskDetailResponse>(
      `/jobs/${jobId}/checkpoints/details/${checkpointId}/subtasks/${vertexId}`,
    )
    return NextResponse.json(data)
  } catch (err) {
    const message =
      err instanceof Error
        ? err.message
        : "Failed to fetch checkpoint subtask detail from Flink"
    return NextResponse.json({ error: message }, { status: 502 })
  }
}
