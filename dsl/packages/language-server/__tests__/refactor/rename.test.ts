// Schema-column + node-name rename and the prepareRename gate
// (component-refactoring, tasks 10.1–10.4, 10.10–10.11).

import { describe, expect, it } from "vitest"
import { newFindings } from "../../src/refactor/parity"
import { prepareRenameAt, renameAt } from "../../src/refactor/prepare-rename"
import { applyAndResynthesize, type Loaded, load, posAt } from "./load"

function renameInput(loaded: Loaded, marker: string, delta = 0) {
  return {
    state: loaded.state,
    sourceText: loaded.text,
    uri: loaded.uri,
    position: posAt(loaded.text, marker, delta),
    documentVersion: 1,
  }
}

describe("schema-column rename", () => {
  // 10.1 — declaration + every flow-scoped reference rewritten; the Map's
  // projection KEY (its own output name) is left alone; re-synthesis is clean.
  it("renames the field declaration, PK entry, and downstream references", async () => {
    const f = await load("refactor-rename-pipeline.tsx")
    const edit = renameAt(
      renameInput(f, "user_id: Field.BIGINT()", 2),
      "account_id",
    )
    expect(edit).not.toBeNull()
    if (!edit) return

    const { text, result } = await applyAndResynthesize(f, edit)
    // Declaration key + primaryKey entry.
    expect(text).toContain("account_id: Field.BIGINT()")
    expect(text).toContain('primaryKey: { columns: ["account_id"] }')
    // Filter back-quoted reference.
    expect(text).toContain("`account_id` IS NOT NULL")
    // Map VALUE reference renamed; Map KEY (its own output column) untouched.
    expect(text).toContain('user_id: "`account_id`"')
    // The unrelated column is untouched.
    expect(text).toContain('amount: "amount"')
    // Parity: the pipeline still synthesizes with no new schema finding.
    expect(result.ok).toBe(true)
    expect(newFindings(f.state.result, result, "schema")).toEqual([])
  })

  // 10.1 — invoking from a reference site produces the same edit set.
  it("renames when invoked on a back-quoted reference", async () => {
    const f = await load("refactor-rename-pipeline.tsx")
    const edit = renameAt(
      renameInput(f, "`user_id` IS NOT NULL", 3),
      "account_id",
    )
    expect(edit).not.toBeNull()
    if (!edit) return
    const { text, result } = await applyAndResynthesize(f, edit)
    expect(text).toContain("account_id: Field.BIGINT()")
    expect(text).toContain("`account_id` IS NOT NULL")
    expect(result.ok).toBe(true)
    expect(newFindings(f.state.result, result, "schema")).toEqual([])
  })

  // 10.2 — an identically named column in an unrelated schema's flow is
  // untouched: only the first schema's declaration and references change.
  it("leaves an identically named column of an unrelated schema untouched", async () => {
    const f = await load("refactor-two-flows-pipeline.tsx")
    // Rename the FIRST schema's user_id (its declaration site).
    const edit = renameAt(
      renameInput(f, "user_id: Field.BIGINT(),\n    amount", 2),
      "buyer_id",
    )
    expect(edit).not.toBeNull()
    if (!edit) return
    const { text, result } = await applyAndResynthesize(f, edit)
    // First flow renamed (declaration + its Filter).
    expect(text).toContain("buyer_id: Field.BIGINT()")
    expect(text).toContain("`buyer_id` > 0")
    // Second schema + its reference untouched.
    expect(text).toContain("user_id: Field.BIGINT(),\n    score")
    expect(text).toContain("`user_id` < 100")
    expect(result.ok).toBe(true)
    expect(newFindings(f.state.result, result, "schema")).toEqual([])
  })
})

describe("prepareRename gate", () => {
  // 10.3 — accepts a Schema field key and a back-quoted reference.
  it("accepts a Schema field key", async () => {
    const f = await load("refactor-rename-pipeline.tsx")
    const range = prepareRenameAt(renameInput(f, "user_id: Field.BIGINT()", 2))
    expect(range).not.toBeNull()
  })

  it("accepts a back-quoted column reference", async () => {
    const f = await load("refactor-rename-pipeline.tsx")
    const range = prepareRenameAt(renameInput(f, "`user_id` IS NOT NULL", 3))
    expect(range).not.toBeNull()
  })

  // 10.3 — rejects SQL keywords, literals, and non-FR identifiers.
  it("rejects a SQL keyword inside an expression", async () => {
    const f = await load("refactor-rename-pipeline.tsx")
    const range = prepareRenameAt(
      renameInput(f, "IS NOT NULL", 1), // cursor on `IS`
    )
    expect(range).toBeNull()
  })

  it("rejects a connector-prop literal value", async () => {
    const f = await load("refactor-rename-pipeline.tsx")
    const range = prepareRenameAt(renameInput(f, 'topic="events"', 8))
    expect(range).toBeNull()
  })

  // 10.10 — a computed expression prop holds no renamable token.
  it("rejects a column token inside a computed condition", async () => {
    const f = await load("refactor-safety-pipeline.tsx")
    const range = prepareRenameAt(
      renameInput(f, 'const condition = "`order_id` > 0"', 21),
    )
    expect(range).toBeNull()
    const edit = renameAt(
      renameInput(f, 'const condition = "`order_id` > 0"', 21),
      "id",
    )
    expect(edit).toBeNull()
  })
})

describe("node-name rename", () => {
  // 10.4 — the node's name and the dependent `from` reference are updated;
  // the unrelated `topic` literal equal to the old name is not.
  it("renames the node and its dependent reference, not unrelated literals", async () => {
    const f = await load("refactor-name-pipeline.tsx")
    const edit = renameAt(renameInput(f, 'name="customers"', 7), "clients")
    expect(edit).not.toBeNull()
    if (!edit) return
    const { text, result } = await applyAndResynthesize(f, edit)
    expect(text).toContain('name="clients"')
    expect(text).toContain('from="clients"')
    // The topic literal — same string, not a node reference — is untouched.
    expect(text).toContain('topic="customers"')
    expect(result.ok).toBe(true)
    expect(newFindings(f.state.result, result)).toEqual([])
  })

  it("prepareRename accepts the name value and rejects an invalid new name", async () => {
    const f = await load("refactor-name-pipeline.tsx")
    expect(
      prepareRenameAt(renameInput(f, 'name="customers"', 7)),
    ).not.toBeNull()
    expect(
      renameAt(renameInput(f, 'name="customers"', 7), "not a name"),
    ).toBeNull()
  })
})
