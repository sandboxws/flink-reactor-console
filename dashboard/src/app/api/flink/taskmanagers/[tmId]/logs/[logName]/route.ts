import { NextResponse } from "next/server"
import { generateMockLogFileContentApiResponse } from "@/data/mock-api-responses"
import { getConfig } from "@/lib/config"
import { createFlinkFetcher } from "@/lib/flink-fetcher"
import { createServerLogger } from "@/lib/logger"

const log = createServerLogger().getSubLogger({
  name: "api:taskmanagers:logs:file",
})

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ tmId: string; logName: string }> },
) {
  const { tmId, logName } = await params
  const config = getConfig()

  if (config.mockMode) {
    log.info("MOCK → generateMockLogFileContentApiResponse", {
      screen: "Task Manager Log File",
      file: "mock-api-responses.ts",
      generator: "generateMockLogFileContentApiResponse",
    })
    return new NextResponse(
      generateMockLogFileContentApiResponse("taskmanager", logName, tmId),
      { headers: { "Content-Type": "text/plain" } },
    )
  }

  try {
    const fetchFlink = createFlinkFetcher(config)
    const text = await fetchFlink.text(
      `/taskmanagers/${tmId}/logs/${encodeURIComponent(logName)}`,
    )
    return new NextResponse(text, {
      headers: { "Content-Type": "text/plain" },
    })
  } catch (err) {
    const message =
      err instanceof Error
        ? err.message
        : "Failed to fetch TM log file from Flink"
    return NextResponse.json({ error: message }, { status: 502 })
  }
}
