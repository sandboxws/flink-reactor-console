import { NextResponse } from "next/server"
import type { FlinkTaskManagersResponse } from "@/data/flink-api-types"
import { generateMockTaskManagersApiResponse } from "@/data/mock-api-responses"
import { getConfig } from "@/lib/config"
import { createFlinkFetcher } from "@/lib/flink-fetcher"
import { createServerLogger } from "@/lib/logger"

const log = createServerLogger().getSubLogger({ name: "api:taskmanagers" })

export async function GET() {
  const config = getConfig()

  if (config.mockMode) {
    log.info("MOCK → generateMockTaskManagersApiResponse", {
      screen: "Task Managers",
      file: "mock-api-responses.ts",
      generator: "generateMockTaskManagersApiResponse",
    })
    return NextResponse.json(generateMockTaskManagersApiResponse())
  }

  try {
    const fetchFlink = createFlinkFetcher(config)
    const data = await fetchFlink<FlinkTaskManagersResponse>("/taskmanagers")
    return NextResponse.json(data)
  } catch (err) {
    const message =
      err instanceof Error
        ? err.message
        : "Failed to fetch task managers from Flink"
    return NextResponse.json({ error: message }, { status: 502 })
  }
}
