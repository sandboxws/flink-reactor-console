import { InstrumentsIndexRoute } from "@flink-reactor/instruments-ui"
import { createFileRoute, Link } from "@tanstack/react-router"

/** Route: /instruments — Instruments list powered by the instruments-ui package. */
export const Route = createFileRoute("/instruments/")({
  component: () => <InstrumentsIndexRoute LinkComponent={Link} />,
})
