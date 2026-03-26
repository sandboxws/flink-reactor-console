import {
  LogDetailPanel,
  LogHistogram,
  LogLine,
  LogList,
} from "@flink-reactor/ui"
import { createLogEntries, createLogEntry } from "@flink-reactor/ui/fixtures"
import { createFileRoute } from "@tanstack/react-router"
import { useState } from "react"
import { type PropDef, PropsTable } from "@/lib/props-table"
import { Section, ShowcasePage } from "@/lib/section"

const entries = createLogEntries(50)
const errorEntry = createLogEntry({
  level: "ERROR",
  message:
    "java.lang.RuntimeException: Failed to deserialize record from Kafka topic",
  stackTrace:
    "java.lang.RuntimeException: Failed to deserialize\n\tat org.apache.flink.connectors.kafka.FlinkKafkaConsumer.deserialize(FlinkKafkaConsumer.java:123)",
  isException: true,
})

const logLineProps: PropDef[] = [
  {
    name: "entry",
    type: "LogEntry",
    description: "Log entry object with timestamp, level, message, source",
  },
  {
    name: "isSelected",
    type: "boolean",
    description: "Whether this line is currently selected",
  },
  {
    name: "isExpanded",
    type: "boolean",
    description: "Whether the stack trace is expanded",
  },
  {
    name: "onClick",
    type: "() => void",
    description: "Click handler for selecting the line",
  },
  {
    name: "timestampFormat",
    type: "TimestampFormat",
    default: '"time"',
    description: "Timestamp display format",
  },
  {
    name: "searchQuery",
    type: "string",
    default: '""',
    description: "Highlight matching text in the message",
  },
  {
    name: "isRegex",
    type: "boolean",
    default: "false",
    description: "Whether searchQuery is a regex pattern",
  },
]

const logListProps: PropDef[] = [
  {
    name: "entries",
    type: "LogEntry[]",
    description: "Array of log entries to display",
  },
  {
    name: "selectedEntryId",
    type: "string | null",
    default: "null",
    description: "Currently selected entry ID",
  },
  {
    name: "onSelectEntry",
    type: "(id: string) => void",
    default: "undefined",
    description: "Callback when an entry is clicked",
  },
  {
    name: "timestampFormat",
    type: "TimestampFormat",
    default: '"time"',
    description: "Timestamp display format",
  },
  {
    name: "searchQuery",
    type: "string",
    default: '""',
    description: "Search query for text highlighting",
  },
]

const logHistogramProps: PropDef[] = [
  {
    name: "entries",
    type: "LogEntry[]",
    description: "Log entries to bucketize into the histogram",
  },
  {
    name: "onBucketClick",
    type: "(start: Date, end: Date) => void",
    default: "undefined",
    description: "Callback when a histogram bucket is clicked",
  },
]

const TOC = [
  { id: "log-line", label: "LogLine" },
  { id: "log-list", label: "LogList" },
  { id: "log-detail-panel", label: "LogDetailPanel" },
  { id: "log-histogram", label: "LogHistogram" },
]

/** Showcase route: /domain/logs -- Showcases log explorer components (LogLine, LogList, LogDetailPanel, LogHistogram) with fixture data. */
function LogsDomainPage() {
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const selectedEntry = entries.find((e) => e.id === selectedId) ?? errorEntry

  return (
    <ShowcasePage
      title="Logs"
      description="Log viewer components. 4 components."
      items={TOC}
    >
      <Section
        id="log-line"
        title="LogLine"
        description="Single log row with severity badge, source badge, timestamp, and search highlighting."
      >
        <div className="glass-card overflow-hidden">
          <LogLine
            entry={entries[0]}
            isSelected={false}
            isExpanded={false}
            onClick={() => {}}
          />
          <LogLine
            entry={errorEntry}
            isSelected={true}
            isExpanded={false}
            onClick={() => {}}
          />
        </div>
        <div className="mt-4">
          <PropsTable props={logLineProps} />
        </div>
      </Section>

      <Section
        id="log-list"
        title="LogList"
        description="Virtualized log list with auto-scroll, stack trace expansion, and search match scrolling."
      >
        <div className="glass-card h-[300px] overflow-hidden">
          <LogList
            entries={entries}
            selectedEntryId={selectedId}
            onSelectEntry={setSelectedId}
          />
        </div>
        <div className="mt-4">
          <PropsTable props={logListProps} />
        </div>
      </Section>

      <Section
        id="log-detail-panel"
        title="LogDetailPanel"
        description="Side panel with tabbed detail view: metadata, stack trace, context lines, and raw output."
      >
        <div className="glass-card h-[400px] overflow-hidden">
          <LogDetailPanel
            entry={selectedEntry}
            contextLines={entries.slice(0, 5)}
            onClose={() => setSelectedId(null)}
          />
        </div>
      </Section>

      <Section
        id="log-histogram"
        title="LogHistogram"
        description="Stacked bar chart showing log entry distribution by severity over time."
      >
        <div className="glass-card overflow-hidden">
          <LogHistogram
            entries={entries}
            onBucketClick={(_start, _end) => {}}
          />
        </div>
        <div className="mt-4">
          <PropsTable props={logHistogramProps} />
        </div>
      </Section>
    </ShowcasePage>
  )
}

export const Route = createFileRoute("/domain/logs")({
  component: LogsDomainPage,
})
