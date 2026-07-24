import type { Command } from "commander"
import pc from "picocolors"
import type { TemplateCategory } from "@/templates/manifest.js"
import { templateManifest } from "@/templates/manifest.js"

// Category display order + labels for the grouped human listing.
const CATEGORY_ORDER: TemplateCategory[] = [
  "starter",
  "cdc",
  "analytics",
  "lakehouse",
  "showcase",
]
const CATEGORY_LABELS: Record<TemplateCategory, string> = {
  starter: "Starter",
  cdc: "CDC",
  analytics: "Analytics",
  lakehouse: "Lakehouse",
  showcase: "Showcase",
}

export function registerTemplatesCommand(program: Command): void {
  program
    .command("templates")
    .description(
      "List the available project templates (the DSL template manifest)",
    )
    .option(
      "--json",
      "Print the manifest as JSON (for inspection and drift checks)",
    )
    .action((opts: { json?: boolean }) => {
      const manifest = templateManifest()

      // `--json` is the machine-readable surface: it prints `templateManifest()`
      // verbatim, which is exactly what the build serialises and what CI diffs
      // against `TEMPLATE_FACTORIES` to catch drift.
      if (opts.json) {
        console.log(JSON.stringify(manifest, null, 2))
        return
      }

      console.log("")
      console.log(
        `  ${pc.bold(pc.cyan("flink-reactor templates"))} ${pc.dim(
          `(${manifest.length} templates)`,
        )}`,
      )

      for (const category of CATEGORY_ORDER) {
        const items = manifest.filter((m) => m.category === category)
        if (items.length === 0) continue

        console.log("")
        console.log(`  ${pc.bold(pc.yellow(CATEGORY_LABELS[category]))}`)
        for (const t of items) {
          console.log(
            `    ${pc.green(t.name.padEnd(20))} ${pc.dim(t.description)}`,
          )

          const meta: string[] = []
          if (t.pipelines.length > 0) {
            meta.push(
              `${t.pipelines.length} pipeline${t.pipelines.length === 1 ? "" : "s"}`,
            )
          }
          if (t.requiredServices.length > 0) {
            meta.push(`services: ${t.requiredServices.join(", ")}`)
          }
          if (meta.length > 0) {
            console.log(`    ${" ".repeat(20)} ${pc.dim(meta.join(" · "))}`)
          }
        }
      }

      console.log("")
      console.log(
        `  ${pc.dim("Scaffold one with")} ${pc.green("flink-reactor new <name> -t <template>")}`,
      )
      console.log("")
    })
}
