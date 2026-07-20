# Contributing to FlinkReactor

We welcome contributions of all kinds — bug reports, feature suggestions, documentation improvements, and code.

## Development Setup

```bash
# Clone the repository
git clone https://github.com/sandboxws/flink-reactor-console.git
cd flink-reactor-console

# Install dependencies
pnpm install

# Build all packages (dsl → ui → dashboard, topological)
pnpm build

# Optional: install git hooks (biome, dsl typecheck, golangci-lint)
pre-commit install
```

## Repository Layout

| Directory | Purpose |
|-----------|---------|
| `dsl/` | `@flink-reactor/dsl` — TSX DSL + `flink-reactor` CLI, plus `dsl/packages/*` |
| `dashboard/` | React dashboard (TanStack Router + Zustand) |
| `server/` | Go GraphQL server with Flink REST proxy |
| `packages/ui/` | Shared UI component library (`@flink-reactor/ui`) |
| `tools/` | Dev tooling (UI embeddings) |

## Running Tests

```bash
# Dashboard tests
pnpm test

# DSL tests (or plain `pnpm test` from dsl/)
pnpm test:dsl

# DSL black-box CLI e2e
pnpm test:dsl:e2e

# Watch mode / snapshot-only runs (from dsl/)
pnpm test:watch
pnpm test:snapshots

# Type-check without emitting
pnpm typecheck        # dashboard
pnpm typecheck:dsl    # dsl

# Go server tests (from server/)
just test
```

## Code Style

This project uses [Biome](https://biomejs.dev/) for linting and formatting, enforced automatically by pre-commit hooks.

```bash
# Check for lint issues
pnpm lint

# Auto-fix lint issues
pnpm lint:fix

# Format code
pnpm format
```

Pre-commit hooks run automatically — you don't need to remember to lint before committing.

## Making Changes

1. **Fork the repo** and create a branch from `main`
2. **Make your changes** — keep commits focused and use conventional commit messages (`feat:`, `fix:`, `docs:`, `refactor:`)
3. **Add a changeset** if your change affects published packages:
   ```bash
   pnpm changeset
   ```
4. **Run tests** to make sure nothing breaks:
   ```bash
   pnpm test && pnpm typecheck
   ```
5. **Open a pull request** against `main`

## CLA Requirement

First-time contributors will be asked to sign our [Contributor License Agreement](.github/CLA.md) via a PR comment. This is a one-time process.

## Architecture

See the [Architecture section](dsl/README.md#-architecture) in the DSL README for an overview of how the DSL, construct tree, and code generators work together.

Key principles:
- **Synthesis only** — no runtime code. We generate SQL strings and YAML.
- **Custom JSX** — `createElement()` builds a construct tree, not React.
- **Deterministic output** — same input always produces the same SQL and YAML.

## Project Structure

| Directory | Purpose |
|-----------|---------|
| `dsl/src/core/` | JSX runtime, schemas, synth context, DAG |
| `dsl/src/components/` | Sources, sinks, transforms, joins, windows |
| `dsl/src/codegen/` | SQL generator, CRD generator, JAR resolution |
| `dsl/src/cli/` | CLI commands |
| `dsl/src/testing/` | Test helpers |
| `dsl/packages/create-fr-app/` | Project scaffolder |
| `dsl/packages/ts-plugin/` | TypeScript language service plugin |
| `dsl/packages/language-server/` | LSP backend |
| `dsl/packages/vscode-extension/` | VS Code extension (ships via vsce, not npm) |

## Release & Publishing

Releases are automated via GitHub Actions — you never publish manually from your machine.

### How it works

This repo uses [Changesets](https://github.com/changesets/changesets) to manage versioning and publishing. The workflow has two phases:

**1. Create a changeset (you do this locally)**

When your PR includes a user-facing change, run:

```bash
pnpm changeset
```

This prompts you to select the affected packages and the semver bump type (patch, minor, or major). It creates a markdown file in `.changeset/` describing the change. Commit this file with your PR.

> Not every PR needs a changeset — skip it for internal refactors, CI changes, or docs-only updates that don't affect published packages.

**2. Merge to `main` (GitHub Actions takes over)**

When your PR merges, the [Release workflow](.github/workflows/release.yml) runs automatically:

```
PR merges to main
       │
       ▼
┌─────────────────────────────────┐
│  Pending changesets exist?      │
│                                 │
│  YES → Opens/updates a         │
│        "Version Packages" PR    │
│        (bumps versions +        │
│         updates changelogs)     │
│                                 │
│  NO  → Publishes all packages   │
│        to npm                   │
└─────────────────────────────────┘
```

- When changesets accumulate, the action maintains a **"Version Packages" PR** that batches all pending version bumps and changelog updates.
- When that PR is merged (no more pending changesets), the action **publishes to npm**.

### What gets published

| Package | npm name | Location |
|---------|----------|----------|
| Core DSL | `@flink-reactor/dsl` | `dsl/` |
| Scaffolder | `@flink-reactor/create-fr-app` | `dsl/packages/create-fr-app/` |
| TS Plugin | `@flink-reactor/ts-plugin` | `dsl/packages/ts-plugin/` |
| Language Server | `@flink-reactor/language-server` | `dsl/packages/language-server/` |
| UI library | `@flink-reactor/ui` | `packages/ui/` |
| Dashboard | `@flink-reactor/dashboard` | `dashboard/` |

Every package versions independently — a DSL release never forces a dashboard/UI release and vice versa; only packages with pending changesets are bumped and published. The VS Code extension (`dsl/packages/vscode-extension/`) is `private` on npm: it ships through the VS Code Marketplace via `vsce` and is versioned manually at marketplace-release time.

### Local testing with Verdaccio

To test packages locally before a real release, publish to a local [Verdaccio](https://verdaccio.org/) registry:

```bash
pnpm local:publish
```

This builds the DSL packages, starts a Verdaccio server at `http://localhost:4873`, and publishes the DSL package set there (it does not cover `@flink-reactor/ui` or the dashboard). Install from it with:

```bash
npm install @flink-reactor/dsl --registry http://localhost:4873
```

### Commands reference

| Command | Description |
|---------|-------------|
| `pnpm changeset` | Create a new changeset |
| `pnpm version-packages` | Apply pending changesets (bump versions + changelogs) |
| `pnpm release` | Publish to npm (run by CI, not locally) |
| `pnpm local:publish` | Publish to local Verdaccio for testing |

## Code of Conduct

This project follows the [Contributor Covenant Code of Conduct](CODE_OF_CONDUCT.md). By participating, you are expected to uphold this code.
