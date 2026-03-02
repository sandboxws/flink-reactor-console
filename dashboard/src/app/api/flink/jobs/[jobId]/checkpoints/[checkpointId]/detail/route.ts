import { NextResponse } from "next/server"
import type { FlinkCheckpointDetailResponse } from "@/data/flink-api-types"
import { generateMockCheckpointDetailApiResponse } from "@/data/mock-api-responses"
import { getConfig } from "@/lib/config"
import { createFlinkFetcher } from "@/lib/flink-fetcher"
import { createServerLogger } from "@/lib/logger"

const log = createServerLogger().getSubLogger({
  name: "api:jobs:checkpoints:detail",
})

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ jobId: string; checkpointId: string }> },
) {
  const { jobId, checkpointId } = await params
  const config = getConfig()

  if (config.mockMode) {
    log.info("MOCK → generateMockCheckpointDetailApiResponse", {
      screen: "Checkpoint Detail",
      file: "mock-api-responses.ts",
      generator: "generateMockCheckpointDetailApiResponse",
    })
    return NextResponse.json(
      generateMockCheckpointDetailApiResponse(Number(checkpointId)),
    )
  }

  try {
    const fetchFlink = createFlinkFetcher(config)
    const data = await fetchFlink<FlinkCheckpointDetailResponse>(
      `/jobs/${jobId}/checkpoints/details/${checkpointId}`,
    )
    return NextResponse.json(data)
  } catch (err) {
    const message =
      err instanceof Error
        ? err.message
        : "Failed to fetch checkpoint detail from Flink"
    return NextResponse.json({ error: message }, { status: 502 })
  }
}
