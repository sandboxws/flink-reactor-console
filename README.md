# flink-reactor-console

FlinkReactor Console — a real-time dashboard and GraphQL server for managing Apache Flink clusters.

## Structure

```
dashboard/       # React SPA (TanStack Router + Zustand + Tailwind v4)
server/          # Go GraphQL server (reactor-server)
packages/ui/     # Shared UI component library
tools/           # UI embeddings tooling
```

## Quick Start

```bash
# Install Node dependencies
pnpm install

# Start dashboard dev server
pnpm dev

# Start Go server (in another terminal)
cd server && just dev
```

## License

BSL 1.1
