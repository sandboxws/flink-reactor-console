/** Dashboard logging utility built on tslog. */

import { Logger } from "tslog"

/**
 * Creates a tslog logger for the dashboard client.
 * @param logLevel - Set to "debug" for verbose logging, otherwise defaults to info level.
 */
export function createClientLogger(logLevel?: string | null) {
  return new Logger({
    name: "dashboard",
    minLevel: logLevel === "debug" ? 0 : 3,
    type: "pretty",
  })
}
