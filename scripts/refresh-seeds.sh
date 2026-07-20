#!/usr/bin/env bash
# ── Refresh embedded Kafka seed catalog from the DSL ────────────────
# Regenerates the DSL's seed-fixtures artifact and vendors it into the
# console, where the Kafka instrument embeds it via `go:embed`. Run this
# whenever `SEED_SUBJECTS` changes in flink-reactor-dsl.
#
# Usage:
#   ./scripts/refresh-seeds.sh              # export from ../flink-reactor-dsl
#   FR_DSL_DIR=/path/to/dsl ./scripts/refresh-seeds.sh
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
DSL_DIR="${FR_DSL_DIR:-$PROJECT_ROOT/../flink-reactor-dsl}"
DEST="$PROJECT_ROOT/server/internal/instruments/kafka/seed/seeds.json"

if [[ ! -d "$DSL_DIR" ]]; then
  echo "Error: DSL repo not found at $DSL_DIR" >&2
  echo "Set FR_DSL_DIR to your flink-reactor-dsl checkout path." >&2
  exit 1
fi

echo "Exporting seed fixtures from $DSL_DIR..."
(cd "$DSL_DIR" && pnpm seeds:export)

SRC="$DSL_DIR/assets/seeds.json"
if [[ ! -f "$SRC" ]]; then
  echo "Error: expected artifact not found at $SRC" >&2
  exit 1
fi

mkdir -p "$(dirname "$DEST")"
cp "$SRC" "$DEST"
echo "Done! Vendored seed catalog → ${DEST#"$PROJECT_ROOT"/}"
