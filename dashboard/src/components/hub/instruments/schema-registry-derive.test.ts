import { describe, expect, it } from "vitest"
import type { SchemaSubject } from "@/lib/instruments-data"
import {
  compatRank,
  conflictSubjects,
  isSubjectConflict,
  registryKpis,
  subjectTopic,
} from "./schema-registry-derive"

function subject(over: Partial<SchemaSubject>): SchemaSubject {
  return {
    name: "s",
    latestVersion: 1,
    schemaType: "AVRO",
    schemaId: 1,
    compatibility: "BACKWARD",
    ...over,
  }
}

describe("compatRank", () => {
  it("orders levels by strength and is case-insensitive", () => {
    expect(compatRank("none")).toBe(0)
    expect(compatRank("BACKWARD")).toBe(1)
    expect(compatRank("FORWARD")).toBe(1)
    expect(compatRank("BACKWARD_TRANSITIVE")).toBe(2)
    expect(compatRank("FULL")).toBe(3)
    expect(compatRank("FULL_TRANSITIVE")).toBe(4)
  })

  it("returns null for unknown/blank levels", () => {
    expect(compatRank("")).toBeNull()
    expect(compatRank("WEIRD")).toBeNull()
  })
})

describe("isSubjectConflict", () => {
  it("flags NONE as unguarded", () => {
    expect(
      isSubjectConflict(subject({ compatibility: "NONE" }), "BACKWARD"),
    ).toBe(true)
  })

  it("flags a subject weaker than the default", () => {
    expect(
      isSubjectConflict(subject({ compatibility: "BACKWARD" }), "FULL"),
    ).toBe(true)
  })

  it("does not flag a subject at least as strong as the default", () => {
    expect(
      isSubjectConflict(subject({ compatibility: "FULL" }), "BACKWARD"),
    ).toBe(false)
    expect(
      isSubjectConflict(subject({ compatibility: "BACKWARD" }), "BACKWARD"),
    ).toBe(false)
  })

  it("does not flag unknown levels (except NONE) or an unknown default", () => {
    expect(isSubjectConflict(subject({ compatibility: "WEIRD" }), "FULL")).toBe(
      false,
    )
    expect(isSubjectConflict(subject({ compatibility: "BACKWARD" }), "")).toBe(
      false,
    )
  })
})

describe("conflictSubjects + registryKpis", () => {
  const subjects = [
    subject({ name: "a", compatibility: "FULL", latestVersion: 3 }),
    subject({ name: "b", compatibility: "NONE", latestVersion: 5 }),
    subject({ name: "c", compatibility: "BACKWARD", latestVersion: 2 }),
  ]

  it("collects conflicting subjects", () => {
    // default FULL: b (NONE) and c (BACKWARD < FULL) conflict; a (FULL) does not
    expect(conflictSubjects(subjects, "FULL").map((s) => s.name)).toEqual([
      "b",
      "c",
    ])
  })

  it("derives KPI counts and version sum", () => {
    expect(registryKpis(subjects, "FULL")).toEqual({
      subjects: 3,
      versions: 10,
      defaultCompat: "FULL",
      conflicts: 2,
    })
  })

  it("uses an em dash when the default is unknown", () => {
    expect(registryKpis([], "").defaultCompat).toBe("—")
  })
})

describe("subjectTopic", () => {
  it("strips the -value/-key suffix", () => {
    expect(subjectTopic("events.orders-value")).toBe("events.orders")
    expect(subjectTopic("events.orders-key")).toBe("events.orders")
  })

  it("returns null when the subject does not follow the convention", () => {
    expect(subjectTopic("events.orders")).toBeNull()
    expect(subjectTopic("plain")).toBeNull()
  })
})
