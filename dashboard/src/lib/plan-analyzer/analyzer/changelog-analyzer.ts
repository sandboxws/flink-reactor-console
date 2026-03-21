import type {
  ChangelogMode,
  FlinkAntiPattern,
  FlinkOperatorNode,
} from "../types"

interface ChangelogAnalysisResult {
  antiPatterns: FlinkAntiPattern[]
}

function modeRank(mode: ChangelogMode): number {
  switch (mode) {
    case "INSERT_ONLY":
      return 0
    case "UPSERT":
      return 1
    case "RETRACT":
      return 2
    case "ALL":
      return 3
    default:
      return 0
  }
}

function maxMode(a: ChangelogMode, b: ChangelogMode): ChangelogMode {
  return modeRank(a) >= modeRank(b) ? a : b
}

function mergeChildModes(node: FlinkOperatorNode): ChangelogMode {
  let merged: ChangelogMode = "INSERT_ONLY"

  for (const child of node.children) {
    merged = maxMode(merged, inferChangelogMode(child))
  }

  return merged
}

function inferChangelogMode(node: FlinkOperatorNode): ChangelogMode {
  const operatorType = node.operatorType

  if (node.category === "source") {
    const description = node.description?.toLowerCase() || ""
    if (
      description.includes("cdc") ||
      description.includes("debezium") ||
      description.includes("canal")
    ) {
      return "ALL"
    }
    return "INSERT_ONLY"
  }

  if (node.category === "aggregation") {
    const description = node.description?.toLowerCase() || ""
    if (description.includes("hasunique") || description.includes("primary")) {
      return "UPSERT"
    }
    return "RETRACT"
  }

  if (node.category === "join") {
    if (operatorType === "LookupJoin") {
      return mergeChildModes(node)
    }
    return "RETRACT"
  }

  if (node.category === "deduplication") {
    const description = node.description?.toLowerCase() || ""
    if (description.includes("first")) {
      return "INSERT_ONLY"
    }
    return "UPSERT"
  }

  if (node.category === "window") {
    return "INSERT_ONLY"
  }

  if (node.category === "transformation") {
    return mergeChildModes(node)
  }

  if (node.category === "sink") {
    return mergeChildModes(node)
  }

  if (node.children.length > 0) {
    return mergeChildModes(node)
  }

  return "INSERT_ONLY"
}

function getSinkCapability(node: FlinkOperatorNode): {
  supportsUpsert: boolean
  supportsRetract: boolean
  requiresPrimaryKey: boolean
} {
  const operatorType = node.operatorType
  const description = node.description?.toLowerCase() || ""

  if (operatorType === "KafkaSink" || description.includes("kafka")) {
    if (description.includes("upsert")) {
      return {
        supportsUpsert: true,
        supportsRetract: false,
        requiresPrimaryKey: true,
      }
    }
    return {
      supportsUpsert: false,
      supportsRetract: false,
      requiresPrimaryKey: false,
    }
  }

  if (operatorType === "JdbcSink" || description.includes("jdbc")) {
    return {
      supportsUpsert: true,
      supportsRetract: true,
      requiresPrimaryKey: true,
    }
  }

  if (operatorType === "FileSystemSink" || description.includes("filesystem")) {
    return {
      supportsUpsert: false,
      supportsRetract: false,
      requiresPrimaryKey: false,
    }
  }

  if (operatorType === "PrintSink" || description.includes("print")) {
    return {
      supportsUpsert: false,
      supportsRetract: false,
      requiresPrimaryKey: false,
    }
  }

  if (operatorType === "UpsertMaterialize") {
    return {
      supportsUpsert: true,
      supportsRetract: true,
      requiresPrimaryKey: true,
    }
  }

  return {
    supportsUpsert: true,
    supportsRetract: true,
    requiresPrimaryKey: false,
  }
}

function hasPrimaryKey(node: FlinkOperatorNode): boolean {
  const description = node.description?.toLowerCase() || ""
  return (
    description.includes("primary key") ||
    description.includes("primarykey") ||
    description.includes("hasunique")
  )
}

function findUpstreamChangelogMode(node: FlinkOperatorNode): ChangelogMode {
  return mergeChildModes(node)
}

function analyzeSinkCompatibility(node: FlinkOperatorNode): FlinkAntiPattern[] {
  const antiPatterns: FlinkAntiPattern[] = []

  if (node.category !== "sink") {
    return antiPatterns
  }

  const sinkCapability = getSinkCapability(node)
  const upstreamMode = findUpstreamChangelogMode(node)

  if (
    (upstreamMode === "RETRACT" || upstreamMode === "ALL") &&
    !sinkCapability.supportsRetract &&
    !sinkCapability.supportsUpsert
  ) {
    antiPatterns.push({
      id: `ap-changelog-incompatible-${node.id}`,
      nodeId: node.id,
      severity: "critical",
      type: "changelog-incompatible",
      title: "Changelog Mode Incompatibility",
      description: `Upstream produces ${upstreamMode} changelog, but sink only supports INSERT_ONLY.`,
      suggestion:
        "Use a sink that supports retractions (e.g., upsert-kafka, jdbc) or add a deduplication operator.",
      sqlRewrite: `-- Option 1: Use upsert sink
-- Option 2: Add first-row deduplication to convert to append-only:
SELECT * FROM (
  SELECT *, ROW_NUMBER() OVER (PARTITION BY key ORDER BY event_time) AS rn
  FROM upstream
) WHERE rn = 1`,
    })
  }

  if (
    upstreamMode === "UPSERT" &&
    !sinkCapability.supportsUpsert &&
    !sinkCapability.supportsRetract
  ) {
    antiPatterns.push({
      id: `ap-upsert-to-append-${node.id}`,
      nodeId: node.id,
      severity: "critical",
      type: "changelog-incompatible",
      title: "Upsert to Append-Only Sink",
      description:
        "Upstream produces UPSERT changelog, but sink only supports INSERT_ONLY.",
      suggestion: "Use a sink that supports upsert mode or add deduplication.",
    })
  }

  if (sinkCapability.requiresPrimaryKey && !hasPrimaryKey(node)) {
    antiPatterns.push({
      id: `ap-missing-pk-sink-${node.id}`,
      nodeId: node.id,
      severity: "critical",
      type: "missing-primary-key",
      title: "Missing Primary Key for Upsert Sink",
      description: "Upsert sink requires a primary key, but none is defined.",
      suggestion: "Add PRIMARY KEY to the sink table definition.",
      ddlFix: `CREATE TABLE sink_table (
  id BIGINT,
  ...
  PRIMARY KEY (id) NOT ENFORCED  -- Add this
);`,
    })
  }

  return antiPatterns
}

function traverseOperators(
  node: FlinkOperatorNode,
  visitor: (node: FlinkOperatorNode) => void,
): void {
  visitor(node)
  for (const child of node.children) {
    traverseOperators(child, visitor)
  }
}

export function analyzeChangelog(
  root: FlinkOperatorNode,
): ChangelogAnalysisResult {
  const antiPatterns: FlinkAntiPattern[] = []

  function annotateModes(node: FlinkOperatorNode): void {
    for (const child of node.children) {
      annotateModes(child)
    }
    node.changelogMode = inferChangelogMode(node)
  }

  annotateModes(root)

  traverseOperators(root, (node) => {
    const patterns = analyzeSinkCompatibility(node)
    antiPatterns.push(...patterns)
  })

  return { antiPatterns }
}
