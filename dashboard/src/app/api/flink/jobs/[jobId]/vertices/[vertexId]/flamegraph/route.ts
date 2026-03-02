import { NextResponse } from "next/server"
import type { FlinkFlamegraphResponse } from "@/data/flink-api-types"
import { generateMockFlamegraphApiResponse } from "@/data/mock-api-responses"
import { getConfig } from "@/lib/config"
import { createFlinkFetcher } from "@/lib/flink-fetcher"
import { createServerLogger } from "@/lib/logger"

const log = createServerLogger().getSubLogger({
  name: "api:jobs:vertices:flamegraph",
})

export async function GET(
  request: Request,
  { params }: { params: Promise<{ jobId: string; vertexId: string }> },
) {
  const { jobId, vertexId } = await params
  const config = getConfig()

  if (config.mockMode) {
    log.info("MOCK → generateMockFlamegraphApiResponse", {
      screen: "Flamegraph",
      file: "mock-api-responses.ts",
      generator: "generateMockFlamegraphApiResponse",
    })
    return NextResponse.json(generateMockFlamegraphApiResponse())
  }

  try {
    const fetchFlink = createFlinkFetcher(config)
    // Flink supports ?type=full|on_cpu|off_cpu (defaults to full)
    const url = new URL(request.url)
    const type = url.searchParams.get("type") ?? "full"
    const data = await fetchFlink<FlinkFlamegraphResponse>(
      `/jobs/${jobId}/vertices/${vertexId}/flamegraph?type=${type}`,
    )
    return NextResponse.json(data)
  } catch (err) {
    const message =
      err instanceof Error
        ? err.message
        : "Failed to fetch flamegraph from Flink"
    return NextResponse.json({ error: message }, { status: 502 })
  }
}
