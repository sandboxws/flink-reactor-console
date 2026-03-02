import { NextResponse } from "next/server"
import type { FlinkThreadDumpResponse } from "@/data/flink-api-types"
import { generateMockThreadDumpApiResponse } from "@/data/mock-api-responses"
import { getConfig } from "@/lib/config"
import { createFlinkFetcher } from "@/lib/flink-fetcher"
import { createServerLogger } from "@/lib/logger"

const log = createServerLogger().getSubLogger({
  name: "api:taskmanagers:thread-dump",
})

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ tmId: string }> },
) {
  const { tmId } = await params
  const config = getConfig()

  if (config.mockMode) {
    log.info("MOCK → generateMockThreadDumpApiResponse", {
      screen: "Task Manager Thread Dump",
      file: "mock-api-responses.ts",
      generator: "generateMockThreadDumpApiResponse",
    })
    return NextResponse.json(
      generateMockThreadDumpApiResponse("taskmanager", tmId),
    )
  }

  try {
    const fetchFlink = createFlinkFetcher(config)
    const data = await fetchFlink<FlinkThreadDumpResponse>(
      `/taskmanagers/${tmId}/thread-dump`,
    )
    return NextResponse.json(data)
  } catch (err) {
    const message =
      err instanceof Error
        ? err.message
        : "Failed to fetch TM thread dump from Flink"
    return NextResponse.json({ error: message }, { status: 502 })
  }
}
