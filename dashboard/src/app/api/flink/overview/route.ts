import { NextResponse } from "next/server"
import type { FlinkOverviewResponse } from "@/data/flink-api-types"
import { generateMockOverviewApiResponse } from "@/data/mock-api-responses"
import { getConfig } from "@/lib/config"
import { createFlinkFetcher } from "@/lib/flink-fetcher"
import { createServerLogger } from "@/lib/logger"

const log = createServerLogger().getSubLogger({ name: "api:overview" })

export async function GET() {
  const config = getConfig()

  if (config.mockMode) {
    log.info("MOCK → generateMockOverviewApiResponse", {
      screen: "Overview",
      file: "mock-api-responses.ts",
      generator: "generateMockOverviewApiResponse",
    })
    return NextResponse.json(generateMockOverviewApiResponse())
  }

  try {
    const fetchFlink = createFlinkFetcher(config)
    const data = await fetchFlink<FlinkOverviewResponse>("/overview")
    return NextResponse.json(data)
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to fetch from Flink"
    return NextResponse.json({ error: message }, { status: 502 })
  }
}
