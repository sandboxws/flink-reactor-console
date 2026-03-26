/** Fixture data for task managers — resources, memory configuration, and JVM metrics. */

import type {
  TaskManager,
  TaskManagerMetrics,
  TaskManagerMemoryConfiguration,
  TaskManagerResource,
  AllocatedSlot,
} from "../types"

/** Monotonic counter for generating unique task manager IDs. */
let tmCounter = 0

/** Create a task manager resource descriptor with 4 CPU cores and default memory. */
function createResource(overrides?: Partial<TaskManagerResource>): TaskManagerResource {
  return {
    cpuCores: 4,
    taskHeapMemory: 4_294_967_296,
    taskOffHeapMemory: 0,
    managedMemory: 2_147_483_648,
    networkMemory: 1_073_741_824,
    ...overrides,
  }
}

/** Create a task manager memory configuration with ~8 GB total process memory. */
function createMemoryConfig(overrides?: Partial<TaskManagerMemoryConfiguration>): TaskManagerMemoryConfiguration {
  return {
    frameworkHeap: 134_217_728,
    taskHeap: 4_294_967_296,
    frameworkOffHeap: 134_217_728,
    taskOffHeap: 0,
    networkMemory: 1_073_741_824,
    managedMemory: 2_147_483_648,
    jvmMetaspace: 268_435_456,
    jvmOverhead: 429_496_730,
    totalFlinkMemory: 7_784_628_224,
    totalProcessMemory: 8_482_560_410,
    ...overrides,
  }
}

/** Create task manager metrics with CPU, heap, network, managed memory, and GC stats. */
export function createTaskManagerMetrics(overrides?: Partial<TaskManagerMetrics>): TaskManagerMetrics {
  return {
    cpuUsage: 0.35,
    heapUsed: 1_800_000_000,
    heapCommitted: 4_294_967_296,
    heapMax: 4_294_967_296,
    nonHeapUsed: 120_000_000,
    nonHeapCommitted: 150_000_000,
    nonHeapMax: 268_435_456,
    directCount: 128,
    directUsed: 64_000_000,
    directMax: 134_217_728,
    mappedCount: 0,
    mappedUsed: 0,
    mappedMax: 0,
    nettyShuffleMemoryAvailable: 800_000_000,
    nettyShuffleMemoryUsed: 273_741_824,
    nettyShuffleMemoryTotal: 1_073_741_824,
    nettyShuffleSegmentsAvailable: 25_000,
    nettyShuffleSegmentsUsed: 7_000,
    nettyShuffleSegmentsTotal: 32_000,
    managedMemoryUsed: 1_000_000_000,
    managedMemoryTotal: 2_147_483_648,
    metaspaceUsed: 90_000_000,
    metaspaceMax: 268_435_456,
    garbageCollectors: [
      { name: "G1 Young Generation", count: 245, time: 3_400 },
      { name: "G1 Old Generation", count: 3, time: 1_200 },
    ],
    threadCount: 142,
    ...overrides,
  }
}

/** Create a task manager with 4 slots (3 allocated), metrics, and memory config. */
export function createTaskManager(overrides?: Partial<TaskManager>): TaskManager {
  const idx = tmCounter++
  const id = overrides?.id ?? `tm-${idx}-${Date.now().toString(36)}`
  return {
    id,
    path: `akka.tcp://flink@taskmanager-${idx}:6122/user/rpc/taskmanager_0`,
    dataPort: 42_000 + idx,
    jmxPort: 9250 + idx,
    lastHeartbeat: new Date(),
    slotsTotal: 4,
    slotsFree: 1,
    cpuCores: 4,
    physicalMemory: 17_179_869_184,
    freeMemory: 8_000_000_000,
    totalResource: createResource(),
    freeResource: createResource({ cpuCores: 1, taskHeapMemory: 1_073_741_824 }),
    memoryConfiguration: createMemoryConfig(),
    allocatedSlots: [
      { index: 0, jobId: "job-001", resource: createResource() },
      { index: 1, jobId: "job-001", resource: createResource() },
      { index: 2, jobId: "job-002", resource: createResource() },
    ],
    metrics: createTaskManagerMetrics(),
    logs: "",
    stdout: "",
    logFiles: [],
    threadDump: { threadInfos: [] },
    ...overrides,
  }
}
