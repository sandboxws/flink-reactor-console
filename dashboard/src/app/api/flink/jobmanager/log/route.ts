import { NextResponse } from "next/server"
import { generateMockLogTextApiResponse } from "@/data/mock-api-responses"
import { getConfig } from "@/lib/config"
import { createFlinkFetcher } from "@/lib/flink-fetcher"
import { createServerLogger } from "@/lib/logger"

const log = createServerLogger().getSubLogger({ name: "api:jobmanager:log" })

export async function GET() {
  const config = getConfig()

  if (config.mockMode) {
    log.info("MOCK → generateMockLogTextApiResponse", {
      screen: "Job Manager Log",
      file: "mock-api-responses.ts",
      generator: "generateMockLogTextApiResponse",
    })
    return new NextResponse(
      generateMockLogTextApiResponse("jobmanager", "log"),
      { headers: { "Content-Type": "text/plain" } },
    )
  }

  try {
    const fetchFlink = createFlinkFetcher(config)
    const text = await fetchFlink.text("/jobmanager/log")
    return new NextResponse(text, {
      headers: { "Content-Type": "text/plain" },
    })
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to fetch JM log from Flink"
    return NextResponse.json({ error: message }, { status: 502 })
  }
}
