import { mkdirSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import type { Command } from "commander"
import { Effect } from "effect"
import pc from "picocolors"
import { resolveConsoleUrl } from "@/cli/console-url.js"
import { loadPipeline, resolveProjectContext } from "@/cli/discovery.js"
import { runCommand } from "@/cli/effect-runner.js"
import {
  emitJson,
  JSON_FORMAT_VERSION,
  jsonToolInfo,
  type SynthArtifactFileJson,
  type SynthJsonOutput,
  type SynthPipelineJson,
  serializeSynthError,
} from "@/cli/json-output.js"
import { pushTapManifest } from "@/cli/tap-push.js"
import { generateCrd, toYaml } from "@/codegen/crd-generator.js"
import {
  generateSql,
  generateTapManifest,
} from "@/codegen/sql/sql-generator.js"
import { type PipelineArtifact, synthesizeApp } from "@/core/app.js"
import { DiscoveryError, type FileSystemError } from "@/core/errors.js"
import { generatePipelineManifest } from "@/core/manifest.js"
import { FrFileSystem } from "@/core/services.js"

export function registerSynthCommand(program: Command): void {
  program
    .command("synth")
    .description("Synthesize pipelines to Flink SQL and CRDs")
    .option("-p, --pipeline <name>", "Synthesize a specific pipeline")
    .option(
      "-f, --file <path>",
      "Synthesize a specific .tsx file or directory (bypasses pipelines/ convention)",
    )
    .option("-e, --env <name>", "Environment name (loads env/<name>.ts)")
    .option("-o, --outdir <dir>", "Output directory", "dist")
    .option(
      "--deep-validate",
      "Submit EXPLAIN to a running Flink cluster for semantic validation",
    )
    .option(
      "--console-url <url>",
      "Push tap manifests to reactor-console at this URL",
    )
    .option(
      "--json",
      "Emit a machine-readable JSON report to stdout (suppresses human output; artifacts are still written; SQL-verifier diagnostics do not fail the command)",
    )
    .option(
      "--no-redact-metadata",
      "Keep raw connector credentials in display metadata (the CRD-embedded SQL copy); executable artifacts always keep raw values",
    )
    .action(
      async (opts: {
        pipeline?: string
        file?: string
        env?: string
        outdir: string
        deepValidate?: boolean
        consoleUrl?: string
        json?: boolean
        redactMetadata: boolean
      }) => {
        if (opts.json) {
          await runCommand(runSynthJsonEffect(opts))
        } else {
          await runCommand(runSynthEffect(opts))
        }
      },
    )
}

interface SynthOptions {
  pipeline?: string
  file?: string
  env?: string
  outdir: string
  projectDir?: string
  consoleUrl?: string
  /** Commander's `--no-redact-metadata` lands here; defaults to true. */
  redactMetadata?: boolean
}

// ── Imperative variant (used by dev command's internal calls) ───────

export async function runSynth(
  opts: SynthOptions,
): Promise<PipelineArtifact[]> {
  const projectDir = opts.projectDir ?? process.cwd()
  const ctx = await resolveProjectContext(projectDir, {
    pipeline: opts.pipeline,
    file: opts.file,
    env: opts.env,
  })

  if (ctx.pipelines.length === 0) {
    console.log(pc.yellow("No pipelines found in pipelines/ directory."))
    return []
  }

  console.log(pc.dim(`Synthesizing ${ctx.pipelines.length} pipeline(s)...\n`))

  const allArtifacts: PipelineArtifact[] = []
  const synthesizedAt = new Date().toISOString()

  for (const discovered of ctx.pipelines) {
    const pipelineNode = await loadPipeline(discovered.entryPoint, projectDir)

    const result = synthesizeApp(
      {
        name: discovered.name,
        children: pipelineNode,
      },
      {
        env: ctx.env ?? undefined,
        config: ctx.config ?? undefined,
        resolvedConfig: ctx.resolvedConfig ?? undefined,
        synthesizedAt,
        crdOptions: { redactSourceSql: opts.redactMetadata ?? true },
      },
    )

    for (const artifact of result.pipelines) {
      allArtifacts.push(artifact)
      writePipelineOutput(artifact, opts.outdir, projectDir)
    }

    // If no pipelines were extracted (the node itself is the pipeline),
    // treat the whole tree as a single pipeline.
    if (result.pipelines.length === 0) {
      const { generateSql, generateTapManifest } = await import(
        "@/codegen/sql/sql-generator.js"
      )
      const { generateCrd } = await import("@/codegen/crd-generator.js")

      const flinkVersion = ctx.config?.flink?.version ?? "2.3"
      const sql = generateSql(pipelineNode, { flinkVersion })
      const crd = generateCrd(pipelineNode, { flinkVersion })
      const { manifest: tapManifest } = generateTapManifest(pipelineNode, {
        flinkVersion,
        devMode: true,
        synthesizedAt,
      })

      const pipelineManifest = generatePipelineManifest(pipelineNode, {
        synthesizedAt,
      })

      const { generatePipelineYaml } = await import(
        "@/codegen/pipeline-yaml-generator.js"
      )
      const { buildPipelineYamlConfigMap } = await import(
        "@/codegen/secondary-resources.js"
      )
      const pipelineYaml = generatePipelineYaml(pipelineNode)
      const secondaryResources =
        pipelineYaml != null
          ? [buildPipelineYamlConfigMap(discovered.name, pipelineYaml)]
          : []

      const artifact: PipelineArtifact = {
        name: discovered.name,
        sql,
        crd,
        tapManifest,
        pipelineManifest,
        pipelineYaml,
        secondaryResources,
      }

      allArtifacts.push(artifact)
      writePipelineOutput(artifact, opts.outdir, projectDir)
    }
  }

  console.log(
    pc.green(
      `\nSynthesis complete. ${allArtifacts.length} pipeline(s) written.\n`,
    ),
  )

  for (const artifact of allArtifacts) {
    const stmtCount = artifact.sql.statements.length
    console.log(
      `  ${pc.cyan(artifact.name)} ${pc.dim(`(${stmtCount} statement${stmtCount !== 1 ? "s" : ""})`)} ${pc.dim(`→ ${opts.outdir}/${artifact.name}/`)}`,
    )
  }

  console.log("")

  // Push tap manifests to console if URL is available
  const targetUrl = resolveConsoleUrl({
    consoleUrl: opts.consoleUrl,
    resolvedConfig: ctx.resolvedConfig ?? undefined,
  })
  if (targetUrl) {
    for (const artifact of allArtifacts) {
      if (artifact.tapManifest) {
        await pushTapManifest(artifact.tapManifest, targetUrl)
      }
    }
  }

  return allArtifacts
}

function writePipelineOutput(
  artifact: PipelineArtifact,
  outdir: string,
  projectDir: string,
): SynthArtifactFileJson[] {
  const files: SynthArtifactFileJson[] = []
  const pipelineDir = join(projectDir, outdir, artifact.name)
  mkdirSync(pipelineDir, { recursive: true })

  const sqlPath = join(pipelineDir, "pipeline.sql")
  writeFileSync(sqlPath, artifact.sql.sql, "utf-8")
  files.push({ kind: "sql", path: sqlPath })

  const crdYaml = toYaml(artifact.crd)
  const deploymentPath = join(pipelineDir, "deployment.yaml")
  writeFileSync(deploymentPath, crdYaml, "utf-8")
  files.push({ kind: "deployment", path: deploymentPath })

  // Flink CDC Pipeline Connector pipelines have a pipeline.yaml artifact
  // and their ConfigMap wraps that YAML, not the SQL. Regular Flink SQL
  // pipelines keep the historical SQL ConfigMap shape.
  if (artifact.pipelineYaml != null) {
    const pipelineYamlPath = join(pipelineDir, "pipeline.yaml")
    writeFileSync(pipelineYamlPath, artifact.pipelineYaml, "utf-8")
    files.push({ kind: "pipeline-yaml", path: pipelineYamlPath })
    for (const res of artifact.secondaryResources) {
      const resPath = join(pipelineDir, `${res.kind.toLowerCase()}.yaml`)
      writeFileSync(resPath, toYaml(res), "utf-8")
      files.push({ kind: "secondary-resource", path: resPath })
    }
  } else {
    const configMap = buildConfigMapYaml(artifact)
    const configMapPath = join(pipelineDir, "configmap.yaml")
    writeFileSync(configMapPath, configMap, "utf-8")
    files.push({ kind: "configmap", path: configMapPath })
  }

  if (artifact.tapManifest) {
    const outdirPath = join(projectDir, outdir)
    mkdirSync(outdirPath, { recursive: true })
    const tapPath = join(outdirPath, `${artifact.name}.tap-manifest.json`)
    writeFileSync(
      tapPath,
      JSON.stringify(artifact.tapManifest, null, 2),
      "utf-8",
    )
    files.push({ kind: "tap-manifest", path: tapPath })
  }

  return files
}

function buildConfigMapYaml(artifact: PipelineArtifact): string {
  const configMapObj = {
    apiVersion: "v1",
    kind: "ConfigMap",
    metadata: {
      name: `${artifact.name}-sql`,
    },
    data: {
      "pipeline.sql": artifact.sql.sql,
    },
  }

  return toYaml(configMapObj)
}

// ── Effect variant ──────────────────────────────────────────────────

interface SynthRunOutcome {
  readonly artifacts: readonly PipelineArtifact[]
  readonly rows: readonly SynthPipelineJson[]
  /** Non-fatal warnings (tap-manifest push failures). */
  readonly warnings: readonly string[]
}

/**
 * Discovery + synthesis + artifact writing, shared by the human and JSON
 * output paths. In quiet mode nothing is printed and tap-push failures
 * are collected into `warnings` instead.
 */
function synthesizeAndWrite(
  opts: SynthOptions,
  quiet: boolean,
): Effect.Effect<
  SynthRunOutcome,
  DiscoveryError | FileSystemError,
  FrFileSystem
> {
  return Effect.gen(function* () {
    const fs = yield* FrFileSystem
    const projectDir = opts.projectDir ?? process.cwd()

    const ctx = yield* Effect.tryPromise({
      try: () =>
        resolveProjectContext(projectDir, {
          pipeline: opts.pipeline,
          file: opts.file,
          env: opts.env,
        }),
      catch: (err) =>
        new DiscoveryError({
          reason: "config_not_found",
          message: (err as Error).message,
          path: projectDir,
        }),
    })

    if (ctx.pipelines.length === 0) {
      if (!quiet) {
        yield* Effect.sync(() =>
          console.log(pc.yellow("No pipelines found in pipelines/ directory.")),
        )
      }
      return { artifacts: [], rows: [], warnings: [] }
    }

    if (!quiet) {
      yield* Effect.sync(() =>
        console.log(
          pc.dim(`Synthesizing ${ctx.pipelines.length} pipeline(s)...\n`),
        ),
      )
    }

    const allArtifacts: PipelineArtifact[] = []
    const rows: SynthPipelineJson[] = []
    const warnings: string[] = []
    const synthesizedAt = new Date().toISOString()

    for (const discovered of ctx.pipelines) {
      const pipelineNode = yield* Effect.tryPromise({
        try: () => loadPipeline(discovered.entryPoint, projectDir),
        catch: (err) =>
          new DiscoveryError({
            reason: "import_failure",
            message: (err as Error).message,
            path: discovered.entryPoint,
          }),
      })

      const result = synthesizeApp(
        {
          name: discovered.name,
          children: pipelineNode,
        },
        {
          env: ctx.env ?? undefined,
          config: ctx.config ?? undefined,
          resolvedConfig: ctx.resolvedConfig ?? undefined,
          synthesizedAt,
          crdOptions: { redactSourceSql: opts.redactMetadata ?? true },
        },
      )

      for (const artifact of result.pipelines) {
        allArtifacts.push(artifact)
        const files = yield* writePipelineOutputEffect(
          artifact,
          opts.outdir,
          projectDir,
          fs,
        )
        rows.push(buildSynthRow(artifact, files))
      }

      // Fallback: treat whole tree as single pipeline
      if (result.pipelines.length === 0) {
        const flinkVersion = ctx.config?.flink?.version ?? "2.3"
        const sql = generateSql(pipelineNode, { flinkVersion })
        const crd = generateCrd(pipelineNode, { flinkVersion })
        const { manifest: tapManifest } = generateTapManifest(pipelineNode, {
          flinkVersion,
          devMode: true,
          synthesizedAt,
        })

        const pipelineManifest = generatePipelineManifest(pipelineNode, {
          synthesizedAt,
        })
        const { generatePipelineYaml } = yield* Effect.promise(
          () => import("@/codegen/pipeline-yaml-generator.js"),
        )
        const { buildPipelineYamlConfigMap } = yield* Effect.promise(
          () => import("@/codegen/secondary-resources.js"),
        )
        const pipelineYaml = generatePipelineYaml(pipelineNode)
        const secondaryResources =
          pipelineYaml != null
            ? [buildPipelineYamlConfigMap(discovered.name, pipelineYaml)]
            : []

        const artifact: PipelineArtifact = {
          name: discovered.name,
          sql,
          crd,
          tapManifest,
          pipelineManifest,
          pipelineYaml,
          secondaryResources,
        }

        allArtifacts.push(artifact)
        const files = yield* writePipelineOutputEffect(
          artifact,
          opts.outdir,
          projectDir,
          fs,
        )
        rows.push(buildSynthRow(artifact, files))
      }
    }

    // Print summary
    if (!quiet) {
      yield* Effect.sync(() => {
        console.log(
          pc.green(
            `\nSynthesis complete. ${allArtifacts.length} pipeline(s) written.\n`,
          ),
        )
        for (const artifact of allArtifacts) {
          const stmtCount = artifact.sql.statements.length
          console.log(
            `  ${pc.cyan(artifact.name)} ${pc.dim(`(${stmtCount} statement${stmtCount !== 1 ? "s" : ""})`)} ${pc.dim(`→ ${opts.outdir}/${artifact.name}/`)}`,
          )
        }
        console.log("")
      })
    }

    // Push tap manifests to console if URL is available
    const targetUrl = resolveConsoleUrl({
      consoleUrl: opts.consoleUrl,
      resolvedConfig: ctx.resolvedConfig ?? undefined,
    })
    if (targetUrl) {
      for (const artifact of allArtifacts) {
        const manifest = artifact.tapManifest
        if (manifest) {
          // pushTapManifest never throws
          const pushResult = yield* Effect.promise(() =>
            pushTapManifest(manifest, targetUrl, { quiet }),
          )
          if (!pushResult.ok && pushResult.message) {
            warnings.push(pushResult.message)
          }
        }
      }
    }

    return { artifacts: allArtifacts, rows, warnings }
  })
}

function buildSynthRow(
  artifact: PipelineArtifact,
  files: readonly SynthArtifactFileJson[],
): SynthPipelineJson {
  return {
    name: artifact.name,
    statementCount: artifact.sql.statements.length,
    diagnostics: artifact.sql.diagnostics,
    files,
  }
}

/**
 * Effect-based synth program (human output).
 *
 * Returns an Effect with typed errors and console output.
 * Uses FrFileSystem service for file writes.
 */
export function runSynthEffect(
  opts: SynthOptions,
): Effect.Effect<
  readonly PipelineArtifact[],
  DiscoveryError | FileSystemError,
  FrFileSystem
> {
  return synthesizeAndWrite(opts, false).pipe(
    Effect.map((outcome) => outcome.artifacts),
  )
}

/**
 * Effect-based synth program (JSON output).
 *
 * Never fails: every outcome — including discovery errors and defects —
 * is reported through the JSON envelope on stdout. Artifacts that were
 * written before a failure stay on disk. Sets `process.exitCode = 1`
 * when the command failed; SQL-verifier diagnostics on artifacts do NOT
 * fail the command (parity with human mode).
 */
export function runSynthJsonEffect(
  opts: SynthOptions,
): Effect.Effect<void, never, FrFileSystem> {
  return Effect.gen(function* () {
    const startedAt = new Date()
    const projectDir = opts.projectDir ?? process.cwd()

    const outcome = yield* synthesizeAndWrite(opts, true).pipe(
      Effect.map((value) => ({ failed: false as const, value })),
      Effect.catchAll((err) =>
        Effect.succeed({
          failed: true as const,
          error: serializeSynthError(err),
        }),
      ),
      Effect.catchAllDefect((defect) =>
        Effect.succeed({
          failed: true as const,
          error: serializeSynthError(defect),
        }),
      ),
    )

    const envelope: SynthJsonOutput = {
      formatVersion: JSON_FORMAT_VERSION,
      tool: jsonToolInfo(),
      command: "synth",
      ok: !outcome.failed,
      startedAt: startedAt.toISOString(),
      durationMs: Date.now() - startedAt.getTime(),
      warnings: outcome.failed ? [] : outcome.value.warnings,
      ...(outcome.failed ? { error: outcome.error } : {}),
      outDir: join(projectDir, opts.outdir),
      pipelines: outcome.failed ? [] : outcome.value.rows,
    }

    yield* Effect.sync(() => {
      emitJson(envelope)
      if (outcome.failed) {
        process.exitCode = 1
      }
    })
  })
}

function writePipelineOutputEffect(
  artifact: PipelineArtifact,
  outdir: string,
  projectDir: string,
  fs: FrFileSystem["Type"],
): Effect.Effect<readonly SynthArtifactFileJson[], FileSystemError> {
  return Effect.gen(function* () {
    const files: SynthArtifactFileJson[] = []
    const pipelineDir = join(projectDir, outdir, artifact.name)
    yield* fs.mkdir(pipelineDir, { recursive: true })

    const sqlPath = join(pipelineDir, "pipeline.sql")
    yield* fs.writeFile(sqlPath, artifact.sql.sql)
    files.push({ kind: "sql", path: sqlPath })

    const crdYaml = toYaml(artifact.crd)
    const deploymentPath = join(pipelineDir, "deployment.yaml")
    yield* fs.writeFile(deploymentPath, crdYaml)
    files.push({ kind: "deployment", path: deploymentPath })

    if (artifact.pipelineYaml != null) {
      const pipelineYamlPath = join(pipelineDir, "pipeline.yaml")
      yield* fs.writeFile(pipelineYamlPath, artifact.pipelineYaml)
      files.push({ kind: "pipeline-yaml", path: pipelineYamlPath })
      for (const res of artifact.secondaryResources) {
        const resPath = join(pipelineDir, `${res.kind.toLowerCase()}.yaml`)
        yield* fs.writeFile(resPath, toYaml(res))
        files.push({ kind: "secondary-resource", path: resPath })
      }
    } else {
      const configMap = buildConfigMapYaml(artifact)
      const configMapPath = join(pipelineDir, "configmap.yaml")
      yield* fs.writeFile(configMapPath, configMap)
      files.push({ kind: "configmap", path: configMapPath })
    }

    if (artifact.tapManifest) {
      const outdirPath = join(projectDir, outdir)
      yield* fs.mkdir(outdirPath, { recursive: true })
      const tapPath = join(outdirPath, `${artifact.name}.tap-manifest.json`)
      yield* fs.writeFile(
        tapPath,
        JSON.stringify(artifact.tapManifest, null, 2),
      )
      files.push({ kind: "tap-manifest", path: tapPath })
    }

    return files as readonly SynthArtifactFileJson[]
  })
}
