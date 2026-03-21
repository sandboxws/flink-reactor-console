import { ErrorDetail, ErrorTimeline } from "@flink-reactor/ui"
import { createErrorGroup } from "@flink-reactor/ui/fixtures"
import { createFileRoute } from "@tanstack/react-router"
import { type PropDef, PropsTable } from "@/lib/props-table"
import { Section, ShowcasePage } from "@/lib/section"

const errorGroup = createErrorGroup()

const errorDetailProps: PropDef[] = [
  {
    name: "group",
    type: "ErrorGroup",
    description:
      "Grouped error with exception class, message, count, timestamps, and sample entry",
  },
  {
    name: "onViewRelatedLogs",
    type: "(group: ErrorGroup) => void",
    default: "undefined",
    description: "Callback to navigate to related log entries",
  },
]

const errorTimelineProps: PropDef[] = [
  {
    name: "occurrences",
    type: "Date[]",
    description:
      "Array of timestamps when the error occurred, bucketed into a bar chart",
  },
]

const TOC = [
  { id: "error-detail", label: "ErrorDetail" },
  { id: "error-timeline", label: "ErrorTimeline" },
]

function ErrorsDomainPage() {
  return (
    <ShowcasePage
      title="Errors"
      description="Error detail and timeline. 2 components."
      items={TOC}
    >
      <Section
        id="error-detail"
        title="ErrorDetail"
        description="Displays exception class, message, occurrence count, affected sources, and stack trace."
      >
        <div className="glass-card overflow-hidden">
          <ErrorDetail group={errorGroup} onViewRelatedLogs={(_g) => {}} />
        </div>
        <div className="mt-4">
          <PropsTable props={errorDetailProps} />
        </div>
      </Section>

      <Section
        id="error-timeline"
        title="ErrorTimeline"
        description="Bar chart showing error occurrence frequency over time buckets."
      >
        <div className="glass-card p-4">
          <h3 className="mb-3 text-xs font-medium uppercase tracking-wider text-zinc-500">
            Occurrences over time
          </h3>
          <ErrorTimeline occurrences={errorGroup.occurrences} />
        </div>
        <div className="mt-4">
          <PropsTable props={errorTimelineProps} />
        </div>
      </Section>
    </ShowcasePage>
  )
}

export const Route = createFileRoute("/domain/errors")({
  component: ErrorsDomainPage,
})
