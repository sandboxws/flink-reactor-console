#!/usr/bin/env bash
# ── Refresh flink-reactor from local Verdaccio ──────────────────────
# Clears the pnpm-cached flink-reactor package so `pnpm install` pulls
# the latest version from the local Verdaccio registry (localhost:4873)
# without requiring a version bump in the DSL repo.
#
# Usage:
#   ./scripts/refresh-dsl.sh          # clear cache + reinstall
#   ./scripts/refresh-dsl.sh --dry    # show what would be removed
set -euo pipefail

REGISTRY="http://localhost:4873"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
PNPM_STORE="$(pnpm store path)"
DRY_RUN=false

if [[ "${1:-}" == "--dry" ]]; then
  DRY_RUN=true
fi

# --- Verify Verdaccio is running ---
if ! curl -sf "$REGISTRY" > /dev/null 2>&1; then
  echo "Error: Verdaccio is not running at $REGISTRY" >&2
  echo "Start it from the DSL repo:  cd ../flink-reactor-dsl && pnpm local:publish" >&2
  exit 1
fi

# --- Remove flink-reactor from pnpm store ---
echo "Clearing flink-reactor from pnpm store..."

# Remove from the content-addressable store (directories and index files)
CACHED_DIRS=$(find "$PNPM_STORE" -type d -name "flink-reactor" 2>/dev/null || true)
CACHED_INDEX=$(find "$PNPM_STORE/index" -type f -name "*flink-reactor*" 2>/dev/null || true)
CACHED=$(printf '%s\n%s' "$CACHED_DIRS" "$CACHED_INDEX" | grep -v '^$' || true)
if [[ -n "$CACHED" ]]; then
  echo "$CACHED" | while read -r entry; do
    if $DRY_RUN; then
      echo "  [dry] would remove: $entry"
    else
      rm -rf "$entry"
      echo "  removed: $entry"
    fi
  done
else
  echo "  (no cached entries found in store)"
fi

# Remove the resolved metadata from node_modules
RESOLVED="$PROJECT_ROOT/node_modules/.pnpm/flink-reactor@"*
for dir in $RESOLVED; do
  if [[ -d "$dir" ]]; then
    if $DRY_RUN; then
      echo "  [dry] would remove: $dir"
    else
      rm -rf "$dir"
      echo "  removed: $dir"
    fi
  fi
done

# Also clear the dashboard's symlink
DASHBOARD_LINK="$PROJECT_ROOT/dashboard/node_modules/flink-reactor"
if [[ -L "$DASHBOARD_LINK" || -d "$DASHBOARD_LINK" ]]; then
  if $DRY_RUN; then
    echo "  [dry] would remove: $DASHBOARD_LINK"
  else
    rm -rf "$DASHBOARD_LINK"
    echo "  removed: $DASHBOARD_LINK"
  fi
fi

if $DRY_RUN; then
  echo ""
  echo "Dry run complete. Run without --dry to apply."
  exit 0
fi

# --- Clear Vite pre-bundle cache ---
VITE_CACHE="$PROJECT_ROOT/dashboard/node_modules/.vite"
if [[ -d "$VITE_CACHE" ]]; then
  rm -rf "$VITE_CACHE"
  echo "  removed Vite dep cache: $VITE_CACHE"
fi

# --- Reinstall from Verdaccio ---
echo ""
echo "Reinstalling flink-reactor from $REGISTRY..."
cd "$PROJECT_ROOT"
pnpm install --registry "$REGISTRY"

echo ""
echo "Done! flink-reactor refreshed from local registry (restart dev server to pick up changes)."
