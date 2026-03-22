import { formatDuration } from "@flink-reactor/ui"
import { ANALYSIS_THRESHOLDS } from "../constants"
import type {
  FlinkAntiPattern,
  FlinkOperatorNode,
  FlinkWindowInfo,
  FlinkWindowType,
} from "../types"

interface WindowAnalysisResult {
  antiPatterns: FlinkAntiPattern[]
}

function parseWindowInfo(node: FlinkOperatorNode): FlinkWindowInfo | null {
  if (node.category !== "window") {
    return null
  }

  const description = node.description?.toLowerCase() || ""

  let windowType: FlinkWindowType = "TUMBLE"
  let windowSize = 0
  let windowSlide: number | undefined
  let sessionGap: number | undefined

  if (description.includes("tumble")) {
    windowType = "TUMBLE"
  } else if (description.includes("hop") || description.includes("slide")) {
    windowType = "HOP"
  } else if (description.includes("session")) {
    windowType = "SESSION"
  } else if (description.includes("cumulate")) {
    windowType = "CUMULATE"
  }

  const intervalMatches = description.matchAll(
    /interval\s+'?(\d+)'?\s+(second|minute|hour|day)/gi,
  )

  const intervals: number[] = []
  for (const match of intervalMatches) {
    const value = parseInt(match[1], 10)
    const unit = match[2].toLowerCase()
    const ms =
      unit === "day"
        ? value * 86400000
        : unit === "hour"
          ? value * 3600000
          : unit === "minute"
            ? value * 60000
            : value * 1000
    intervals.push(ms)
  }

  if (windowType === "TUMBLE" && intervals.length >= 1) {
    windowSize = intervals[0]
  } else if (windowType === "HOP" && intervals.length >= 2) {
    windowSlide = intervals[0]
    windowSize = intervals[1]
  } else if (windowType === "SESSION" && intervals.length >= 1) {
    sessionGap = intervals[0]
    windowSize = intervals[0]
  } else if (windowType === "CUMULATE" && intervals.length >= 2) {
    windowSlide = intervals[0]
    windowSize = intervals[1]
  }

  let allowedLateness: number | undefined
  const latenessMatch = description.match(
    /allowed[-_]?lateness.*?(\d+)\s*(second|minute|hour)/i,
  )
  if (latenessMatch) {
    const value = parseInt(latenessMatch[1], 10)
    const unit = latenessMatch[2].toLowerCase()
    allowedLateness =
      unit === "hour"
        ? value * 3600000
        : unit === "minute"
          ? value * 60000
          : value * 1000
  }

  return {
    windowType,
    windowSize,
    windowSlide,
    sessionGap,
    allowedLateness,
  }
}

function analyzeWindowOperator(node: FlinkOperatorNode): {
  windowInfo: FlinkWindowInfo | null
  antiPatterns: FlinkAntiPattern[]
} {
  const antiPatterns: FlinkAntiPattern[] = []
  const windowInfo = parseWindowInfo(node)

  if (!windowInfo) {
    return { windowInfo: null, antiPatterns }
  }

  node.windowInfo = windowInfo

  const windowSizeHours = windowInfo.windowSize / 3600000

  if (windowSizeHours > ANALYSIS_THRESHOLDS.WINDOW_SIZE_CRITICAL_HOURS) {
    antiPatterns.push({
      id: `ap-large-window-${node.id}`,
      nodeId: node.id,
      severity: "critical",
      type: "large-window",
      title: "Very Large Window Size",
      description: `Window size of ${windowSizeHours.toFixed(0)} hours will accumulate significant state.`,
      suggestion:
        "Consider if such a large window is necessary. Use incremental aggregation patterns if possible.",
      flinkConfig: `-- Consider using mini-batch for incremental processing:
SET 'table.exec.mini-batch.enabled' = 'true';`,
    })
  } else if (windowSizeHours > ANALYSIS_THRESHOLDS.WINDOW_SIZE_WARNING_HOURS) {
    antiPatterns.push({
      id: `ap-large-window-warning-${node.id}`,
      nodeId: node.id,
      severity: "warning",
      type: "large-window",
      title: "Large Window Size",
      description: `Window size of ${windowSizeHours.toFixed(0)} hours. Monitor state size carefully.`,
      suggestion: "Ensure adequate memory for window state.",
    })
  }

  if (windowInfo.windowType === "HOP" && windowInfo.windowSlide) {
    const paneCount = windowInfo.windowSize / windowInfo.windowSlide

    if (paneCount > ANALYSIS_THRESHOLDS.SLIDING_WINDOW_PANE_CRITICAL) {
      antiPatterns.push({
        id: `ap-pane-explosion-${node.id}`,
        nodeId: node.id,
        severity: "critical",
        type: "sliding-window-pane-explosion",
        title: "Sliding Window Pane Explosion",
        description: `Window has ${paneCount.toFixed(0)} overlapping panes (size=${formatDuration(windowInfo.windowSize)}, slide=${formatDuration(windowInfo.windowSlide)}). Each key exists in ${paneCount.toFixed(0)} windows simultaneously.`,
        suggestion:
          "Increase slide interval or reduce window size. Consider using TUMBLE instead.",
      })
    } else if (paneCount > ANALYSIS_THRESHOLDS.SLIDING_WINDOW_PANE_WARNING) {
      antiPatterns.push({
        id: `ap-pane-warning-${node.id}`,
        nodeId: node.id,
        severity: "warning",
        type: "sliding-window-pane-explosion",
        title: "Many Overlapping Window Panes",
        description: `Window has ${paneCount.toFixed(0)} overlapping panes. This increases state and processing cost.`,
        suggestion: "Consider if this many panes are necessary.",
      })
    }
  }

  if (windowInfo.windowType === "SESSION") {
    const gapHours = (windowInfo.sessionGap || 0) / 3600000

    if (gapHours > 24) {
      antiPatterns.push({
        id: `ap-session-long-gap-${node.id}`,
        nodeId: node.id,
        severity: "warning",
        type: "session-no-timeout",
        title: "Very Long Session Gap",
        description: `Session gap of ${formatDuration(windowInfo.sessionGap || 0)} may cause sessions to remain open for extended periods.`,
        suggestion:
          "Consider if such a long session gap is necessary. Sessions that never close accumulate state.",
      })
    }

    antiPatterns.push({
      id: `ap-session-state-${node.id}`,
      nodeId: node.id,
      severity: "info",
      type: "session-no-timeout",
      title: "Session Window State Consideration",
      description:
        "Session windows keep state until the session closes. Long-running sessions accumulate state.",
      suggestion:
        "Monitor session durations and consider adding a maximum session length.",
    })
  }

  if (windowInfo.windowType === "CUMULATE") {
    const maxSizeHours = windowInfo.windowSize / 3600000
    if (maxSizeHours > 24) {
      antiPatterns.push({
        id: `ap-cumulate-large-${node.id}`,
        nodeId: node.id,
        severity: "warning",
        type: "large-window",
        title: "Large Cumulating Window",
        description: `Cumulating window with max size of ${formatDuration(windowInfo.windowSize)} keeps state for the entire period.`,
        suggestion: "Consider if such a large cumulating window is necessary.",
      })
    }
  }

  return { windowInfo, antiPatterns }
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

export function analyzeWindows(root: FlinkOperatorNode): WindowAnalysisResult {
  const antiPatterns: FlinkAntiPattern[] = []

  traverseOperators(root, (node) => {
    const result = analyzeWindowOperator(node)
    if (result.windowInfo) {
      node.windowInfo = result.windowInfo
    }
    antiPatterns.push(...result.antiPatterns)
  })

  return { antiPatterns }
}
