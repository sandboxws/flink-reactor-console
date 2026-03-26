/**
 * @module submit-job-page
 *
 * Two-panel page for submitting Flink jobs from uploaded JARs. The left panel
 * manages JAR uploads and selection; the right panel exposes submission parameters
 * (entry class, parallelism, program args, savepoint restore) for the selected JAR.
 *
 * Respects the `web.submit.enable` feature flag — when disabled, the form
 * renders a warning banner and the submit button is inactive.
 *
 * Subscribes to {@link useClusterStore} for JAR CRUD and job submission actions.
 */
import { Spinner } from "@flink-reactor/ui"
import { format } from "date-fns"
import {
  AlertCircle,
  Check,
  FileCode,
  Package,
  Play,
  Trash2,
  Upload,
} from "lucide-react"
import { useCallback, useRef, useState } from "react"
import type { SubmitJobRequest, UploadedJar } from "@flink-reactor/ui"
import { cn } from "@/lib/cn"
import { useClusterStore } from "@/stores/cluster-store"

// ---------------------------------------------------------------------------
// JarListSection — uploaded JARs with upload + delete
// ---------------------------------------------------------------------------

/**
 * Left panel listing uploaded JARs with upload and delete actions.
 * Selecting a JAR highlights it and triggers the submission form
 * in the adjacent panel.
 */
