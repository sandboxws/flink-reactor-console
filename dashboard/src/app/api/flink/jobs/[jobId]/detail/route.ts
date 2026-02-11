import { NextResponse } from "next/server";
import { getConfig } from "@/lib/config";
import { createFlinkFetcher } from "@/lib/flink-fetcher";
import { generateMockJobDetailApiResponse } from "@/data/mock-api-responses";
import type {
  FlinkJobDetailAggregate,
  FlinkJobDetailResponse,
  FlinkJobExceptionsResponse,
  FlinkCheckpointingStatistics,
  FlinkCheckpointConfigResponse,
  FlinkJobConfigResponse,
  FlinkVertexDetailResponse,
} from "@/data/flink-api-types";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ jobId: string }> },
) {
  const { jobId } = await params;
  const config = getConfig();

  if (config.mockMode) {
    return NextResponse.json(generateMockJobDetailApiResponse(jobId));
  }

  try {
    const fetchFlink = createFlinkFetcher(config);

    // Phase 1: Fetch all independent endpoints in parallel
    const [job, exceptions, checkpoints, checkpointConfig, jobConfig] =
      await Promise.all([
        fetchFlink<FlinkJobDetailResponse>(`/jobs/${jobId}`),
        fetchFlink<FlinkJobExceptionsResponse>(`/jobs/${jobId}/exceptions`),
        fetchFlink<FlinkCheckpointingStatistics>(`/jobs/${jobId}/checkpoints`),
        fetchFlink<FlinkCheckpointConfigResponse>(
          `/jobs/${jobId}/checkpoints/config`,
        ),
        fetchFlink<FlinkJobConfigResponse>(`/jobs/${jobId}/config`),
      ]);

    // Phase 2: Fetch per-vertex details (vertex IDs come from Phase 1)
    const vertexIds = job.vertices.map((v) => v.id);
    const vertexResponses = await Promise.all(
      vertexIds.map((vid) =>
        fetchFlink<FlinkVertexDetailResponse>(
          `/jobs/${jobId}/vertices/${vid}`,
        ),
      ),
    );

    const vertexDetails: Record<string, FlinkVertexDetailResponse> = {};
    for (let i = 0; i < vertexIds.length; i++) {
      vertexDetails[vertexIds[i]] = vertexResponses[i];
    }

    const aggregate: FlinkJobDetailAggregate = {
      job,
      exceptions,
      checkpoints,
      checkpointConfig,
      jobConfig,
      vertexDetails,
    };

    return NextResponse.json(aggregate);
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to fetch job detail from Flink";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
