import { fork } from "node:child_process"
import { existsSync, readdirSync, readFileSync } from "node:fs"
import { dirname, join, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { Command } from "commander"
import { config as loadDotenv } from "dotenv"

const __dirname = dirname(fileURLToPath(import.meta.url))

// In the published package, dist/cli.js sits next to .next/standalone/
const PACKAGE_ROOT = resolve(__dirname, "..")

const pkg = JSON.parse(
  readFileSync(join(PACKAGE_ROOT, "package.json"), "utf-8"),
) as { version: string }

function findServerRecursive(dir: string, depth: number): string | null {
  if (depth <= 0) return null
  const candidate = join(dir, "server.js")
  if (existsSync(candidate) && !dir.includes("node_modules")) return candidate
  try {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (!entry.isDirectory() || entry.name === "node_modules") continue
      const found = findServerRecursive(join(dir, entry.name), depth - 1)
      if (found) return found
    }
  } catch {
    // Permission errors, etc.
  }
  return null
}

function findServerJs(): string {
  const standaloneDir = join(PACKAGE_ROOT, ".next", "standalone")

  // Direct (non-monorepo)
  const direct = join(standaloneDir, "server.js")
  if (existsSync(direct)) return direct

  // Absolute-path nesting (monorepo): standalone mirrors full path from /
  const relativeFromRoot = PACKAGE_ROOT.startsWith("/")
    ? PACKAGE_ROOT.slice(1)
    : PACKAGE_ROOT
  const expected = join(standaloneDir, relativeFromRoot, "server.js")
  if (existsSync(expected)) return expected

  // Common monorepo relative nesting
  const common = join(standaloneDir, "apps", "dashboard", "server.js")
  if (existsSync(common)) return common

  // Last resort: recursive search
  const found = findServerRecursive(standaloneDir, 10)
  if (found) return found

  console.error(
    "\x1b[31m✗ Could not find server.js in .next/standalone/\x1b[0m",
  )
  console.error(
    "  Run `pnpm build:package` first to generate the standalone build.",
  )
  process.exit(1)
}

function resolveEnvFile(
  env: string,
  customPath?: string,
): { path: string; isJson: boolean } | null {
  if (customPath) {
    const absPath = resolve(customPath)
    if (!existsSync(absPath)) {
      console.error(`\x1b[31m✗ Config file not found: ${absPath}\x1b[0m`)
      process.exit(1)
    }
    return { path: absPath, isJson: absPath.endsWith(".json") }
  }

  const envFile = join(PACKAGE_ROOT, `.env.${env}`)
  if (existsSync(envFile)) return { path: envFile, isJson: false }

  // Fall back to .env
  const dotenv = join(PACKAGE_ROOT, ".env")
  if (existsSync(dotenv)) return { path: dotenv, isJson: false }

  return null
}

const program = new Command()

program
  .name("flink-reactor-dashboard")
  .description("Real-time monitoring dashboard for Apache Flink clusters")
  .version(pkg.version)

program
  .command("start", { isDefault: true })
  .description("Start the dashboard server")
  .option("-p, --port <port>", "Dashboard port", undefined)
  .option(
    "-e, --env <name>",
    "Environment: development | staging | production",
    "production",
  )
  .option(
    "-c, --config <path>",
    "Custom .env or .json config file (overrides --env)",
  )
  .option("--mock", "Force mock mode (ignore FLINK_REST_URL)")
  .action(
    (options: {
      port?: string
      env: string
      config?: string
      mock?: boolean
    }) => {
      // 1. Load environment file
      const envFile = resolveEnvFile(options.env, options.config)
      if (envFile) {
        if (envFile.isJson) {
          // JSON config: set FLINK_REACTOR_CONFIG for the dashboard to read
          process.env.FLINK_REACTOR_CONFIG = envFile.path
        } else {
          loadDotenv({ path: envFile.path })
        }
      }

      // 2. Apply CLI overrides
      if (options.port) {
        process.env.DASHBOARD_PORT = options.port
      }
      if (options.mock) {
        process.env.DASHBOARD_MOCK_MODE = "on"
      }

      const port = process.env.DASHBOARD_PORT || "3001"
      const mockMode =
        process.env.DASHBOARD_MOCK_MODE === "on" || !process.env.FLINK_REST_URL
      const clusterName = process.env.CLUSTER_DISPLAY_NAME || "Default Cluster"

      // 3. Find and launch the standalone server
      const serverJs = findServerJs()

      console.log()
      console.log("\x1b[36m◆ Flink Reactor Dashboard\x1b[0m")
      console.log()
      console.log(`  Environment:  ${options.env}`)
      console.log(`  Cluster:      ${clusterName}`)
      console.log(`  Mock mode:    ${mockMode ? "on" : "off"}`)
      if (envFile) {
        console.log(`  Config:       ${envFile.path}`)
      }
      console.log()
      console.log(`  \x1b[32m▸ http://localhost:${port}\x1b[0m`)
      console.log()

      const child = fork(serverJs, {
        env: {
          ...process.env,
          PORT: port,
          HOSTNAME: "0.0.0.0",
        },
        stdio: "inherit",
      })

      // 4. Graceful shutdown
      function shutdown() {
        child.kill("SIGTERM")
      }

      process.on("SIGINT", shutdown)
      process.on("SIGTERM", shutdown)

      child.on("exit", (code) => {
        process.exit(code ?? 0)
      })
    },
  )

program.parse()
