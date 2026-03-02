import { NextResponse } from "next/server"
import type {
  FlinkCheckpointConfigResponse,
  FlinkCheckpointingStatistics,
  FlinkJobConfigResponse,
  FlinkJobDetailAggregate,
  FlinkJobDetailResponse,
  FlinkJobExceptionsResponse,
  FlinkVertexAccumulatorsResponse,
  FlinkVertexBackPressureResponse,
  FlinkVertexDetailResponse,
  FlinkWatermarksResponse,
} from "@/data/flink-api-types"
import { generateMockJobDetailApiResponse } from "@/data/mock-api-responses"
import { getConfig } from "@/lib/config"
import { createFlinkFetcher } from "@/lib/flink-fetcher"
import { createServerLogger } from "@/lib/logger"

const log = createServerLogger().getSubLogger({ name: "api:jobs:detail" })

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ jobId: string }> },
) {
  const { jobId } = await params
  const config = getConfig()

  if (config.mockMode) {
    log.info("MOCK → generateMockJobDetailApiResponse", {
      screen: "Job Detail",
      file: "mock-api-responses.ts",
      generator: "generateMockJobDetailApiResponse",
    })
    return NextResponse.json(generateMockJobDetailApiResponse(jobId))
  }

  try {
    const fetchFlink = createFlinkFetcher(config)

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
      ])

    // Phase 2: Fetch per-vertex details (required) + supplementary data (best-effort)
    const vertexIds = job.vertices.map((v) => v.id)

    // Helper: fetch per-vertex, returning empty fallback on failure
    const fetchAllVertices = <T>(path: (vid: string) => string, fallback: T) =>
      Promise.all(
        vertexIds.map((vid) => fetchFlink<T>(path(vid)).catch(() => fallback)),
      )

    const [vertexResponses, watermarkResponses, bpResponses, accResponses] =
      await Promise.all([
        // Vertex details are critical — let errors propagate
        Promise.all(
          vertexIds.map((vid) =>
            fetchFlink<FlinkVertexDetailResponse>(
              `/jobs/${jobId}/vertices/${vid}`,
            ),
          ),
        ),
        // Supplementary endpoints degrade gracefully
        fetchAllVertices<FlinkWatermarksResponse>(
          (vid) => `/jobs/${jobId}/vertices/${vid}/watermarks`,
          [],
        ),
        fetchAllVertices<FlinkVertexBackPressureResponse>(
          (vid) => `/jobs/${jobId}/vertices/${vid}/backpressure`,
          {
            status: "ok",
            backpressureLevel: "ok",
            "end-timestamp": 0,
            subtasks: [],
          },
        ),
        fetchAllVertices<FlinkVertexAccumulatorsResponse>(
          (vid) => `/jobs/${jobId}/vertices/${vid}/accumulators`,
          { id: "", "user-accumulators": [] },
        ),
      ])

    const vertexDetails: Record<string, FlinkVertexDetailResponse> = {}
    const watermarks: Record<string, FlinkWatermarksResponse> = {}
    const backpressure: Record<string, FlinkVertexBackPressureResponse> = {}
    const accumulators: Record<string, FlinkVertexAccumulatorsResponse> = {}
    for (let i = 0; i < vertexIds.length; i++) {
      vertexDetails[vertexIds[i]] = vertexResponses[i]
      watermarks[vertexIds[i]] = watermarkResponses[i]
      backpressure[vertexIds[i]] = bpResponses[i]
      accumulators[vertexIds[i]] = accResponses[i]
    }

    const aggregate: FlinkJobDetailAggregate = {
      job,
      exceptions,
      checkpoints,
      checkpointConfig,
      jobConfig,
      vertexDetails,
      watermarks,
      backpressure,
      accumulators,
    }

    return NextResponse.json(aggregate)
  } catch (err) {
    const message =
      err instanceof Error
        ? err.message
        : "Failed to fetch job detail from Flink"
    return NextResponse.json({ error: message }, { status: 502 })
  }
}
