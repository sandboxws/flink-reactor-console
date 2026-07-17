/**
 * YamlOutput — step 4: the generated `instruments:` YAML with a copy button and
 * paste guidance. Secrets render as `<set-me>` placeholders (see `toYaml`).
 */

import { Check, Copy } from "lucide-react"
import { useState } from "react"
import { toYaml } from "./field-spec"

interface YamlOutputProps {
  type: string
  name: string
  config: Record<string, unknown>
}

export function YamlOutput({ type, name, config }: YamlOutputProps) {
  const yaml = toYaml(type, name, config)
  const [copied, setCopied] = useState(false)

  async function copy() {
    try {
      await navigator.clipboard.writeText(yaml)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      // Clipboard may be unavailable (e.g. insecure context); ignore.
    }
  }

  return (
    <div className="space-y-3">
      <div className="relative">
        <pre className="code-viewer overflow-x-auto rounded-md bg-dash-surface p-3 font-mono text-[11.5px] text-fg">
          {yaml}
        </pre>
        <button
          type="button"
          onClick={copy}
          className="btn btn-secondary btn-sm absolute right-2 top-2"
        >
          {copied ? (
            <>
              <Check className="size-3.5" /> Copied
            </>
          ) : (
            <>
              <Copy className="size-3.5" /> Copy
            </>
          )}
        </button>
      </div>
      <p className="text-[11px] text-fg-muted">
        Paste this into{" "}
        <span className="font-mono">server/config/&lt;env&gt;.yml</span> and
        restart the server. Secret values show as{" "}
        <span className="font-mono">&lt;set-me&gt;</span> placeholders — fill
        them in before use. The server does not currently interpolate env vars
        for instrument secrets.
      </p>
    </div>
  )
}
