import { defineConfig } from "@flink-reactor/dsl"

export default defineConfig({
  flink: { version: "1.20" },
  services: {},
  environments: {
    local: {},
  },
})
