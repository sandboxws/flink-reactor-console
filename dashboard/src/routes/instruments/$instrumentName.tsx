import { InstrumentDetailRoute } from "@flink-reactor/instruments-ui"
import {
  createFileRoute,
  Link,
  Outlet,
  useLocation,
} from "@tanstack/react-router"

export const Route = createFileRoute("/instruments/$instrumentName")({
  component: () => {
    const { instrumentName } = Route.useParams()
    const pathname = useLocation({ select: (l) => l.pathname })
    return (
      <InstrumentDetailRoute
        instrumentName={instrumentName}
        activePath={pathname}
        LinkComponent={Link}
      >
        <Outlet />
      </InstrumentDetailRoute>
    )
  },
})