function JarListSection({
  jars,
  selectedJarId,
  onSelect,
  onUpload,
  onDelete,
  uploading,
}: {
  /** Available {@link UploadedJar} entries from the cluster. */
  jars: UploadedJar[]
  /** Currently selected JAR ID, or null if none. */
  selectedJarId: string | null
  /** Called when a JAR row is clicked. */
  onSelect: (id: string) => void
  /** Called with the chosen file when the upload button is used. */
  onUpload: (file: File) => void
  /** Called when a JAR's delete button is clicked. */
  onDelete: (id: string) => void
  /** Whether a JAR upload is currently in progress. */
  uploading: boolean
}) {
  const fileRef = useRef<HTMLInputElement>(null)

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      if (file) onUpload(file)
      // Reset so re-selecting the same file triggers onChange
      e.target.value = ""
    },
    [onUpload],
  )

  return (
    <div className="glass-card overflow-hidden">
      <div className="flex items-center gap-2 border-b border-dash-border px-4 py-3">
        <Package className="size-3.5 text-zinc-500" />
        <h2 className="text-xs font-medium uppercase tracking-wide text-zinc-500">
          Uploaded JARs
        </h2>
        <span className="ml-auto font-mono text-[10px] text-zinc-600">
          {jars.length} {jars.length === 1 ? "file" : "files"}
        </span>
      </div>

      {/* Upload button */}
      <div className="border-b border-dash-border/50 px-4 py-3">
        <input
          ref={fileRef}
          type="file"
          accept=".jar"
          className="hidden"
          onChange={handleFileChange}
        />
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
          className="flex items-center gap-2 rounded-md bg-fr-coral/10 px-3 py-1.5 text-xs font-medium text-fr-coral transition-colors hover:bg-fr-coral/20 disabled:opacity-50"
        >
          {uploading ? (
            <Spinner size="sm" />
          ) : (
            <Upload className="size-3.5" />
          )}
          {uploading ? "Uploading…" : "Upload JAR"}
        </button>
      </div>

      {/* JAR list */}
      {jars.length === 0 ? (
        <div className="px-4 py-8 text-center text-xs text-zinc-500">
          No JARs uploaded. Upload a JAR to submit a job.
        </div>
      ) : (
        <div className="divide-y divide-dash-border/50">
          {jars.map((jar) => (
            <div
              key={jar.id}
              className={cn(
                "flex items-center gap-3 px-4 py-3 transition-colors cursor-pointer",
                selectedJarId === jar.id
                  ? "bg-fr-coral/5 border-l-2 border-fr-coral"
                  : "hover:bg-dash-hover border-l-2 border-transparent",
              )}
              onClick={() => onSelect(jar.id)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") onSelect(jar.id)
              }}
              role="button"
              tabIndex={0}
            >
              <FileCode className="size-4 shrink-0 text-zinc-500" />
              <div className="min-w-0 flex-1">
                <p className="truncate font-mono text-xs text-zinc-200">
                  {jar.name}
                </p>
                <p className="mt-0.5 text-[10px] text-zinc-500">
                  Uploaded {format(jar.uploadTime, "yyyy-MM-dd HH:mm:ss")}
                  {jar.entryClasses.length > 0 && (
                    <span className="ml-2">
                      · {jar.entryClasses.length} entry{" "}
                      {jar.entryClasses.length === 1 ? "class" : "classes"}
                    </span>
                  )}
                </p>
              </div>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  onDelete(jar.id)
                }}
                className="rounded-md p-1 text-zinc-600 transition-colors hover:bg-job-failed/10 hover:text-job-failed"
                title="Delete JAR"
              >
                <Trash2 className="size-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// SubmitForm — job submission parameters
// ---------------------------------------------------------------------------

/**
 * Right panel form for configuring and submitting a job from the selected JAR.
 * Exposes entry class selection (dropdown when multiple exist), parallelism,
 * program arguments, optional savepoint restore path, and the
 * allow-non-restored-state toggle.
 */
function SubmitForm({
  jar,
  onSubmit,
  submitting,
}: {
  /** The selected {@link UploadedJar} whose entry classes populate the form. */
  jar: UploadedJar
  /** Called with the assembled {@link SubmitJobRequest} on form submission. */
  onSubmit: (request: SubmitJobRequest) => void
  /** Disables the submit button while a submission is in flight. */
  submitting: boolean
}) {
  const [entryClass, setEntryClass] = useState(jar.entryClasses[0] ?? "")
  const [parallelism, setParallelism] = useState(1)
  const [programArgs, setProgramArgs] = useState("")
  const [savepointPath, setSavepointPath] = useState("")
  const [allowNonRestoredState, setAllowNonRestoredState] = useState(false)

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault()
      onSubmit({
        jarId: jar.id,
        entryClass,
        parallelism,
        programArgs,
        savepointPath: savepointPath || null,
        allowNonRestoredState,
      })
    },
    [
      jar.id,
      entryClass,
      parallelism,
      programArgs,
      savepointPath,
      allowNonRestoredState,
      onSubmit,
    ],
  )

  return (
    <div className="glass-card p-4">
      <h2 className="mb-4 text-xs font-medium uppercase tracking-wide text-zinc-500">
        Submit Job — {jar.name}
      </h2>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        {/* Entry Class */}
        <div className="flex flex-col gap-1.5">
          <label className="text-[10px] font-medium uppercase tracking-wide text-zinc-500">
            Entry Class
          </label>
          {jar.entryClasses.length > 1 ? (
            <select
              value={entryClass}
              onChange={(e) => setEntryClass(e.target.value)}
              className="rounded-md border border-dash-border bg-dash-panel px-3 py-1.5 font-mono text-xs text-zinc-200 outline-none focus:border-fr-coral"
            >
              {jar.entryClasses.map((ec) => (
                <option key={ec} value={ec}>
                  {ec}
                </option>
              ))}
            </select>
          ) : (
            <input
              type="text"
              value={entryClass}
              onChange={(e) => setEntryClass(e.target.value)}
              placeholder="com.example.MyJob"
              className="rounded-md border border-dash-border bg-dash-panel px-3 py-1.5 font-mono text-xs text-zinc-200 placeholder:text-zinc-600 outline-none focus:border-fr-coral"
            />
          )}
        </div>

        {/* Parallelism */}
        <div className="flex flex-col gap-1.5">
          <label className="text-[10px] font-medium uppercase tracking-wide text-zinc-500">
            Parallelism
          </label>
          <input
            type="number"
            min={1}
            max={256}
            value={parallelism}
            onChange={(e) => setParallelism(Number(e.target.value))}
            className="w-24 rounded-md border border-dash-border bg-dash-panel px-3 py-1.5 font-mono text-xs text-zinc-200 outline-none focus:border-fr-coral"
          />
        </div>

        {/* Program Arguments */}
        <div className="flex flex-col gap-1.5">
          <label className="text-[10px] font-medium uppercase tracking-wide text-zinc-500">
            Program Arguments
          </label>
          <input
            type="text"
            value={programArgs}
            onChange={(e) => setProgramArgs(e.target.value)}
            placeholder="--key value --flag"
            className="rounded-md border border-dash-border bg-dash-panel px-3 py-1.5 font-mono text-xs text-zinc-200 placeholder:text-zinc-600 outline-none focus:border-fr-coral"
          />
        </div>

        {/* Savepoint Path */}
        <div className="flex flex-col gap-1.5">
          <label className="text-[10px] font-medium uppercase tracking-wide text-zinc-500">
            Savepoint Path (optional)
          </label>
          <input
            type="text"
            value={savepointPath}
            onChange={(e) => setSavepointPath(e.target.value)}
            placeholder="s3://bucket/savepoint-..."
            className="rounded-md border border-dash-border bg-dash-panel px-3 py-1.5 font-mono text-xs text-zinc-200 placeholder:text-zinc-600 outline-none focus:border-fr-coral"
          />
        </div>

        {/* Allow Non-Restored State */}
        <label className="flex items-center gap-2 text-xs text-zinc-300">
          <input
            type="checkbox"
            checked={allowNonRestoredState}
            onChange={(e) => setAllowNonRestoredState(e.target.checked)}
            className="rounded border-dash-border"
          />
          Allow non-restored state
        </label>

        {/* Submit Button */}
        <button
          type="submit"
          disabled={submitting || !entryClass}
          className="flex w-fit items-center gap-2 rounded-md bg-job-running/15 px-4 py-2 text-xs font-medium text-job-running transition-colors hover:bg-job-running/25 disabled:opacity-50"
        >
          {submitting ? (
            <Spinner size="sm" />
          ) : (
            <Play className="size-3.5" />
          )}
          {submitting ? "Submitting…" : "Submit Job"}
        </button>
      </form>
    </div>
  )
}

// ---------------------------------------------------------------------------
// SubmitJobPage — main page component
// ---------------------------------------------------------------------------

/**
 * Top-level page component for the "Submit New Job" route.
 *
 * Orchestrates JAR management (upload, select, delete) and job submission.
 * Displays feedback banners for success, errors, and the feature-flag
 * disabled state. Layout is a responsive two-column grid: JAR list on the
 * left, submission form on the right.
 */
export function SubmitJobPage() {
  const uploadedJars = useClusterStore((s) => s.uploadedJars)
  const uploadJar = useClusterStore((s) => s.uploadJar)
  const deleteJar = useClusterStore((s) => s.deleteJar)
  const submitJob = useClusterStore((s) => s.submitJob)
  const featureFlags = useClusterStore((s) => s.featureFlags)
  const fetchError = useClusterStore((s) => s.fetchError)

  const [selectedJarId, setSelectedJarId] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [submitSuccess, setSubmitSuccess] = useState(false)

  const selectedJar = uploadedJars.find((j) => j.id === selectedJarId) ?? null

  const handleUpload = useCallback(
    async (file: File) => {
      setUploading(true)
      await uploadJar(file)
      setUploading(false)
    },
    [uploadJar],
  )

  const handleDelete = useCallback(
    async (jarId: string) => {
      if (selectedJarId === jarId) setSelectedJarId(null)
      await deleteJar(jarId)
    },
    [deleteJar, selectedJarId],
  )

  const handleSubmit = useCallback(
    async (request: SubmitJobRequest) => {
      setSubmitting(true)
      await submitJob(request)
      setSubmitting(false)
      setSubmitSuccess(true)
      setTimeout(() => setSubmitSuccess(false), 3000)
    },
    [submitJob],
  )

  const submitDisabled = featureFlags?.webSubmit === false

  return (
    <div className="flex flex-col gap-4 p-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold text-zinc-100">Submit New Job</h1>
      </div>

      {/* Feature flag warning */}
      {submitDisabled && (
        <div className="flex items-center gap-2 rounded-md bg-fr-amber/10 px-4 py-3 text-xs text-fr-amber">
          <AlertCircle className="size-4 shrink-0" />
          Job submission is disabled on this cluster (web.submit.enable =
          false).
        </div>
      )}

      {/* Submit success feedback */}
      {submitSuccess && (
        <div className="flex items-center gap-2 rounded-md bg-job-running/10 px-4 py-3 text-xs text-job-running">
          <Check className="size-4 shrink-0" />
          Job submitted successfully. Check the Running Jobs page.
        </div>
      )}

      {/* Error feedback */}
      {fetchError && (
        <div className="flex items-center gap-2 rounded-md bg-job-failed/10 px-4 py-3 text-xs text-job-failed">
          <AlertCircle className="size-4 shrink-0" />
          {fetchError}
        </div>
      )}

      {/* Two-column layout */}
      <div className="grid gap-4 lg:grid-cols-2">
        {/* Left: JAR list */}
        <JarListSection
          jars={uploadedJars}
          selectedJarId={selectedJarId}
          onSelect={setSelectedJarId}
          onUpload={handleUpload}
          onDelete={handleDelete}
          uploading={uploading}
        />

        {/* Right: Submit form (only when a JAR is selected) */}
        {selectedJar ? (
          <SubmitForm
            jar={selectedJar}
            onSubmit={handleSubmit}
            submitting={submitting || submitDisabled}
          />
        ) : (
          <div className="glass-card flex items-center justify-center p-8">
            <p className="text-xs text-zinc-500">
              Select a JAR from the list to configure and submit a job.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
