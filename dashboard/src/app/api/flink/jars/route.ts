import { NextResponse } from "next/server"
import type {
  FlinkJarsResponse,
  FlinkJarUploadResponse,
} from "@/data/flink-api-types"
import {
  generateMockJarsApiResponse,
  generateMockJarUploadApiResponse,
} from "@/data/mock-api-responses"
import { getConfig } from "@/lib/config"
import { createFlinkFetcher } from "@/lib/flink-fetcher"

export async function GET() {
  const config = getConfig()

  if (config.mockMode) {
    return NextResponse.json(generateMockJarsApiResponse())
  }

  try {
    const fetchFlink = createFlinkFetcher(config)
    const data = await fetchFlink<FlinkJarsResponse>("/jars")
    return NextResponse.json(data)
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to fetch JARs from Flink"
    return NextResponse.json({ error: message }, { status: 502 })
  }
}

export async function POST(request: Request) {
  const config = getConfig()

  if (config.mockMode) {
    // Extract filename from the multipart form data
    const formData = await request.formData()
    const file = formData.get("jarfile") as File | null
    const filename = file?.name ?? "unknown.jar"
    return NextResponse.json(generateMockJarUploadApiResponse(filename))
  }

  try {
    const fetchFlink = createFlinkFetcher(config)
    const formData = await request.formData()
    const data = await fetchFlink.postForm<FlinkJarUploadResponse>(
      "/jars/upload",
      formData,
    )
    return NextResponse.json(data)
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to upload JAR to Flink"
    return NextResponse.json({ error: message }, { status: 502 })
  }
}
