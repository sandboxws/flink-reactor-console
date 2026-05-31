import { describe, expect, it } from "vitest"
import {
  mapCompatibilityReport,
  mapManifestVersion,
  mapPipelineSummary,
  mapRestoreEvent,
} from "./compatibility-mappers"
import {
  categoryLabel,
  outcomeTone,
  restoreSuccessRate,
  severityTone,
  shortFingerprint,
  verdictTone,
} from "./compatibility-types"

describe("compatibility mappers", () => {
  it("passes through a known verdict", () => {
    const r = mapCompatibilityReport({
      pipeline: "orders",
      environment: "prod",
      verdict: "WARNING",
      canProceed: true,
      issues: null,
      checkedAt: null,
      checkId: null,
    })
    expect(r.verdict).toBe("WARNING")
    // null issues normalize to an empty array.
    expect(r.issues).toEqual([])
  })

  it("fails closed: an unknown verdict maps to INCOMPATIBLE", () => {
    const r = mapCompatibilityReport({
      pipeline: "orders",
      environment: "prod",
      verdict: "GIBBERISH",
      canProceed: true,
      issues: [],
      checkedAt: null,
      checkId: null,
    })
    expect(r.verdict).toBe("INCOMPATIBLE")
  })

  it("normalizes an unknown restore outcome to UNKNOWN", () => {
    const ev = mapRestoreEvent({
      id: "1",
      pipeline: "orders",
      environment: "prod",
      cluster: "c1",
      jid: "abc",
      outcome: "WAT",
      errorCategory: null,
      restoredCheckpointId: null,
      blueGreenName: null,
      observedAt: "2026-01-01T00:00:00Z",
    })
    expect(ev.outcome).toBe("UNKNOWN")
  })

  it("keeps a null lastVerdict null (no check yet)", () => {
    const s = mapPipelineSummary({
      pipeline: "orders",
      environment: "prod",
      latestVersion: 3,
      versionCount: 3,
      stateFingerprint: "a3f1deadbeef",
      flinkVersion: "1.20.0",
      lastVerdict: null,
      lastCheckedAt: null,
      lastIssueCount: null,
      restoreTotal: 0,
      restoreSuccess: 0,
      updatedAt: "2026-01-01T00:00:00Z",
    })
    expect(s.lastVerdict).toBeNull()
    expect(s.latestVersion).toBe(3)
  })

  it("preserves the canonical manifest JSON for diffing", () => {
    const v = mapManifestVersion({
      id: "7",
      pipeline: "orders",
      environment: "prod",
      version: 7,
      flinkVersion: null,
      stateFingerprint: "9c0b",
      source: "cli",
      createdAt: "2026-01-01T00:00:00Z",
      manifestJson: '{"operators":[]}',
    })
    expect(v.manifestJson).toBe('{"operators":[]}')
  })
})

describe("compatibility presentation helpers", () => {
  it("maps verdicts to SevBadge tones", () => {
    expect(verdictTone("COMPATIBLE")).toBe("ok")
    expect(verdictTone("WARNING")).toBe("warn")
    expect(verdictTone("INCOMPATIBLE")).toBe("fail")
  })

  it("maps severities and outcomes to tones", () => {
    expect(severityTone("ERROR")).toBe("fail")
    expect(severityTone("WARNING")).toBe("warn")
    expect(outcomeTone("SUCCESS")).toBe("ok")
    expect(outcomeTone("FAILED")).toBe("fail")
    expect(outcomeTone("PENDING")).toBe("muted")
    expect(outcomeTone("UNKNOWN")).toBe("info")
  })

  it("computes restore success rate, null when no restores", () => {
    expect(
      restoreSuccessRate({ restoreTotal: 0, restoreSuccess: 0 }),
    ).toBeNull()
    expect(restoreSuccessRate({ restoreTotal: 25, restoreSuccess: 24 })).toBe(
      96,
    )
    expect(restoreSuccessRate({ restoreTotal: 4, restoreSuccess: 1 })).toBe(25)
  })

  it("labels known categories and passes through unknown ones", () => {
    expect(categoryLabel("MAX_PARALLELISM")).toBe("Max parallelism")
    expect(categoryLabel("SERIALIZER")).toBe("Serializer")
    expect(categoryLabel("SOMETHING_NEW")).toBe("SOMETHING_NEW")
  })

  it("shortens long fingerprints only", () => {
    expect(shortFingerprint("abc")).toBe("abc")
    expect(shortFingerprint("a3f1deadbeefcafe1234")).toBe("a3f1deadbe")
  })
})
