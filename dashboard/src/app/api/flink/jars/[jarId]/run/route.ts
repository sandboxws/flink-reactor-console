import { NextResponse } from "next/server";
import { getConfig } from "@/lib/config";
import { createFlinkFetcher } from "@/lib/flink-fetcher";
import { generateMockJarRunApiResponse } from "@/data/mock-api-responses";
import type { FlinkJarRunResponse } from "@/data/flink-api-types";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ jarId: string }> },
) {
  const { jarId } = await params;
  const config = getConfig();

  if (config.mockMode) {
    return NextResponse.json(generateMockJarRunApiResponse());
  }

  try {
    const fetchFlink = createFlinkFetcher(config);
    const body = (await request.json()) as Record<string, unknown>;
    const data = await fetchFlink.post<FlinkJarRunResponse>(
      `/jars/${jarId}/run`,
      body,
    );
    return NextResponse.json(data);
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to run JAR on Flink";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
