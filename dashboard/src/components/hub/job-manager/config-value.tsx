import { formatBytes } from "@flink-reactor/ui"
import { ExternalLink } from "lucide-react"

const RE_URL = /^https?:\/\//i
const RE_URI = /^(hdfs|s3a?|gs|ftp):\/\//i
const RE_FQDN = /^([a-z][a-z0-9_]*\.){2,}[A-Z][A-Za-z0-9_$]*$/
const RE_IP = /^(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})(?::(\d+))?$/
const RE_PATH = /^\/[a-zA-Z0-9._/-]+$/
const RE_MEMORY = /^(\d+)\s*([kmgKMG])[bB]?$/
const RE_DURATION = /^(\d+)\s*(ms|s|m|min|h|d)$/i
const RE_BOOL = /^(true|false)$/i

function expandMemory(num: number, unit: string): string {
  const multipliers: Record<string, number> = {
    k: 1024,
    m: 1024 ** 2,
    g: 1024 ** 3,
  }
  return formatBytes(num * (multipliers[unit.toLowerCase()] ?? 1))
}

function expandDuration(num: number, unit: string): string {
  const labels: Record<string, string> = {
    ms: "millisecond",
    s: "second",
    m: "minute",
    min: "minute",
    h: "hour",
    d: "day",
  }
  const label = labels[unit.toLowerCase()] ?? unit
  return `${num} ${label}${num !== 1 ? "s" : ""}`
}

export function ConfigValue({ value }: { value: string }) {
  if (RE_URL.test(value)) {
    return (
      <a
        href={value}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1 text-fr-teal hover:underline"
      >
        {value}
        <ExternalLink className="size-3 shrink-0" />
      </a>
    )
  }

  const uriMatch = value.match(RE_URI)
  if (uriMatch) {
    const schemeEnd = value.indexOf("://") + 3
    return (
      <span>
        <span className="text-fr-amber">{value.slice(0, schemeEnd)}</span>
        <span className="text-fg-muted">{value.slice(schemeEnd)}</span>
      </span>
    )
  }

  if (RE_FQDN.test(value)) {
    const lastDot = value.lastIndexOf(".")
    return (
      <span>
        <span className="text-fg-dim">{value.slice(0, lastDot + 1)}</span>
        <span className="text-fr-coral">{value.slice(lastDot + 1)}</span>
      </span>
    )
  }

  const ipMatch = value.match(RE_IP)
  if (ipMatch) {
    return (
      <span>
        <span className="text-fg">{ipMatch[1]}</span>
        {ipMatch[2] && (
          <>
            <span className="text-fg-faint">:</span>
            <span className="text-fr-amber">{ipMatch[2]}</span>
          </>
        )}
      </span>
    )
  }

  if (RE_PATH.test(value)) {
    return (
      <span>
        <span className="text-fg-faint">/</span>
        <span className="text-fg-muted">{value.slice(1)}</span>
      </span>
    )
  }

  const memMatch = value.match(RE_MEMORY)
  if (memMatch) {
    return (
      <span title={expandMemory(Number(memMatch[1]), memMatch[2])}>
        <span className="text-fr-coral">{memMatch[1]}</span>
        <span className="text-fg-dim">{value.slice(memMatch[1].length)}</span>
      </span>
    )
  }

  const durMatch = value.match(RE_DURATION)
  if (durMatch) {
    return (
      <span title={expandDuration(Number(durMatch[1]), durMatch[2])}>
        <span className="text-fr-coral">{durMatch[1]}</span>
        <span className="text-fg-dim">{value.slice(durMatch[1].length)}</span>
      </span>
    )
  }

  if (RE_BOOL.test(value)) {
    const isTrue = value.toLowerCase() === "true"
    return (
      <span className={isTrue ? "text-fr-sage" : "text-fg-dim"}>{value}</span>
    )
  }

  return <span className="text-fg-muted">{value}</span>
}
