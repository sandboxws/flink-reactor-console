/**
 * KafkaSeedDialog — seeds the DSL's sample data into a Kafka instrument.
 *
 * Rendered only when the instrument advertises the `seed` capability (the
 * server resolves the environment policy: dev on, staging opt-in, prod never).
 * The mutation is still guarded server-side, so this dialog is UX, not
 * enforcement.
 *
 * Opening the dialog auto-runs a broker-aware dry-run and renders the
 * per-topic plan: what will be created, what already holds records, what gets
 * skipped. "Skip topics that already have records" is on by default (matching
 * `cluster up`'s idempotent seeding) — appending duplicates is possible but
 * has to be asked for. Confirming runs the exact plan on the same server code
 * path the dry-run used. Domain chips narrow catalog-wide seeding to selected
 * template domains.
 */

import {
  Button,
  Checkbox,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  Label,
} from "@flink-reactor/ui"
import { Sprout } from "lucide-react"
import { useEffect, useRef, useState } from "react"
import {
  type KafkaSeedResult,
  seedKafkaTopics,
} from "@/lib/instruments-data"
import {
  availableDomains,
  confirmLabel,
  domainsArgument,
  filterRowsByDomains,
  nothingToSeed,
  planSummary,
  resultLine,
  rowStatus,
  type SeedRowTone,
} from "./kafka-seed-derive"

interface KafkaSeedDialogProps {
  instrument: string
  /** Called after records are actually produced so the browser can refetch. */
  onSeeded: () => void
}

const STATUS_TONE_CLASS: Record<SeedRowTone, string> = {
  create: "text-fr-mint",
  append: "text-fg-muted",
  skip: "text-fg-faint",
  error: "text-fr-rose",
}

