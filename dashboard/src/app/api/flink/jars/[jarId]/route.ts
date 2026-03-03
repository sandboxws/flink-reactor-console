import { NextResponse } from "next/server"
import { getConfig } from "@/lib/config"
import { createFlinkFetcher } from "@/lib/flink-fetcher"
import { createServerLogger } from "@/lib/logger"

const log = createServerLogger().getSubLogger({ name: "api:jars:delete" })

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ jarId: string }> },
) {
  const { jarId } = await params
  const config = getConfig()

  if (config.mockMode) {
    log.info("MOCK → delete (no-op)", {
      screen: "JAR Management",
      file: "route.ts",
      generator: "mock-delete",
    })
    return NextResponse.json({})
  }

  try {
    const fetchFlink = createFlinkFetcher(config)
    await fetchFlink.delete(`/jars/${jarId}`)
    return NextResponse.json({})
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to delete JAR from Flink"
    return NextResponse.json({ error: message }, { status: 502 })
  }
}
