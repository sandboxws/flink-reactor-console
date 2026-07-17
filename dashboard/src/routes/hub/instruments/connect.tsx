/**
 * Hub Connect Instrument wizard — /hub/instruments/connect.
 *
 * A config generator: choose a connector, enter config, test the connection,
 * and copy ready-to-paste YAML. It does not persist or register the instrument.
 */

import { HubBreadcrumb } from "@flink-reactor/ui"
import { createFileRoute } from "@tanstack/react-router"
import { ConnectWizard } from "@/components/hub/instruments/connect/connect-wizard"
import { HubAppShell } from "@/lib/hub/hub-app-shell"
import { HubLink } from "@/lib/hub/hub-link"

function HubConnectInstrument() {
  return (
    <HubAppShell>
      <HubBreadcrumb
        crumbs={[
          { label: "Instruments", to: "/hub/instruments" },
          { label: "Connect" },
        ]}
        LinkComponent={HubLink}
      />
      <div className="mt-1 mb-6">
        <h1 className="font-sans text-[24px] font-semibold tracking-tight text-zinc-100">
          Connect instrument
        </h1>
        <p className="mt-0.5 text-[12px] text-fg-muted">
          Choose a connector, validate the connection, and copy ready-to-paste
          YAML config. Instruments are declared in server config — nothing is
          persisted here.
        </p>
      </div>
      <ConnectWizard />
    </HubAppShell>
  )
}

export const Route = createFileRoute("/hub/instruments/connect")({
  component: HubConnectInstrument,
})
