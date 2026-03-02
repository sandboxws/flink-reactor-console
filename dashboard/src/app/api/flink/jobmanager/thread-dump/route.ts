import { NextResponse } from "next/server"
import type { FlinkThreadDumpResponse } from "@/data/flink-api-types"
import { generateMockThreadDumpApiResponse } from "@/data/mock-api-responses"
import { getConfig } from "@/lib/config"
import { createFlinkFetcher } from "@/lib/flink-fetcher"

export async function GET() {
  const config = getConfig()

  if (config.mockMode) {
    return NextResponse.json(generateMockThreadDumpApiResponse("jobmanager"))
  }

  try {
    const fetchFlink = createFlinkFetcher(config)
    const data = await fetchFlink<FlinkThreadDumpResponse>(
      "/jobmanager/thread-dump",
    )
    return NextResponse.json(data)
  } catch (err) {
    const message =
      err instanceof Error
        ? err.message
        : "Failed to fetch JM thread dump from Flink"
    return NextResponse.json({ error: message }, { status: 502 })
  }
}
