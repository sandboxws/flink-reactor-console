import { NextResponse } from "next/server";
import { getConfig } from "@/lib/config";
import { createFlinkFetcher } from "@/lib/flink-fetcher";
import {
  generateMockVertexMetricsApiResponse,
  generateMockMetricList,
  generateMockMetricValues,
} from "@/data/mock-api-responses";
import type { FlinkVertexMetricsResponse } from "@/data/flink-api-types";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ jobId: string; vertexId: string }> },
) {
  const { jobId, vertexId } = await params;
  const config = getConfig();
  const url = new URL(request.url);
  const getParam = url.searchParams.get("get");

  if (config.mockMode) {
    if (getParam) {
      return NextResponse.json(generateMockMetricValues(getParam.split(",")));
    }
    return NextResponse.json(generateMockMetricList("job-vertex"));
  }

  try {
    const fetchFlink = createFlinkFetcher(config);
    const metricsPath = getParam
      ? `/jobs/${jobId}/vertices/${vertexId}/metrics?get=${getParam}`
      : `/jobs/${jobId}/vertices/${vertexId}/metrics`;
    const data = await fetchFlink<FlinkVertexMetricsResponse>(metricsPath);
    return NextResponse.json(data);
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to fetch vertex metrics from Flink";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
