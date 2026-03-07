import { Logger } from "tslog"

export function createClientLogger(logLevel?: string | null) {
  return new Logger({
    name: "dashboard",
    minLevel: logLevel === "debug" ? 0 : 3,
    type: "pretty",
  })
}
