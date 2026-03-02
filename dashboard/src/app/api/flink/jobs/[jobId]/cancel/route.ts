import { NextResponse } from "next/server"
import { getConfig } from "@/lib/config"
import { createFlinkFetcher } from "@/lib/flink-fetcher"
import { createServerLogger } from "@/lib/logger"

const log = createServerLogger().getSubLogger({ name: "api:jobs:cancel" })

export async function PATCH(
  _request: Request,
  { params }: { params: Promise<{ jobId: string }> },
) {
  const { jobId } = await params
  const config = getConfig()

  if (config.mockMode) {
    log.info("MOCK → cancel (no-op)", {
      screen: "Job Detail",
      file: "route.ts",
      generator: "mock-cancel",
    })
    // In mock mode, just return success — the store handles state transitions
    return NextResponse.json({ status: "ok" })
  }

  try {
    const fetchFlink = createFlinkFetcher(config)
    // Flink REST uses PATCH /jobs/:jid?mode=cancel to cancel a job
    await fetchFlink.patch(`/jobs/${jobId}?mode=cancel`)
    return NextResponse.json({ status: "ok" })
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to cancel job"
    return NextResponse.json({ error: message }, { status: 502 })
  }
}
