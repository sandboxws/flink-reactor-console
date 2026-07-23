/**
 * Hub-styled submit-JAR form.
 *
 * Two stages: upload (drag-or-pick a `.jar` file) and configure (entry class
 * / parallelism slider / args / savepoint). On submit we call the existing
 * `runJar` mutation; on success the page redirects to the new job's detail
 * route. Errors stay inline.
 */

import type { UploadedJar } from "@flink-reactor/ui"
import { Loader2, Upload } from "lucide-react"
import { useState } from "react"
import { runJar, uploadJar } from "@/lib/graphql-api-client"
import { parseProgramArgs } from "@/lib/program-args"

interface SubmitJarFormProps {
  onSubmitted: (jobId: string) => void
}

export function SubmitJarForm({ onSubmitted }: SubmitJarFormProps) {
  const [file, setFile] = useState<File | null>(null)
  const [jar, setJar] = useState<UploadedJar | null>(null)
  const [entryClass, setEntryClass] = useState("")
  const [parallelism, setParallelism] = useState(1)
  const [programArgs, setProgramArgs] = useState("")
  const [savepointPath, setSavepointPath] = useState("")
  const [allowNonRestoredState, setAllowNonRestoredState] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleUpload() {
    if (!file) return
    setUploading(true)
    setError(null)
    try {
      const list = await uploadJar(file)
      const latest =
        list.find((j) => j.name === file.name) ?? list[list.length - 1]
      if (!latest) throw new Error("Upload completed but no JAR returned")
      setJar(latest)
      if (latest.entryClass) setEntryClass(latest.entryClass)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed")
    } finally {
      setUploading(false)
    }
  }

  async function handleRun() {
    if (!jar) return
    setSubmitting(true)
    setError(null)
    try {
      await runJar(jar.id, {
        entryClass: entryClass || undefined,
        parallelism,
        programArgsList: parseProgramArgs(programArgs),
        savepointPath: savepointPath || undefined,
        allowNonRestoredState,
      })
      onSubmitted(jar.id)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Submit failed")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        if (!jar) handleUpload()
        else handleRun()
      }}
      className="space-y-5"
    >
      {/* Upload step */}
      <section className="glass-card-static p-5">
        <div className="flex items-center justify-between mb-3">
          <h3 className="section-heading">JAR file</h3>
          {jar ? (
            <span className="font-mono text-[10px] text-fr-sage">UPLOADED</span>
          ) : null}
        </div>
        <div className="flex items-center gap-3">
          <input
            id="jar-input"
            type="file"
            accept=".jar"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            className="form-input mono flex-1"
            style={{ height: 32, fontSize: 12 }}
          />
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            disabled={!file || uploading}
            onClick={handleUpload}
          >
            {uploading ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <Upload />
            )}
            {uploading ? "Uploading…" : "Upload"}
          </button>
        </div>
        {jar ? (
          <p className="mt-2 text-[11px] font-mono text-fg-muted">
            {jar.name} · {jar.id.slice(0, 16)}
          </p>
        ) : null}
      </section>

      {/* Configure step */}
      <fieldset
        className={`space-y-4 ${jar ? "" : "opacity-60 pointer-events-none"}`}
        disabled={!jar}
      >
        <section className="glass-card-static p-5">
          <h3 className="section-heading mb-3">Run configuration</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label
                htmlFor="entry-class"
                className="block text-[11px] font-mono uppercase tracking-wider text-fg-faint mb-1"
              >
                Entry class
              </label>
              <input
                id="entry-class"
                type="text"
                value={entryClass}
                onChange={(e) => setEntryClass(e.target.value)}
                placeholder="com.example.Main"
                className="form-input mono w-full"
                style={{ height: 32, fontSize: 12 }}
              />
            </div>
            <div>
              <label
                htmlFor="parallelism"
                className="block text-[11px] font-mono uppercase tracking-wider text-fg-faint mb-1"
              >
                Parallelism · {parallelism}
              </label>
              <input
                id="parallelism"
                type="range"
                min={1}
                max={32}
                step={1}
                value={parallelism}
                onChange={(e) => setParallelism(Number(e.target.value))}
                className="w-full"
              />
            </div>
            <div className="md:col-span-2">
              <label
                htmlFor="program-args"
                className="block text-[11px] font-mono uppercase tracking-wider text-fg-faint mb-1"
              >
                Program args{" "}
                <span className="text-fg-faint/70 normal-case">
                  · one per line
                </span>
              </label>
              <textarea
                id="program-args"
                value={programArgs}
                onChange={(e) => setProgramArgs(e.target.value)}
                rows={4}
                className="form-input mono w-full"
                style={{ fontSize: 12 }}
                placeholder={
                  "--input\ns3://bucket/in\n--query\nSELECT * FROM t"
                }
              />
            </div>
          </div>
        </section>

        <section className="glass-card-static p-5">
          <h3 className="section-heading mb-3">Savepoint restore</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label
                htmlFor="savepoint-path"
                className="block text-[11px] font-mono uppercase tracking-wider text-fg-faint mb-1"
              >
                Path (optional)
              </label>
              <input
                id="savepoint-path"
                type="text"
                value={savepointPath}
                onChange={(e) => setSavepointPath(e.target.value)}
                placeholder="s3://bucket/savepoints/sp-123"
                className="form-input mono w-full"
                style={{ height: 32, fontSize: 12 }}
              />
            </div>
            <label className="flex items-center gap-2 text-[12px] text-fg-muted self-end">
              <input
                type="checkbox"
                checked={allowNonRestoredState}
                onChange={(e) => setAllowNonRestoredState(e.target.checked)}
              />
              Allow non-restored state
            </label>
          </div>
        </section>

        <div className="flex justify-end">
          <button
            type="submit"
            className="btn btn-primary"
            disabled={submitting}
          >
            {submitting ? <Loader2 className="size-3.5 animate-spin" /> : null}
            {submitting ? "Submitting…" : "Submit pipeline"}
          </button>
        </div>
      </fieldset>

      {error ? (
        <div className="glass-card-static p-3 text-[12px] text-fr-coral">
          {error}
        </div>
      ) : null}
    </form>
  )
}
