import { NextResponse } from "next/server"
import type { FlinkVertexMetricsResponse } from "@/data/flink-api-types"
import {
  generateMockMetricList,
  generateMockMetricValues,
} from "@/data/mock-api-responses"
import { getConfig } from "@/lib/config"
import { createFlinkFetcher } from "@/lib/flink-fetcher"
import { createServerLogger } from "@/lib/logger"

const log = createServerLogger().getSubLogger({
  name: "api:jobs:vertices:metrics",
})

export async function GET(
  request: Request,
  { params }: { params: Promise<{ jobId: string; vertexId: string }> },
) {
  const { jobId, vertexId } = await params
  const config = getConfig()
  const url = new URL(request.url)
  const getParam = url.searchParams.get("get")

  if (config.mockMode) {
    log.info("MOCK → generateMockMetricValues/MetricList", {
      screen: "Vertex Metrics",
      file: "mock-api-responses.ts",
      generator: getParam
        ? "generateMockMetricValues"
        : "generateMockMetricList",
    })
    if (getParam) {
      return NextResponse.json(generateMockMetricValues(getParam.split(",")))
    }
    return NextResponse.json(generateMockMetricList("job-vertex"))
  }

  try {
    const fetchFlink = createFlinkFetcher(config)
    const metricsPath = getParam
      ? `/jobs/${jobId}/vertices/${vertexId}/metrics?get=${getParam}`
      : `/jobs/${jobId}/vertices/${vertexId}/metrics`
    const data = await fetchFlink<FlinkVertexMetricsResponse>(metricsPath)
    return NextResponse.json(data)
  } catch (err) {
    const message =
      err instanceof Error
        ? err.message
        : "Failed to fetch vertex metrics from Flink"
    return NextResponse.json({ error: message }, { status: 502 })
  }
}
