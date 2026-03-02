import { NextResponse } from "next/server"
import type { FlinkSubtaskTimesResponse } from "@/data/flink-api-types"
import { generateMockSubtaskTimesApiResponse } from "@/data/mock-api-responses"
import { getConfig } from "@/lib/config"
import { createFlinkFetcher } from "@/lib/flink-fetcher"
import { createServerLogger } from "@/lib/logger"

const log = createServerLogger().getSubLogger({
  name: "api:jobs:vertices:subtasktimes",
})

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ jobId: string; vertexId: string }> },
) {
  const { jobId, vertexId } = await params
  const config = getConfig()

  if (config.mockMode) {
    log.info("MOCK → generateMockSubtaskTimesApiResponse", {
      screen: "Subtask Times",
      file: "mock-api-responses.ts",
      generator: "generateMockSubtaskTimesApiResponse",
    })
    return NextResponse.json(generateMockSubtaskTimesApiResponse(vertexId))
  }

  try {
    const fetchFlink = createFlinkFetcher(config)
    const data = await fetchFlink<FlinkSubtaskTimesResponse>(
      `/jobs/${jobId}/vertices/${vertexId}/subtasktimes`,
    )
    return NextResponse.json(data)
  } catch (err) {
    const message =
      err instanceof Error
        ? err.message
        : "Failed to fetch subtask times from Flink"
    return NextResponse.json({ error: message }, { status: 502 })
  }
}
