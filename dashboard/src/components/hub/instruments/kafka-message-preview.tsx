/**
 * KafkaMessagePreview — reads records from a topic on demand.
 *
 * Explicit "Load" rather than auto-fetch: reading record payloads is heavier
 * than the metadata the rest of the page shows, and the server reads them with
 * a throwaway consumer that leaves no consumer group behind. The order toggle
 * flips between the live end of the stream (newest) and the earliest retained
 * records (oldest) — the latter is where `cluster up`'s deterministic seed
 * rows live once a pump starts flooding the topic. Values are normalized to
 * single-line JSON when they parse.
 */

import { Button } from "@flink-reactor/ui"
import { RefreshCw } from "lucide-react"
import { useState } from "react"
import {
  fetchKafkaTopicMessages,
  type KafkaMessage,
  type KafkaMessageOrder,
} from "@/lib/instruments-data"

interface KafkaMessagePreviewProps {
  instrument: string
  topic: string
}

const PREVIEW_LIMIT = 20

function formatValue(value: string): string {
  try {
    return JSON.stringify(JSON.parse(value))
  } catch {
    return value
  }
}

export function KafkaMessagePreview({
  instrument,
  topic,
}: KafkaMessagePreviewProps) {
  const [messages, setMessages] = useState<KafkaMessage[] | null>(null)
  const [order, setOrder] = useState<KafkaMessageOrder>("NEWEST")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function load(readOrder: KafkaMessageOrder) {
    setLoading(true)
    setError(null)
    try {
      setMessages(
        await fetchKafkaTopicMessages(
          instrument,
          topic,
          PREVIEW_LIMIT,
          readOrder,
        ),
      )
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load messages")
    } finally {
      setLoading(false)
    }
  }

  function switchOrder(next: KafkaMessageOrder) {
    if (next === order) return
    setOrder(next)
    // Keep the table in sync with the toggle once something is on screen.
    if (messages !== null) void load(next)
  }

  const hasKeys = messages?.some((m) => m.key != null) ?? false

  const orderButton = (value: KafkaMessageOrder, label: string) => (
    <button
      type="button"
      onClick={() => switchOrder(value)}
      disabled={loading}
      className={`px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider transition-colors ${
        order === value
          ? "bg-dash-elevated text-fg"
          : "text-fg-faint hover:text-fg-muted"
      }`}
    >
      {label}
    </button>
  )

  return (
    <div className="glass-card-static overflow-hidden">
      <div className="flex items-center justify-between border-b border-dash-border px-4 py-2">
        <h3 className="section-heading">Messages</h3>
        <div className="flex items-center gap-2">
          <div className="flex overflow-hidden rounded-md border border-dash-border">
            {orderButton("NEWEST", "Newest")}
            {orderButton("OLDEST", "Oldest")}
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="gap-1.5"
            onClick={() => load(order)}
            disabled={loading}
          >
            <RefreshCw
              className={`size-3.5${loading ? " animate-spin" : ""}`}
            />
            {messages ? "Refresh" : "Load"}
          </Button>
        </div>
      </div>

      {error ? (
        <p className="px-4 py-3 text-[11.5px] font-mono text-fr-rose">
          {error}
        </p>
      ) : messages === null ? (
        <p className="px-4 py-3 text-[11.5px] text-fg-faint">
          Preview the {order === "NEWEST" ? "last" : "first"} {PREVIEW_LIMIT}{" "}
          records of this topic.
        </p>
      ) : messages.length === 0 ? (
        <p className="px-4 py-3 text-[11.5px] text-fg-muted">
          No records to preview.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-[12px]">
            <thead>
              <tr className="border-b border-dash-border text-left text-fg-faint">
                <th className="px-4 py-2 font-mono text-[10px] uppercase tracking-wider">
                  Offset
                </th>
                <th className="px-4 py-2 font-mono text-[10px] uppercase tracking-wider">
                  Part
                </th>
                <th className="px-4 py-2 font-mono text-[10px] uppercase tracking-wider">
                  Time
                </th>
                {hasKeys ? (
                  <th className="px-4 py-2 font-mono text-[10px] uppercase tracking-wider">
                    Key
                  </th>
                ) : null}
                <th className="px-4 py-2 font-mono text-[10px] uppercase tracking-wider">
                  Value
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-dash-border/40">
              {messages.map((m) => (
                <tr
                  key={`${m.partition}-${m.offset}`}
                  className="align-top hover:bg-dash-elevated/30"
                >
                  <td className="px-4 py-2 font-mono text-fg-muted">
                    {m.offset}
                  </td>
                  <td className="px-4 py-2 font-mono text-fg-muted">
                    {m.partition}
                  </td>
                  <td className="whitespace-nowrap px-4 py-2 font-mono text-fg-faint">
                    {new Date(m.timestamp).toLocaleTimeString()}
                  </td>
                  {hasKeys ? (
                    <td className="px-4 py-2 font-mono text-fg-muted">
                      {m.key ?? "—"}
                    </td>
                  ) : null}
                  <td className="px-4 py-2 font-mono text-fg break-all">
                    {formatValue(m.value)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
