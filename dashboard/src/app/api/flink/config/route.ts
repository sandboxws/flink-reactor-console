import { NextResponse } from "next/server";
import { getConfig } from "@/lib/config";
import { createFlinkFetcher } from "@/lib/flink-fetcher";
import { generateMockClusterConfigApiResponse } from "@/data/mock-api-responses";
import type { FlinkClusterConfigResponse } from "@/data/flink-api-types";

export async function GET() {
  const config = getConfig();

  if (config.mockMode) {
    return NextResponse.json(generateMockClusterConfigApiResponse());
  }

  try {
    const fetchFlink = createFlinkFetcher(config);
    const data = await fetchFlink<FlinkClusterConfigResponse>("/config");
    return NextResponse.json(data);
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to fetch cluster config from Flink";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
