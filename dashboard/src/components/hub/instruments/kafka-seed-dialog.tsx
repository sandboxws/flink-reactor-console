/**
 * KafkaSeedDialog — manually (re-)seeds the DSL's sample data into a Kafka
 * instrument.
 *
 * Rendered only when the instrument advertises the `seed` capability (the
 * server resolves the environment policy: dev on, staging opt-in, prod never).
 * The mutation is still guarded server-side, so this dialog is UX, not
 * enforcement.
 *
 * `cluster up` already seeds this project's declared topics automatically, so
 * this is a manual re-seed / top-up. By default it re-seeds the project's
 * topics (those already present in the broker); "Seed entire catalog" widens to
 * every sample topic, creating each one. Records are appended, so re-running
 * duplicates them — hence the dry-run preview.
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
import { useState } from "react"
import { type KafkaSeedResult, seedKafkaTopics } from "@/lib/instruments-data"

interface KafkaSeedDialogProps {
  instrument: string
  /** Called after records are actually produced so the browser can refetch. */
  onSeeded: () => void
}

export function KafkaSeedDialog({
  instrument,
  onSeeded,
}: KafkaSeedDialogProps) {
  const [open, setOpen] = useState(false)
  const [allTopics, setAllTopics] = useState(false)
  const [dryRun, setDryRun] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<KafkaSeedResult | null>(null)

  async function runSeed() {
    setBusy(true)
    setError(null)
    setResult(null)
    try {
      const res = await seedKafkaTopics(instrument, allTopics, dryRun)
      setResult(res)
      if (!res.dryRun && res.recordsProduced > 0) onSeeded()
    } catch (e) {
      setError(e instanceof Error ? e.message : "Seeding failed")
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" className="gap-1.5">
          <Sprout className="size-3.5" />
          Seed data
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Seed sample data</DialogTitle>
          <DialogDescription>
            Produce the DSL's sample records into this instrument's topics.
            cluster up already seeds your project's topics — use this to re-seed
            them, or to seed the entire sample catalog. Records are appended, so
            re-running duplicates them. Use a dry run to preview.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="flex items-center gap-2">
            <Checkbox
              id="seed-all-topics"
              checked={allTopics}
              onCheckedChange={(v) => setAllTopics(v === true)}
            />
            <Label
              htmlFor="seed-all-topics"
              className="text-[12px] font-normal text-fg-muted"
            >
              Seed entire catalog (create every sample topic, not just this
              project's)
            </Label>
          </div>

          <div className="flex items-center gap-2">
            <Checkbox
              id="seed-dry-run"
              checked={dryRun}
              onCheckedChange={(v) => setDryRun(v === true)}
            />
            <Label
              htmlFor="seed-dry-run"
              className="text-[12px] font-normal text-fg-muted"
            >
              Dry run (preview without producing)
            </Label>
          </div>

          {error ? (
            <p className="text-[11.5px] font-mono text-fr-rose">{error}</p>
          ) : null}

          {result ? (
            <div className="rounded-md border border-dash-border bg-dash-surface px-3 py-2 text-[11.5px] font-mono text-fg-muted">
              {result.dryRun ? "Would seed " : "Seeded "}
              {result.recordsProduced.toLocaleString()} record
              {result.recordsProduced === 1 ? "" : "s"} across{" "}
              {result.topics.length} topic
              {result.topics.length === 1 ? "" : "s"}
              {result.skipped.length > 0
                ? ` · ${result.skipped.length} skipped`
                : ""}
              .
            </div>
          ) : null}
        </div>

        <DialogFooter>
          <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>
            Close
          </Button>
          <Button size="sm" onClick={runSeed} disabled={busy}>
            {busy ? "Seeding…" : dryRun ? "Preview" : "Seed"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
