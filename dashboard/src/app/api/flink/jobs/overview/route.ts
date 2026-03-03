import { NextResponse } from "next/server"
import type { FlinkJobsOverviewResponse } from "@/data/flink-api-types"
import { generateMockJobsOverviewApiResponse } from "@/data/mock-api-responses"
import { getConfig } from "@/lib/config"
import { createFlinkFetcher } from "@/lib/flink-fetcher"
import { createServerLogger } from "@/lib/logger"

const log = createServerLogger().getSubLogger({ name: "api:jobs:overview" })

export async function GET() {
  const config = getConfig()

  if (config.mockMode) {
    log.info("MOCK → generateMockJobsOverviewApiResponse", {
      screen: "Jobs",
      file: "mock-api-responses.ts",
      generator: "generateMockJobsOverviewApiResponse",
    })
    return NextResponse.json(generateMockJobsOverviewApiResponse())
  }

  try {
    const fetchFlink = createFlinkFetcher(config)
    const data = await fetchFlink<FlinkJobsOverviewResponse>("/jobs/overview")
    return NextResponse.json(data)
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to fetch from Flink"
    return NextResponse.json({ error: message }, { status: 502 })
  }
}
