import { NextResponse } from "next/server"
import type { FlinkMetricItem } from "@/data/flink-api-types"
import {
  generateMockMetricList,
  generateMockMetricValues,
} from "@/data/mock-api-responses"
import { getConfig } from "@/lib/config"
import { createFlinkFetcher } from "@/lib/flink-fetcher"
import { createServerLogger } from "@/lib/logger"

const log = createServerLogger().getSubLogger({
  name: "api:jobmanager:metrics",
})

export async function GET(request: Request) {
  const config = getConfig()
  const url = new URL(request.url)
  const getParam = url.searchParams.get("get")

  if (config.mockMode) {
    log.info("MOCK → generateMockMetricValues/MetricList", {
      screen: "Job Manager Metrics",
      file: "mock-api-responses.ts",
      generator: getParam
        ? "generateMockMetricValues"
        : "generateMockMetricList",
    })
    if (getParam) {
      return NextResponse.json(generateMockMetricValues(getParam.split(",")))
    }
    return NextResponse.json(generateMockMetricList("jm"))
  }

  try {
    const fetchFlink = createFlinkFetcher(config)
    const metricsPath = getParam
      ? `/jobmanager/metrics?get=${getParam}`
      : `/jobmanager/metrics`
    const data = await fetchFlink<FlinkMetricItem[]>(metricsPath)
    return NextResponse.json(data)
  } catch (err) {
    const message =
      err instanceof Error
        ? err.message
        : "Failed to fetch JM metrics from Flink"
    return NextResponse.json({ error: message }, { status: 502 })
  }
}
