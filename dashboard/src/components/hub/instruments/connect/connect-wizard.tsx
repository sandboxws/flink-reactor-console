/**
 * ConnectWizard — the config-generator flow. Numbered step cards (left) drive a
 * live validation rail (right), following `console-v2/jobs-submit.html`. It does
 * NOT persist or register the instrument: the terminal output is YAML to paste
 * into config. The connection test hits the stateless `testInstrumentConnection`
 * mutation, so it uses the real (secret-bearing) config the user entered.
 */

import { useState } from "react"
import {
  type InstrumentTestResult,
  testInstrumentConnection,
} from "@/lib/instruments-data"
import { ConfigForm, FormField } from "./config-form"
import { buildConfig, requiredMissing } from "./field-spec"
import { TypePicker } from "./type-picker"
import { ValidationRail } from "./validation-rail"
import { YamlOutput } from "./yaml-output"

export function ConnectWizard() {
  const [type, setType] = useState<string | null>(null)
  const [name, setName] = useState("")
  const [values, setValues] = useState<Record<string, string>>({})
  const [testResult, setTestResult] = useState<InstrumentTestResult | null>(
    null,
  )
  const [testing, setTesting] = useState(false)

  const nameMissing = name.trim().length === 0
  const missing = type ? requiredMissing(type, values) : []
  const canTest = type !== null && !nameMissing && missing.length === 0
  const canOutput = canTest
  const config = type ? buildConfig(type, values) : {}

  function selectType(next: string) {
    setType(next)
    setValues({})
    setTestResult(null)
  }

  function setField(key: string, value: string) {
    setValues((prev) => ({ ...prev, [key]: value }))
    setTestResult(null) // a config edit invalidates the previous test
  }

  async function runTest() {
    if (!type || !canTest) return
    setTesting(true)
    setTestResult(null)
    try {
      const res = await testInstrumentConnection(type, name, config)
      setTestResult(res)
    } catch (e) {
      setTestResult({
        ok: false,
        message: e instanceof Error ? e.message : "Test failed",
        latencyMs: null,
      })
    } finally {
      setTesting(false)
    }
  }

  return (
    <div className="grid grid-cols-12 gap-6">
      <div className="col-span-12 space-y-4 lg:col-span-8">
        <StepCard n={1} title="Choose a connector">
          <TypePicker value={type} onSelect={selectType} />
        </StepCard>

        {type ? (
          <StepCard n={2} title="Configure">
            <div className="space-y-4">
              <FormField
                label="Instrument name"
                required
                help="Unique kebab-case identifier"
              >
                <input
                  className="form-input mono"
                  value={name}
                  placeholder="prod-kafka"
                  onChange={(e) => {
                    setName(e.target.value)
                    setTestResult(null)
                  }}
                />
              </FormField>
              <ConfigForm type={type} values={values} onChange={setField} />
            </div>
          </StepCard>
        ) : null}

        {type ? (
          <StepCard n={3} title="Test connection">
            <div className="flex items-center gap-3">
              <button
                type="button"
                className="btn btn-primary btn-sm"
                disabled={!canTest || testing}
                onClick={runTest}
              >
                {testing ? "Testing…" : "Test connection"}
              </button>
              {!canTest ? (
                <span className="text-[11px] text-fg-faint">
                  Fill the required fields first.
                </span>
              ) : null}
            </div>
          </StepCard>
        ) : null}

        {canOutput ? (
          <StepCard n={4} title="Copy YAML">
            <YamlOutput type={type as string} name={name} config={config} />
          </StepCard>
        ) : null}
      </div>

      <aside className="col-span-12 lg:col-span-4">
        <ValidationRail
          type={type}
          nameMissing={nameMissing}
          missing={missing}
          testResult={testResult}
          testing={testing}
        />
      </aside>
    </div>
  )
}

function StepCard({
  n,
  title,
  children,
}: {
  n: number
  title: string
  children: React.ReactNode
}) {
  return (
    <div className="glass-card-static p-5">
      <div className="mb-4 flex items-center gap-2.5">
        <span className="flex size-6 items-center justify-center rounded-full bg-fr-coral/15 font-mono text-[11px] text-fr-coral">
          {n}
        </span>
        <h2 className="font-sans text-[15px] font-medium text-zinc-100">
          {title}
        </h2>
      </div>
      {children}
    </div>
  )
}
