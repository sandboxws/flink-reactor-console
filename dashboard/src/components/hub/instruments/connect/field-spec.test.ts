import { describe, expect, it } from "vitest"
import {
  buildConfig,
  maskSecrets,
  requiredMissing,
  SECRET_PLACEHOLDER,
  toYaml,
} from "./field-spec"

describe("buildConfig", () => {
  it("builds a kafka config with a list and an enabled group", () => {
    const config = buildConfig("kafka", {
      brokers: "localhost:9092, broker2:9092",
      "sasl.mechanism": "SCRAM-SHA-512",
      "sasl.username": "svc",
      "sasl.password": "hunter2",
    })
    expect(config).toEqual({
      brokers: ["localhost:9092", "broker2:9092"],
      sasl: {
        mechanism: "SCRAM-SHA-512",
        username: "svc",
        password: "hunter2",
      },
    })
  })

  it("omits untouched optional groups and coerces numbers", () => {
    const config = buildConfig("database", {
      dsn: "postgres://localhost/db",
      driver: "postgres",
      statementTimeout: "5000",
      maxRows: "1000",
    })
    expect(config).toEqual({
      dsn: "postgres://localhost/db",
      driver: "postgres",
      statementTimeout: 5000,
      maxRows: 1000,
    })
  })

  it("injects enabled: true for a filled TLS group", () => {
    const config = buildConfig("kafka", {
      brokers: "localhost:9092",
      "tls.caCert": "/etc/ca.pem",
    })
    expect(config.tls).toEqual({ enabled: true, caCert: "/etc/ca.pem" })
  })

  it("parses key=value properties for datalake", () => {
    const config = buildConfig("datalake", {
      catalogType: "iceberg-rest",
      properties:
        "warehouse=s3://x\nio-impl=org.apache.iceberg.aws.s3.S3FileIO",
    })
    expect(config.properties).toEqual({
      warehouse: "s3://x",
      "io-impl": "org.apache.iceberg.aws.s3.S3FileIO",
    })
  })
})

describe("requiredMissing", () => {
  it("reports a missing required top-level field", () => {
    expect(requiredMissing("kafka", {})).toContain("Brokers")
  })

  it("reports required group fields only once the group is touched", () => {
    // untouched SASL group → no group requirements
    expect(requiredMissing("kafka", { brokers: "x:9092" })).toEqual([])
    // touched (username only) → mechanism + password required
    const missing = requiredMissing("kafka", {
      brokers: "x:9092",
      "sasl.username": "svc",
    })
    expect(missing).toContain("SASL · Mechanism")
    expect(missing).toContain("SASL · Password")
  })
})

describe("maskSecrets + toYaml", () => {
  it("masks nested and top-level secrets", () => {
    const config = buildConfig("kafka", {
      brokers: "localhost:9092",
      "sasl.mechanism": "PLAIN",
      "sasl.username": "svc",
      "sasl.password": "hunter2",
    })
    const masked = maskSecrets("kafka", config)
    expect((masked.sasl as Record<string, unknown>).password).toBe(
      SECRET_PLACEHOLDER,
    )
    // original is not mutated
    expect((config.sasl as Record<string, unknown>).password).toBe("hunter2")
  })

  it("emits a valid instruments YAML block with masked secrets", () => {
    const config = buildConfig("kafka", {
      brokers: "localhost:9092, broker2:9092",
      "sasl.mechanism": "PLAIN",
      "sasl.username": "svc",
      "sasl.password": "hunter2",
    })
    const yaml = toYaml("kafka", "prod-kafka", config)
    expect(yaml).toContain("instruments:")
    expect(yaml).toContain('  - type: "kafka"')
    expect(yaml).toContain('    name: "prod-kafka"')
    expect(yaml).toContain('      - "localhost:9092"')
    expect(yaml).toContain(`password: "${SECRET_PLACEHOLDER}"`)
    expect(yaml).not.toContain("hunter2")
  })

  it("can emit unmasked YAML when explicitly asked", () => {
    const config = buildConfig("redis", {
      addr: "localhost:6379",
      password: "p",
    })
    expect(toYaml("redis", "r", config, false)).toContain('password: "p"')
  })
})

describe("yugabyte instrument", () => {
  it("builds a config without a driver field (the server defaults it)", () => {
    const config = buildConfig("yugabyte", {
      dsn: "postgres://yugabyte:yugabyte@host:5433/yugabyte",
      statementTimeout: "5000",
      maxRows: "1000",
    })
    expect(config).toEqual({
      dsn: "postgres://yugabyte:yugabyte@host:5433/yugabyte",
      statementTimeout: 5000,
      maxRows: 1000,
    })
    expect(config).not.toHaveProperty("driver")
  })

  it("reports a missing DSN as required", () => {
    expect(requiredMissing("yugabyte", {})).toContain("DSN")
  })

  it("masks the DSN secret in emitted YAML", () => {
    const config = buildConfig("yugabyte", {
      dsn: "postgres://yugabyte:secretpw@host:5433/yugabyte",
    })
    const yaml = toYaml("yugabyte", "prod-yb", config)
    expect(yaml).toContain('  - type: "yugabyte"')
    expect(yaml).toContain(`dsn: "${SECRET_PLACEHOLDER}"`)
    expect(yaml).not.toContain("secretpw")
  })
})
