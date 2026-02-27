import { NextResponse } from "next/server";
import { getConfig } from "@/lib/config";
import { createFlinkFetcher } from "@/lib/flink-fetcher";
import { generateMockLogTextApiResponse } from "@/data/mock-api-responses";

export async function GET() {
  const config = getConfig();

  if (config.mockMode) {
    return new NextResponse(
      generateMockLogTextApiResponse("jobmanager", "stdout"),
      { headers: { "Content-Type": "text/plain" } },
    );
  }

  try {
    const fetchFlink = createFlinkFetcher(config);
    const text = await fetchFlink.text("/jobmanager/stdout");
    return new NextResponse(text, {
      headers: { "Content-Type": "text/plain" },
    });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to fetch JM stdout from Flink";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