export function KafkaSeedDialog({
  instrument,
  onSeeded,
}: KafkaSeedDialogProps) {
  const [open, setOpen] = useState(false)
  const [allTopics, setAllTopics] = useState(false)
  const [skipNonEmpty, setSkipNonEmpty] = useState(true)
  const [selectedDomains, setSelectedDomains] = useState<string[]>([])
  const [plan, setPlan] = useState<KafkaSeedResult | null>(null)
  const [outcome, setOutcome] = useState<KafkaSeedResult | null>(null)
  const [previewing, setPreviewing] = useState(false)
  const [seeding, setSeeding] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // Monotonic request id so a slow dry-run can't clobber a newer one.
  const requestRef = useRef(0)

  useEffect(() => {
    if (!open) return
    const requestId = ++requestRef.current
    setPreviewing(true)
    setError(null)
    setOutcome(null)
    seedKafkaTopics(instrument, { allTopics, dryRun: true, skipNonEmpty })
      .then((res) => {
        if (requestRef.current === requestId) setPlan(res)
      })
      .catch((e) => {
        if (requestRef.current === requestId) {
          setPlan(null)
          setError(e instanceof Error ? e.message : "Preview failed")
        }
      })
      .finally(() => {
        if (requestRef.current === requestId) setPreviewing(false)
      })
  }, [open, allTopics, skipNonEmpty, instrument])

  function toggleDomain(domain: string) {
    setOutcome(null)
    setSelectedDomains((current) =>
      current.includes(domain)
        ? current.filter((d) => d !== domain)
        : [...current, domain],
    )
  }

  async function runSeed() {
    requestRef.current++ // invalidate any in-flight preview
    setSeeding(true)
    setError(null)
    try {
      const res = await seedKafkaTopics(instrument, {
        allTopics,
        skipNonEmpty,
        domains: domainsArgument(selectedDomains),
      })
      setOutcome(res)
      if (res.recordsProduced > 0) onSeeded()
    } catch (e) {
      setError(e instanceof Error ? e.message : "Seeding failed")
    } finally {
      setSeeding(false)
    }
  }

  const domains = availableDomains(plan?.topics ?? [])
  const planRows = filterRowsByDomains(plan?.topics ?? [], selectedDomains)
  const rows = outcome ? outcome.topics : planRows
  const summary = planSummary(planRows)
  const busy = previewing || seeding

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" className="gap-1.5">
          <Sprout className="size-3.5" />
          Seed data
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Seed sample data</DialogTitle>
          <DialogDescription>
            Produce the DSL's deterministic sample records into this
            instrument's topics. The plan below reflects live broker state —
            what a run would create, top up, or skip.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-2">
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
            <div className="flex items-center gap-2">
              <Checkbox
                id="seed-all-topics"
                checked={allTopics}
                onCheckedChange={(v) => {
                  setSelectedDomains([])
                  setAllTopics(v === true)
                }}
              />
              <Label
                htmlFor="seed-all-topics"
                className="text-[12px] font-normal text-fg-muted"
              >
                Seed entire catalog
              </Label>
            </div>

            <div className="flex items-center gap-2">
              <Checkbox
                id="seed-skip-nonempty"
                checked={skipNonEmpty}
                onCheckedChange={(v) => setSkipNonEmpty(v === true)}
              />
              <Label
                htmlFor="seed-skip-nonempty"
                className="text-[12px] font-normal text-fg-muted"
              >
                Skip topics that already have records
              </Label>
            </div>
          </div>

          {domains.length > 1 ? (
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="font-mono text-[10px] uppercase tracking-wider text-fg-faint">
                Domains
              </span>
              {domains.map((domain) => {
                const active =
                  selectedDomains.length === 0 ||
                  selectedDomains.includes(domain)
                return (
                  <button
                    key={domain}
                    type="button"
                    onClick={() => toggleDomain(domain)}
                    className={`rounded-full border px-2 py-0.5 font-mono text-[10.5px] transition-colors ${
                      active
                        ? "border-dash-border bg-dash-elevated text-fg"
                        : "border-dash-border/50 text-fg-faint hover:text-fg-muted"
                    }`}
                  >
                    {domain}
                  </button>
                )
              })}
            </div>
          ) : null}

          {error ? (
            <p className="text-[11.5px] font-mono text-fr-rose">{error}</p>
          ) : null}

          {previewing && !plan ? (
            <p className="text-[11.5px] text-fg-faint">
              Consulting the broker…
            </p>
          ) : rows.length === 0 && !error ? (
            <p className="text-[11.5px] text-fg-muted">
              No catalog topics in scope — this project's topics have no sample
              data, or the broker is empty. Try "Seed entire catalog".
            </p>
          ) : (
            <div className="max-h-72 overflow-y-auto overflow-x-auto rounded-md border border-dash-border">
              <table className="w-full text-[12px]">
                <thead>
                  <tr className="border-b border-dash-border text-left text-fg-faint">
                    <th className="px-3 py-1.5 font-mono text-[10px] uppercase tracking-wider">
                      Topic
                    </th>
                    <th className="px-3 py-1.5 font-mono text-[10px] uppercase tracking-wider">
                      Domain
                    </th>
                    <th className="px-3 py-1.5 font-mono text-[10px] uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-3 py-1.5 text-right font-mono text-[10px] uppercase tracking-wider">
                      {outcome && !outcome.dryRun ? "Rows added" : "Rows to add"}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-dash-border/40">
                  {rows.map((row) => {
                    const status = rowStatus(row)
                    const dimmed = status.tone === "skip"
                    return (
                      <tr
                        key={row.topic}
                        className={dimmed ? "opacity-60" : undefined}
                      >
                        <td className="px-3 py-1.5 font-mono text-fg">
                          {row.topic}
                        </td>
                        <td className="px-3 py-1.5 font-mono text-fg-faint">
                          {row.domain}
                        </td>
                        <td
                          className={`px-3 py-1.5 font-mono break-all ${STATUS_TONE_CLASS[status.tone]}`}
                        >
                          {status.label}
                        </td>
                        <td className="px-3 py-1.5 text-right font-mono text-fg-muted">
                          {status.tone === "skip" || status.tone === "error"
                            ? "—"
                            : row.recordsProduced.toLocaleString()}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}

          {outcome ? (
            <p className="text-[11.5px] font-mono text-fg-muted">
              {resultLine(outcome)}
            </p>
          ) : null}
        </div>

        <DialogFooter>
          <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>
            Close
          </Button>
          <Button
            size="sm"
            onClick={runSeed}
            disabled={busy || nothingToSeed(summary)}
          >
            {seeding ? "Seeding…" : confirmLabel(summary)}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
