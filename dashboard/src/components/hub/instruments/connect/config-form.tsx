/**
 * ConfigForm — renders the step-2 fields for the selected instrument type from
 * the declarative field spec. Emits flat, dotted-key form values (`sasl.username`)
 * that `buildConfig` reassembles into the nested config object.
 */

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@flink-reactor/ui"
import type { FieldDef } from "./field-spec"
import { INSTRUMENT_FIELD_SPECS } from "./field-spec"

interface FormFieldProps {
  label: string
  required?: boolean
  help?: string
  children: React.ReactNode
}

/** A labelled field. The control nests inside the label for accessibility. */
export function FormField({ label, required, help, children }: FormFieldProps) {
  return (
    // biome-ignore lint/a11y/noLabelWithoutControl: the form control is passed in as `children` and nested inside this label, which biome can't detect statically
    <label className="block space-y-1">
      <span className="form-label">
        {label}
        {required ? <span className="text-fr-coral"> *</span> : null}
      </span>
      {children}
      {help ? <span className="form-help block">{help}</span> : null}
    </label>
  )
}

interface ConfigFormProps {
  type: string
  values: Record<string, string>
  onChange: (key: string, value: string) => void
}

export function ConfigForm({ type, values, onChange }: ConfigFormProps) {
  const spec = INSTRUMENT_FIELD_SPECS[type] ?? []
  return (
    <div className="space-y-4">
      {spec.map((field) =>
        field.kind === "group" ? (
          <GroupField
            key={field.key}
            field={field}
            values={values}
            onChange={onChange}
          />
        ) : (
          <FieldInput
            key={field.key}
            field={field}
            path={field.key}
            values={values}
            onChange={onChange}
          />
        ),
      )}
    </div>
  )
}

function GroupField({
  field,
  values,
  onChange,
}: {
  field: FieldDef
  values: Record<string, string>
  onChange: (key: string, value: string) => void
}) {
  return (
    <fieldset className="rounded-md border border-dash-border p-3">
      <legend className="px-1 font-mono text-[10px] uppercase tracking-wider text-fg-faint">
        {field.label} · optional
      </legend>
      <div className="space-y-3">
        {(field.fields ?? []).map((sub) => (
          <FieldInput
            key={sub.key}
            field={sub}
            path={`${field.key}.${sub.key}`}
            values={values}
            onChange={onChange}
          />
        ))}
      </div>
    </fieldset>
  )
}

function FieldInput({
  field,
  path,
  values,
  onChange,
}: {
  field: FieldDef
  path: string
  values: Record<string, string>
  onChange: (key: string, value: string) => void
}) {
  const value = values[path] ?? ""

  if (field.kind === "select") {
    return (
      <FormField
        label={field.label}
        required={field.required}
        help={field.help}
      >
        <Select
          value={value || undefined}
          onValueChange={(v) => onChange(path, v)}
        >
          <SelectTrigger className="bg-dash-panel border-dash-border">
            <SelectValue placeholder="Select…" />
          </SelectTrigger>
          <SelectContent className="bg-dash-panel border-dash-border">
            {(field.options ?? []).map((o) => (
              <SelectItem key={o} value={o}>
                {o}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </FormField>
    )
  }

  if (field.kind === "keyvalue") {
    return (
      <FormField
        label={field.label}
        required={field.required}
        help={field.help}
      >
        <textarea
          className="form-input form-textarea mono"
          rows={3}
          value={value}
          placeholder="key=value"
          onChange={(e) => onChange(path, e.target.value)}
        />
      </FormField>
    )
  }

  const inputType =
    field.kind === "secret"
      ? "password"
      : field.kind === "number"
        ? "number"
        : "text"

  return (
    <FormField label={field.label} required={field.required} help={field.help}>
      <input
        type={inputType}
        className="form-input mono"
        value={value}
        placeholder={field.placeholder}
        onChange={(e) => onChange(path, e.target.value)}
      />
    </FormField>
  )
}
