import { InstrumentsIndexRoute } from "@flink-reactor/instruments-ui"
import { createFileRoute, Link } from "@tanstack/react-router"

export const Route = createFileRoute("/instruments/")({
  component: () => <InstrumentsIndexRoute LinkComponent={Link} />,
})
