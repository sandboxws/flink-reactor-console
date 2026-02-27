import { NextResponse } from "next/server";
import { getConfig } from "@/lib/config";
import { createFlinkFetcher } from "@/lib/flink-fetcher";
import { generateMockLogFileContentApiResponse } from "@/data/mock-api-responses";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ logName: string }> },
) {
  const { logName } = await params;
  const config = getConfig();

  if (config.mockMode) {
    return new NextResponse(
      generateMockLogFileContentApiResponse("jobmanager", logName),
      { headers: { "Content-Type": "text/plain" } },
    );
  }

  try {
    const fetchFlink = createFlinkFetcher(config);
    const text = await fetchFlink.text(
      `/jobmanager/logs/${encodeURIComponent(logName)}`,
    );
    return new NextResponse(text, {
      headers: { "Content-Type": "text/plain" },
    });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to fetch JM log file from Flink";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
