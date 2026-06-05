// Lifecycle command descriptors (cli-lifecycle-integration, task 1.2).
//
// A lifecycle command is modeled as `{ verb, pipeline?, env?, flags? }` and
// deterministically printed to the CLI argument vector:
//   Synth scoped to a pipeline in the active env, with synth flags →
//   `synth -p orders --env production -o out --deep-validate`
//
// Pure data + printing — the task provider turns a descriptor into a
// `vscode.Task`; the palette commands and the CodeLens both build descriptors.

/** The wrapped CLI verbs (the v1 palette set — see the change's Non-Goals for
 *  the deliberately unwrapped ones: new/install/generate/cluster/sim/…). */
export const LIFECYCLE_VERBS = [
  "synth",
  "validate",
  "graph",
  "schema",
  "deploy",
  "up",
  "down",
  "status",
  "stop",
  "resume",
  "savepoint",
  "doctor",
  "dev",
] as const

export type LifecycleVerb = (typeof LIFECYCLE_VERBS)[number]

/** Verbs that act on a single pipeline (`-p <name>`); invoking one without a
 *  determined pipeline offers the discovered-pipelines quick pick (task 3.3). */
export const PIPELINE_SCOPED_VERBS: ReadonlySet<LifecycleVerb> = new Set([
  "synth",
  "validate",
  "graph",
  "schema",
  "deploy",
  "stop",
  "resume",
  "savepoint",
])

export interface CommandDescriptor {
  readonly verb: LifecycleVerb
  /** Pipeline name → `-p <pipeline>`. */
  readonly pipeline?: string
  /** Environment → `--env <env>` (the active environment unless overridden). */
  readonly env?: string
  /** Extra verb-specific flags, appended verbatim (e.g. `-o out`). */
  readonly flags?: readonly string[]
}

/** Print the descriptor's `flink-reactor` argument vector. */
export function buildArgs(descriptor: CommandDescriptor): string[] {
  const args: string[] = [descriptor.verb]
  if (descriptor.pipeline) args.push("-p", descriptor.pipeline)
  if (descriptor.env) args.push("--env", descriptor.env)
  if (descriptor.flags) args.push(...descriptor.flags)
  return args
}

/** A stable identity for task reuse (task 1.3): one terminal per
 *  verb + pipeline + env rather than an ad-hoc terminal per invocation. */
export function descriptorIdentity(descriptor: CommandDescriptor): string {
  return [
    descriptor.verb,
    descriptor.pipeline ?? "",
    descriptor.env ?? "",
  ].join("|")
}
