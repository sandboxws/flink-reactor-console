import { NextResponse } from "next/server";
import { getConfig } from "@/lib/config";
import { createFlinkFetcher } from "@/lib/flink-fetcher";
import { generateMockLogListApiResponse } from "@/data/mock-api-responses";
import type { FlinkLogListResponse } from "@/data/flink-api-types";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ tmId: string }> },
) {
  const { tmId } = await params;
  const config = getConfig();

  if (config.mockMode) {
    return NextResponse.json(generateMockLogListApiResponse("taskmanager", tmId));
  }

  try {
    const fetchFlink = createFlinkFetcher(config);
    const data = await fetchFlink<FlinkLogListResponse>(
      `/taskmanagers/${tmId}/logs`,
    );
    return NextResponse.json(data);
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to fetch TM log list from Flink";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
