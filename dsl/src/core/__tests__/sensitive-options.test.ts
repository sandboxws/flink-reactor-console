import { describe, expect, it } from "vitest"
import {
  isSensitiveOptionKey,
  redactOptions,
  redactSqlText,
  redactUrlCredentials,
  SENSITIVE_VALUE_MASK,
} from "@/core/sensitive-options.js"

describe("isSensitiveOptionKey", () => {
  it.each([
    "password",
    "passwd",
    "properties.sasl.jaas.config",
    "s3.secret-key",
    "fs.s3a.access-key",
    "s3.access.key",
    "token",
    "auth.bearer.token",
    "ssl.keystore-password",
    "ssl.keystore.location",
    "ssl.truststore.password",
    "sslpassword",
    "apiKey",
    "api-key",
    "private-key",
    "saslPassword",
    "s3SecretKey",
    "credentials.json",
  ])("flags %s as sensitive", (key) => {
    expect(isSensitiveOptionKey(key)).toBe(true)
  })

  it.each([
    "key.format",
    "keyFields",
    "scan.startup.mode",
    "topic",
    "value.format",
    "sink.parallelism",
    "properties.bootstrap.servers",
    "format",
    "monkey",
  ])("leaves %s alone", (key) => {
    expect(isSensitiveOptionKey(key)).toBe(false)
  })
})

describe("redactOptions", () => {
  it("masks sensitive values and keeps the rest", () => {
    const out = redactOptions({
      "properties.sasl.jaas.config": "org.apache...required password=x;",
      topic: "orders",
      "scan.startup.mode": "earliest-offset",
    })

    expect(out["properties.sasl.jaas.config"]).toBe(SENSITIVE_VALUE_MASK)
    expect(out.topic).toBe("orders")
    expect(out["scan.startup.mode"]).toBe("earliest-offset")
  })

  it("scrubs URL-embedded credentials in non-sensitive values", () => {
    const out = redactOptions({
      url: "jdbc:postgresql://db:5432/app?user=app&password=hunter2",
    })

    expect(out.url).toBe(
      `jdbc:postgresql://db:5432/app?user=app&password=${SENSITIVE_VALUE_MASK}`,
    )
  })
})

describe("redactUrlCredentials", () => {
  it("masks password and sslpassword params across separators", () => {
    expect(
      redactUrlCredentials("jdbc:mysql://h/db?password=a&sslpassword=b"),
    ).toBe(
      `jdbc:mysql://h/db?password=${SENSITIVE_VALUE_MASK}&sslpassword=${SENSITIVE_VALUE_MASK}`,
    )
    expect(
      redactUrlCredentials("jdbc:sqlserver://h;databaseName=db;password=x"),
    ).toBe(
      `jdbc:sqlserver://h;databaseName=db;password=${SENSITIVE_VALUE_MASK}`,
    )
  })

  it("leaves credential-free URLs untouched", () => {
    const url = "jdbc:postgresql://db:5432/app?user=app"
    expect(redactUrlCredentials(url)).toBe(url)
  })
})

describe("redactSqlText", () => {
  const ddl = [
    "CREATE TABLE `orders` (",
    "  `id` BIGINT",
    ") WITH (",
    "  'connector' = 'kafka',",
    "  'topic' = 'orders',",
    "  'properties.sasl.jaas.config' = 'org.apache.kafka required username=\"u\" password=\"p\";',",
    "  'url' = 'jdbc:postgresql://db/app?password=hunter2'",
    ");",
  ].join("\n")

  it("masks sensitive WITH pairs and URL credentials, keeps structure", () => {
    const out = redactSqlText(ddl)

    expect(out).toContain(
      `'properties.sasl.jaas.config' = '${SENSITIVE_VALUE_MASK}'`,
    )
    expect(out).toContain(`?password=${SENSITIVE_VALUE_MASK}'`)
    expect(out).toContain("'topic' = 'orders'")
    expect(out).toContain("'connector' = 'kafka'")
    expect(out).toContain("CREATE TABLE `orders`")
  })

  it("is idempotent", () => {
    const once = redactSqlText(ddl)
    expect(redactSqlText(once)).toBe(once)
  })
})
