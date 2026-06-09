// ── Hardcoded-credential lint ────────────────────────────────────────
// Warns when a credential sits in the construct tree as a plain literal
// where a safer mechanism exists. Two tiers:
//
//   Tier 1 (deterministic — all surfaces, including the editor):
//     A SecretRef-capable slot received a plain string. The fix is
//     mechanical: wrap it in `secretRef()` so synthesis emits an
//     `${env:VAR}` placeholder + a CRD `secretKeyRef` env binding and
//     the cleartext never enters the tree.
//
//   Tier 2 (heuristic — CLI only):
//     A sensitive option holds a literal that does not look env-sourced.
//     "Env-sourced" = an `${env:VAR}` placeholder, a SecretRef, or a
//     value equal to some current `process.env` entry (the common
//     `password: process.env.PG_PASSWORD!` pattern). Editor passes skip
//     this tier: it consults ambient process state, so its findings are
//     not stable across machines/keystrokes — exactly what an editor
//     squiggle must be.
//
// No taint tracking: a literal that happens to equal an env value is
// treated as env-sourced. That trade is deliberate — false negatives are
// acceptable here; unfixable warnings are not.

import { isSecretRef } from "./secret-ref.js"
import { isSensitiveOptionKey } from "./sensitive-options.js"
import type { ValidationDiagnostic } from "./synth-context.js"
import type { ConstructNode } from "./types.js"

export interface SecretHygieneOptions {
  /**
   * `"cli"` (default) runs both tiers. `"editor"` runs only the
   * deterministic Tier-1 checks.
   */
  readonly surface?: "cli" | "editor"
}

/** SecretRef-capable props per component (typed `string | SecretRef`). */
const SECRET_REF_CAPABLE: ReadonlyMap<string, readonly string[]> = new Map([
  ["FlussCatalog", ["saslPassword"]],
])

/**
 * Props that are plain-string credentials BY DESIGN (their emission path
 * cannot resolve `${env:VAR}` placeholders), so the only hygiene is
 * env-sourcing the value at synth time. Checked in Tier 2.
 */
const LITERAL_CREDENTIAL_PROPS: ReadonlyMap<string, readonly string[]> =
  new Map([["PaimonCatalog", ["s3AccessKey", "s3SecretKey"]]])

/** Components whose `url`/`baseUrl` props commonly embed credentials. */
const URL_PROPS: ReadonlyMap<string, readonly string[]> = new Map([
  ["JdbcSource", ["url"]],
  ["JdbcSink", ["url"]],
  ["JdbcCatalog", ["baseUrl"]],
])

const ENV_PLACEHOLDER = /^\$\{env:[A-Z_][A-Z0-9_]*\}$/
const URL_CREDENTIAL_PARAM = /[?&;](?:password|sslpassword)=([^&;'"\s]*)/i

function currentEnvValues(): ReadonlySet<string> {
  const values = new Set<string>()
  for (const value of Object.values(process.env)) {
    // Skip very short values — "1", "on", "us" would false-match.
    if (typeof value === "string" && value.length >= 4) {
      values.add(value)
    }
  }
  return values
}

function looksEnvSourced(
  value: string,
  envValues: ReadonlySet<string>,
): boolean {
  return ENV_PLACEHOLDER.test(value) || envValues.has(value)
}

/**
 * Walk the construct tree and report credential-hygiene findings as
 * `category: "connector"` warnings. Never errors — artifacts still need
 * the literal values; the warning drives the safer pattern.
 */
export function validateSecretHygiene(
  root: ConstructNode,
  opts?: SecretHygieneOptions,
): ValidationDiagnostic[] {
  const surface = opts?.surface ?? "cli"
  const diagnostics: ValidationDiagnostic[] = []
  const envValues = surface === "cli" ? currentEnvValues() : new Set<string>()

  const warn = (
    node: ConstructNode,
    key: string,
    remediation: string,
  ): void => {
    diagnostics.push({
      severity: "warning",
      message: `<${node.component}> '${node.id}': sensitive option \`${key}\` is a hardcoded literal — ${remediation}`,
      nodeId: node.id,
      component: node.component,
      category: "connector",
      details: { sensitiveOptionKeys: [key] },
    })
  }

  const visit = (node: ConstructNode): void => {
    // Tier 1: SecretRef-capable slots holding plain strings.
    const refCapable = SECRET_REF_CAPABLE.get(node.component)
    if (refCapable) {
      for (const prop of refCapable) {
        const value = node.props[prop]
        if (typeof value === "string" && value.length > 0) {
          warn(
            node,
            prop,
            "pass secretRef() instead so the value is injected via the FlinkDeployment secretKeyRef → env binding and never enters the synthesized tree",
          )
        }
      }
    }

    if (surface === "cli") {
      // Tier 2a: literal-by-design credential props.
      const literalProps = LITERAL_CREDENTIAL_PROPS.get(node.component)
      if (literalProps) {
        for (const prop of literalProps) {
          const value = node.props[prop]
          if (
            typeof value === "string" &&
            value.length > 0 &&
            !looksEnvSourced(value, envValues)
          ) {
            warn(
              node,
              prop,
              "read it from process.env at synth time so the literal never lives in source control (display surfaces redact it, but it still lands in the DDL)",
            )
          }
        }
      }

      // Tier 2b: credentials embedded in connection URLs.
      const urlProps = URL_PROPS.get(node.component)
      if (urlProps) {
        for (const prop of urlProps) {
          const value = node.props[prop]
          if (typeof value !== "string") continue
          const match = URL_CREDENTIAL_PARAM.exec(value)
          if (
            match &&
            match[1].length > 0 &&
            !looksEnvSourced(match[1], envValues)
          ) {
            warn(
              node,
              prop,
              "move the credential out of the URL (or build the URL from process.env at synth time)",
            )
          }
        }
      }

      // Tier 2c: sensitive keys in generic `options` pass-through maps.
      const options = node.props.options
      if (options && typeof options === "object" && !Array.isArray(options)) {
        for (const [key, value] of Object.entries(
          options as Record<string, unknown>,
        )) {
          if (!isSensitiveOptionKey(key)) continue
          if (isSecretRef(value)) continue
          if (typeof value !== "string" || value.length === 0) continue
          if (looksEnvSourced(value, envValues)) continue
          warn(
            node,
            key,
            "read it from process.env at synth time so the literal never lives in source control (display surfaces redact it, but it still lands in the DDL)",
          )
        }
      }
    }

    for (const child of node.children) {
      visit(child)
    }
  }

  visit(root)
  return diagnostics
}
