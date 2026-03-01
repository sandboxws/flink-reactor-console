import { NextResponse } from "next/server";
import { getConfig } from "@/lib/config";
import { createFlinkFetcher } from "@/lib/flink-fetcher";
import {
  generateMockTaskManagerMetricsApiResponse,
  generateMockMetricList,
  generateMockMetricValues,
} from "@/data/mock-api-responses";
import type { FlinkMetricItem } from "@/data/flink-api-types";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ tmId: string }> },
) {
  const { tmId } = await params;
  const config = getConfig();
  const url = new URL(request.url);
  const getParam = url.searchParams.get("get");

  if (config.mockMode) {
    if (getParam) {
      return NextResponse.json(generateMockMetricValues(getParam.split(",")));
    }
    return NextResponse.json(generateMockMetricList("tm"));
  }

  try {
    const fetchFlink = createFlinkFetcher(config);
    const metricsPath = getParam
      ? `/taskmanagers/${tmId}/metrics?get=${getParam}`
      : `/taskmanagers/${tmId}/metrics`;
    const data = await fetchFlink<FlinkMetricItem[]>(metricsPath);
    return NextResponse.json(data);
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to fetch TM metrics from Flink";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
