# Open a pipeline

FlinkReactor pipelines live in `pipelines/<name>/index.tsx`. Each one default-
exports a `<Pipeline>` tree that synthesizes to Flink SQL and a Kubernetes
`FlinkDeployment`.

Open any pipeline `index.tsx`. The FlinkReactor **language server** synthesizes
it in the background and publishes `FR`-prefixed diagnostics inline — schema
typos, orphaned sources, invalid connectors, changelog-mode mismatches — without
you running anything from the terminal.

The status bar item shows the language server's state; click it to open the
**FlinkReactor** output channel.
