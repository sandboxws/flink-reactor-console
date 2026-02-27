import { NextResponse } from "next/server";
import { getConfig } from "@/lib/config";
import { createFlinkFetcher } from "@/lib/flink-fetcher";
import { generateMockTaskManagersApiResponse } from "@/data/mock-api-responses";
import type { FlinkTaskManagersResponse } from "@/data/flink-api-types";

export async function GET() {
  const config = getConfig();

  if (config.mockMode) {
    return NextResponse.json(generateMockTaskManagersApiResponse());
  }

  try {
    const fetchFlink = createFlinkFetcher(config);
    const data = await fetchFlink<FlinkTaskManagersResponse>("/taskmanagers");
    return NextResponse.json(data);
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to fetch task managers from Flink";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
