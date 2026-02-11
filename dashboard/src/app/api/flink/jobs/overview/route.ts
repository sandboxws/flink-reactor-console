import { NextResponse } from "next/server";
import { getConfig } from "@/lib/config";
import { createFlinkFetcher } from "@/lib/flink-fetcher";
import { generateMockJobsOverviewApiResponse } from "@/data/mock-api-responses";
import type { FlinkJobsOverviewResponse } from "@/data/flink-api-types";

export async function GET() {
  const config = getConfig();

  if (config.mockMode) {
    return NextResponse.json(generateMockJobsOverviewApiResponse());
  }

  try {
    const fetchFlink = createFlinkFetcher(config);
    const data = await fetchFlink<FlinkJobsOverviewResponse>("/jobs/overview");
    return NextResponse.json(data);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to fetch from Flink";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
