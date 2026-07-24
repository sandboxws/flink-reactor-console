#!/usr/bin/env bash
# ── Refresh embedded template manifest from the DSL ─────────────────
# Regenerates the DSL's template-manifest artifact and vendors it into the
# console, where the templates GraphQL API embeds it via `go:embed`. Run this
# whenever the template registry (`TEMPLATE_FACTORIES`) changes in dsl/.
#
# Usage:
#   ./scripts/refresh-templates.sh              # export from the in-repo dsl/
#   FR_DSL_DIR=/path/to/dsl ./scripts/refresh-templates.sh
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
DSL_DIR="${FR_DSL_DIR:-$PROJECT_ROOT/dsl}"
DEST="$PROJECT_ROOT/server/internal/templates/templates.generated.json"

if [[ ! -d "$DSL_DIR" ]]; then
  echo "Error: DSL tree not found at $DSL_DIR" >&2
  echo "Set FR_DSL_DIR if your DSL tree lives elsewhere." >&2
  exit 1
fi

echo "Exporting template manifest from $DSL_DIR..."
(cd "$DSL_DIR" && pnpm templates:export)

SRC="$DSL_DIR/assets/templates.generated.json"
if [[ ! -f "$SRC" ]]; then
  echo "Error: expected artifact not found at $SRC" >&2
  exit 1
fi

mkdir -p "$(dirname "$DEST")"
cp "$SRC" "$DEST"
echo "Done! Vendored template manifest → ${DEST#"$PROJECT_ROOT"/}"
