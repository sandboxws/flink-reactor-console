import { NextResponse } from "next/server";
import { getConfig } from "@/lib/config";
import { createFlinkFetcher } from "@/lib/flink-fetcher";
import { generateMockVertexMetricsApiResponse } from "@/data/mock-api-responses";
import type { FlinkVertexMetricsResponse } from "@/data/flink-api-types";

const VERTEX_METRIC_IDS = [
  "numRecordsInPerSecond",
  "numRecordsOutPerSecond",
  "numBytesInPerSecond",
  "numBytesOutPerSecond",
  "busyTimeMsPerSecond",
  "backPressuredTimeMsPerSecond",
  "idleTimeMsPerSecond",
  "currentInputWatermark",
].join(",");

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ jobId: string; vertexId: string }> },
) {
  const { jobId, vertexId } = await params;
  const config = getConfig();

  if (config.mockMode) {
    return NextResponse.json(generateMockVertexMetricsApiResponse());
  }

  try {
    const fetchFlink = createFlinkFetcher(config);
    const data = await fetchFlink<FlinkVertexMetricsResponse>(
      `/jobs/${jobId}/vertices/${vertexId}/metrics?get=${VERTEX_METRIC_IDS}`,
    );
    return NextResponse.json(data);
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to fetch vertex metrics from Flink";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
