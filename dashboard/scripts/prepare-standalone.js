#!/usr/bin/env node

// ---------------------------------------------------------------------------
// prepare-standalone.js
//
// Post-build script that copies static assets into the Next.js standalone
// output directory. Next.js standalone mode deliberately excludes `public/`
// and `.next/static/` (they're meant for CDN), but for a self-contained npm
// package we need them bundled alongside the server.
//
// In a pnpm monorepo the standalone output nests under the workspace-relative
// path (e.g. `.next/standalone/apps/dashboard/`), so we detect it dynamically.
// ---------------------------------------------------------------------------

import { cpSync, existsSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "..");
const DOT_NEXT = join(ROOT, ".next");
const STANDALONE = join(DOT_NEXT, "standalone");

function fail(msg) {
  console.error(`\x1b[31m✗ ${msg}\x1b[0m`);
  process.exit(1);
}

function info(msg) {
  console.log(`  ${msg}`);
}

// 1. Validate standalone output exists
if (!existsSync(STANDALONE)) {
  fail(
    "Missing .next/standalone/ — run `next build` with `output: 'standalone'` first.",
  );
}

// 2. Find the nested app root inside standalone.
//    Next.js standalone mirrors the *absolute* filesystem path structure,
//    so in a monorepo at /Users/me/proj/apps/dashboard the server ends up at
//    .next/standalone/Users/me/proj/apps/dashboard/server.js.
//    We use ROOT to compute the expected path, then fall back to a recursive
//    search if that doesn't match (e.g. non-monorepo or different Next.js version).
function findAppRoot() {
  // Direct match (non-monorepo)
  if (existsSync(join(STANDALONE, "server.js"))) return STANDALONE;

  // Compute expected path by stripping the leading "/" from ROOT
  // so we can join it relative to STANDALONE
  const relativeFromRoot = ROOT.startsWith("/") ? ROOT.slice(1) : ROOT;
  const expectedPath = join(STANDALONE, relativeFromRoot);
  if (existsSync(join(expectedPath, "server.js"))) return expectedPath;

  // Last resort: recursive search (handles unexpected nesting)
  return findServerRecursive(STANDALONE, 10);
}

function findServerRecursive(dir, depth) {
  if (depth <= 0) return null;
  if (existsSync(join(dir, "server.js"))) return dir;
  try {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (!entry.isDirectory() || entry.name === "node_modules") continue;
      const found = findServerRecursive(join(dir, entry.name), depth - 1);
      if (found) return found;
    }
  } catch {
    // Permission errors, etc.
  }
  return null;
}

const appRoot = findAppRoot();
if (!appRoot) {
  fail("Could not locate server.js inside .next/standalone/");
}

console.log("\n\x1b[36m◆ Preparing standalone output\x1b[0m\n");
info(`Standalone app root: ${appRoot}`);

// 3. Copy .next/static → appRoot/.next/static
const staticSrc = join(DOT_NEXT, "static");
const staticDest = join(appRoot, ".next", "static");

if (existsSync(staticSrc)) {
  cpSync(staticSrc, staticDest, { recursive: true });
  info(`Copied .next/static → ${staticDest}`);
} else {
  info("No .next/static directory found (skipping)");
}

// 4. Copy public/ → appRoot/public
const publicSrc = join(ROOT, "public");
const publicDest = join(appRoot, "public");

if (existsSync(publicSrc)) {
  cpSync(publicSrc, publicDest, { recursive: true });
  info(`Copied public/ → ${publicDest}`);
} else {
  info("No public/ directory found (skipping)");
}

// 5. Final validation
if (!existsSync(join(appRoot, "server.js"))) {
  fail("server.js missing from standalone output after preparation");
}

console.log("\n\x1b[32m✓ Standalone output ready\x1b[0m\n");
