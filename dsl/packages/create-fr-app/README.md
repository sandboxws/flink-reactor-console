<h1 align="center">@flink-reactor/create-fr-app</h1>

<p align="center">
  <strong>Scaffold and manage apps built with the FlinkReactor design system.</strong>
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/@flink-reactor/create-fr-app"><img src="https://img.shields.io/npm/v/@flink-reactor/create-fr-app?color=d97085&label=npm" alt="npm version" /></a>
  <img src="https://img.shields.io/badge/license-BSL--1.1-green" alt="license" />
</p>

`create-fr-app` scaffolds a **Next.js application wired to the `@flink-reactor/ui`
design system** and copies its components into your project (shadcn-style — you
own the code). It is the UI companion to the FlinkReactor CLI; it does **not**
scaffold Flink pipelines. To create a streaming-pipeline project, use
`flink-reactor new` (the `flink-reactor` / `fr` CLI) instead.

## Usage

```bash
# Create a new app (interactive; runs `init` when no command is given)
npx @flink-reactor/create-fr-app

# Or with a project name
npx @flink-reactor/create-fr-app init my-app

# Using the short alias
npx create-fr-app my-app
```

## Commands

| Command | Description |
|---------|-------------|
| `init [name]` | Create a new app with the FlinkReactor design system (default when no command given) |
| `add <components...>` | Add design-system components to an existing project |
| `check` | Check for available component updates |
| `update` | Update components to their latest versions |

## Options

```
init [project-name]
  -t, --template <template>  Template to use (default: "nextjs")
  --no-git                   Skip git initialization
  --no-install               Skip dependency installation

add <components...>
  -y, --yes                  Skip confirmation

update
  -y, --yes                  Skip confirmation and accept all updates
  --force                    Overwrite local changes
```

## What it scaffolds

```
my-app/
├── src/
│   └── app/
│       ├── layout.tsx        # Root layout
│       └── page.tsx          # Landing page using the design system
├── components/ui/            # Copied @flink-reactor/ui components (you own these)
├── next.config.ts            # Next.js config
├── postcss.config.mjs        # Tailwind v4 via PostCSS
├── tsconfig.json             # TypeScript config (jsx: preserve)
├── .fr-ui.json               # Component manifest used by `add` / `check` / `update`
└── package.json
```

## Links

- [FlinkReactor Documentation](https://flink-reactor.dev)
- [GitHub Repository](https://github.com/sandboxws/flink-reactor-dsl)
- [Report Issues](https://github.com/sandboxws/flink-reactor-dsl/issues)
