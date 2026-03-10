import { createFileRoute } from "@tanstack/react-router"
import { Link } from "@tanstack/react-router"
import { InstrumentsIndexRoute } from "@flink-reactor/instruments-ui"

export const Route = createFileRoute("/instruments/")({
  component: () => <InstrumentsIndexRoute LinkComponent={Link} />,
})
