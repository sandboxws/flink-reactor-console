import { NextResponse } from "next/server"
import type { FlinkClusterConfigResponse } from "@/data/flink-api-types"
import { generateMockClusterConfigApiResponse } from "@/data/mock-api-responses"
import { getConfig } from "@/lib/config"
import { createFlinkFetcher } from "@/lib/flink-fetcher"
import { createServerLogger } from "@/lib/logger"

const log = createServerLogger().getSubLogger({ name: "api:config" })

export async function GET() {
  const config = getConfig()

  if (config.mockMode) {
    log.info("MOCK → generateMockClusterConfigApiResponse", {
      screen: "Cluster Config",
      file: "mock-api-responses.ts",
      generator: "generateMockClusterConfigApiResponse",
    })
    return NextResponse.json(generateMockClusterConfigApiResponse())
  }

  try {
    const fetchFlink = createFlinkFetcher(config)
    const data = await fetchFlink<FlinkClusterConfigResponse>("/config")
    return NextResponse.json(data)
  } catch (err) {
    const message =
      err instanceof Error
        ? err.message
        : "Failed to fetch cluster config from Flink"
    return NextResponse.json({ error: message }, { status: 502 })
  }
}
