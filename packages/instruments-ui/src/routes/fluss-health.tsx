import { FlussTabletServerHealth } from "../components/fluss/fluss-tablet-server-health"

export function FlussHealthRoute({
  instrumentName,
}: {
  instrumentName: string
}) {
  return <FlussTabletServerHealth instrumentName={instrumentName} />
}
