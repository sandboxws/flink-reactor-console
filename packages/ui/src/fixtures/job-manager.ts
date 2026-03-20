import type { JobManagerInfo, JobManagerMetrics, JvmMetricSample } from "../types"

function createSamples(count: number, baseValue: number): JvmMetricSample[] {
  const samples: JvmMetricSample[] = []
  const now = Date.now()
  for (let i = 0; i < count; i++) {
    samples.push({
      timestamp: new Date(now - (count - i) * 10_000),
      value: baseValue + Math.random() * baseValue * 0.1,
    })
  }
  return samples
}

export function createJobManagerMetrics(overrides?: Partial<JobManagerMetrics>): JobManagerMetrics {
  return {
    jvmHeapUsed: createSamples(30, 800_000_000),
    jvmHeapMax: 2_147_483_648,
    jvmNonHeapUsed: createSamples(30, 120_000_000),
    jvmNonHeapMax: 536_870_912,
    threadCount: createSamples(30, 85),
    gcCount: createSamples(30, 150),
    gcTime: createSamples(30, 2_500),
    ...overrides,
  }
}

export function createJobManagerInfo(overrides?: Partial<JobManagerInfo>): JobManagerInfo {
  return {
    config: [
      { key: "jobmanager.rpc.address", value: "jobmanager" },
      { key: "jobmanager.rpc.port", value: "6123" },
      { key: "jobmanager.memory.process.size", value: "2048m" },
      { key: "state.backend.type", value: "rocksdb" },
      { key: "state.checkpoints.dir", value: "s3://flink-checkpoints/prod" },
    ],
    metrics: createJobManagerMetrics(),
    logs: "2024-01-15 10:00:00,000 INFO  org.apache.flink.runtime.dispatcher.DispatcherRestEndpoint  - Web frontend listening at http://0.0.0.0:8081.",
    stdout: "",
    jvm: {
      arguments: ["-Xmx2048m", "-XX:+UseG1GC"],
      systemProperties: [{ key: "java.version", value: "17.0.9" }],
      memoryConfig: {
        heapMax: 2_147_483_648,
        heapUsed: 800_000_000,
        nonHeapMax: 536_870_912,
        nonHeapUsed: 120_000_000,
        metaspaceMax: 268_435_456,
        metaspaceUsed: 90_000_000,
        directMax: 134_217_728,
        directUsed: 32_000_000,
      },
    },
    classpath: [
      { path: "/opt/flink/lib/flink-dist-1.20.1.jar", filename: "flink-dist-1.20.1.jar", size: 145_000_000, tag: "flink-dist" },
    ],
    logFiles: [{ name: "jobmanager.log", lastModified: new Date(), size: 2_048 }],
    threadDump: { threadInfos: [] },
    ...overrides,
  }
}
