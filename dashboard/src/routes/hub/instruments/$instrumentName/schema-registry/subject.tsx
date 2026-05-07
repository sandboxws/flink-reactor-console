/**
 * Hub Schema subject detail — /hub/instruments/$instrumentName/schema-registry/subject.
 *
 * Reads `?subject=...&v1=...&v2=...` and renders the schema-diff viewer.
 * Default selection is "latest vs previous" (auto-resolved from the
 * versions list when v1/v2 are missing). Picking from the dropdowns
 * pushes an updated URL so the diff is shareable.
 */

import {
  HubBreadcrumb,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@flink-reactor/ui"
import {
  createFileRoute,
  useNavigate,
  useParams,
  useSearch,
} from "@tanstack/react-router"
import { useEffect, useState } from "react"
import { SchemaDiffViewer } from "@/components/hub/tools/diff/schema-diff-viewer"
import { HubAppShell } from "@/lib/hub/hub-app-shell"
import { HubLink } from "@/lib/hub/hub-link"
import { fetchSchemaVersions } from "@/lib/instruments-data"
import { SchemaRegistrySubTabs } from "./index"

interface SchemaSubjectSearch {
  subject?: string
  v1?: number
  v2?: number
}

function HubSchemaSubject() {
  const { instrumentName } = useParams({
    from: "/hub/instruments/$instrumentName/schema-registry/subject",
  })
  const { subject, v1, v2 } = useSearch({
    from: "/hub/instruments/$instrumentName/schema-registry/subject",
  })
  const navigate = useNavigate()

  const [versions, setVersions] = useState<number[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!subject) return
    let cancelled = false
    setVersions(null)
    fetchSchemaVersions(instrumentName, subject)
      .then((list) => {
        if (cancelled) return
        const sorted = [...list].sort((a, b) => a - b)
        setVersions(sorted)
        // Default selection: latest vs previous.
        if ((v1 === undefined || v2 === undefined) && sorted.length >= 1) {
          const latest = sorted[sorted.length - 1]
          const previous =
            sorted.length >= 2 ? sorted[sorted.length - 2] : latest
          navigate({
            to: "/hub/instruments/$instrumentName/schema-registry/subject",
            params: { instrumentName },
            search: { subject, v1: previous, v2: latest },
            replace: true,
          })
        }
      })
      .catch((e) => {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Failed to load versions")
        }
      })
    return () => {
      cancelled = true
    }
  }, [instrumentName, subject, v1, v2, navigate])

  return (
    <HubAppShell>
      <HubBreadcrumb
        crumbs={[
          { label: "Instruments", to: "/hub/instruments" },
          { label: instrumentName, mono: true },
          {
            label: "Schema registry",
            to: "/hub/instruments/$instrumentName/schema-registry".replace(
              "$instrumentName",
              instrumentName,
            ),
          },
          { label: subject ?? "(pick a subject)", mono: true },
        ]}
        LinkComponent={HubLink}
      />
      <SchemaRegistrySubTabs instrument={instrumentName} active="subject" />

      <div className="mt-5">
        {!subject ? (
          <p className="text-[12px] font-mono text-fg-faint">
            Pick a subject from the subjects tab.
          </p>
        ) : error ? (
          <p className="text-[11.5px] text-fr-rose font-mono">{error}</p>
        ) : versions === null ? (
          <p className="text-[11.5px] font-mono text-fg-faint">
            Loading versions…
          </p>
        ) : versions.length === 0 ? (
          <p className="text-[12px] text-fg-muted">
            No versions registered for this subject.
          </p>
        ) : (
          <div className="space-y-4">
            <div className="glass-card-static flex flex-wrap items-end gap-4 p-4">
              <VersionPicker
                label="From (older)"
                versions={versions}
                value={v1}
                onChange={(next) =>
                  navigate({
                    to: "/hub/instruments/$instrumentName/schema-registry/subject",
                    params: { instrumentName },
                    search: { subject, v1: next, v2: v2 ?? next },
                    replace: true,
                  })
                }
              />
              <VersionPicker
                label="To (newer)"
                versions={versions}
                value={v2}
                onChange={(next) =>
                  navigate({
                    to: "/hub/instruments/$instrumentName/schema-registry/subject",
                    params: { instrumentName },
                    search: { subject, v1: v1 ?? next, v2: next },
                    replace: true,
                  })
                }
              />
              <p className="ml-auto font-mono text-[10.5px] text-fg-faint">
                {versions.length} version{versions.length === 1 ? "" : "s"} ·
                latest v{versions[versions.length - 1]}
              </p>
            </div>

            {v1 !== undefined && v2 !== undefined ? (
              <SchemaDiffViewer
                instrument={instrumentName}
                subject={subject}
                versionA={v1}
                versionB={v2}
              />
            ) : null}
          </div>
        )}
      </div>
    </HubAppShell>
  )
}

function VersionPicker({
  label,
  versions,
  value,
  onChange,
}: {
  label: string
  versions: number[]
  value: number | undefined
  onChange: (v: number) => void
}) {
  return (
    <div className="flex flex-col gap-1">
      <label className="font-mono text-[10px] uppercase tracking-wider text-fg-faint">
        {label}
      </label>
      <Select
        value={value !== undefined ? String(value) : undefined}
        onValueChange={(s) => onChange(Number(s))}
      >
        <SelectTrigger className="w-[140px] bg-dash-panel border-dash-border">
          <SelectValue placeholder="Pick version" />
        </SelectTrigger>
        <SelectContent className="bg-dash-panel border-dash-border">
          {versions.map((v) => (
            <SelectItem key={v} value={String(v)}>
              v{v}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}

export const Route = createFileRoute(
  "/hub/instruments/$instrumentName/schema-registry/subject",
)({
  validateSearch: (search: Record<string, unknown>): SchemaSubjectSearch => ({
    subject: typeof search.subject === "string" ? search.subject : undefined,
    v1: typeof search.v1 === "number" ? search.v1 : undefined,
    v2: typeof search.v2 === "number" ? search.v2 : undefined,
  }),
  component: HubSchemaSubject,
})
