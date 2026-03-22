"use client"

import { Command as CommandPrimitive } from "cmdk"
import { Check, ChevronsUpDown } from "lucide-react"
import { useState, useCallback } from "react"

import { cn } from "../../lib/cn"

/* ── Types ─────────────────────────────────────────────────────────────────── */

interface ComboboxOption {
  value: string
  label: string
  disabled?: boolean
}

interface ComboboxGroup {
  label: string
  options: ComboboxOption[]
}

interface ComboboxProps {
  options: (ComboboxOption | ComboboxGroup)[]
  value?: string
  onValueChange?: (value: string) => void
  placeholder?: string
  searchPlaceholder?: string
  emptyMessage?: string
  className?: string
  disabled?: boolean
}

/* ── Helpers ───────────────────────────────────────────────────────────────── */

function isGroup(item: ComboboxOption | ComboboxGroup): item is ComboboxGroup {
  return "options" in item
}

/* ── Component ─────────────────────────────────────────────────────────────── */

function Combobox({
  options,
  value,
  onValueChange,
  placeholder = "Select…",
  searchPlaceholder = "Search…",
  emptyMessage = "No results found.",
  className,
  disabled,
}: ComboboxProps) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState("")

  const selectedLabel = (() => {
    for (const item of options) {
      if (isGroup(item)) {
        const found = item.options.find((o) => o.value === value)
        if (found) return found.label
      } else if (item.value === value) {
        return item.label
      }
    }
    return null
  })()

  const handleSelect = useCallback(
    (selectedValue: string) => {
      onValueChange?.(selectedValue === value ? "" : selectedValue)
      setOpen(false)
      setSearch("")
    },
    [onValueChange, value],
  )

  return (
    <div className={cn("relative", className)}>
      <button
        type="button"
        role="combobox"
        aria-expanded={open}
        disabled={disabled}
        onClick={() => setOpen(!open)}
        className="flex h-8 w-full items-center justify-between gap-2 rounded-md border border-dash-border bg-dash-surface px-3 py-1.5 text-sm text-zinc-200 transition-colors placeholder:text-zinc-500 focus:border-fr-purple focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
      >
        <span className={cn(!selectedLabel && "text-zinc-500")}>
          {selectedLabel ?? placeholder}
        </span>
        <ChevronsUpDown className="size-3.5 shrink-0 text-zinc-500" />
      </button>
      {open && (
        <div className="absolute top-full z-50 mt-1 w-full rounded-md border border-dash-border bg-dash-panel shadow-md shadow-black/50">
          <CommandPrimitive
            className="flex flex-col"
            filter={(value, search) =>
              value.toLowerCase().includes(search.toLowerCase()) ? 1 : 0
            }
          >
            <CommandPrimitive.Input
              value={search}
              onValueChange={setSearch}
              placeholder={searchPlaceholder}
              className="border-b border-dash-border bg-transparent px-3 py-2 text-sm text-zinc-200 outline-none placeholder:text-zinc-500"
            />
            <CommandPrimitive.List className="max-h-60 overflow-y-auto p-1">
              <CommandPrimitive.Empty className="px-3 py-4 text-center text-sm text-fg-muted">
                {emptyMessage}
              </CommandPrimitive.Empty>
              {options.map((item) =>
                isGroup(item) ? (
                  <CommandPrimitive.Group
                    key={item.label}
                    heading={item.label}
                    className="[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:text-zinc-500"
                  >
                    {item.options.map((opt) => (
                      <CommandPrimitive.Item
                        key={opt.value}
                        value={opt.label}
                        disabled={opt.disabled}
                        onSelect={() => handleSelect(opt.value)}
                        className="relative flex cursor-default select-none items-center rounded-sm py-1.5 pl-7 pr-2 text-sm text-zinc-300 outline-none data-[selected=true]:bg-white/[0.08] data-[selected=true]:text-white data-[disabled=true]:pointer-events-none data-[disabled=true]:opacity-50"
                      >
                        <span className="absolute left-2 flex size-3.5 items-center justify-center">
                          {value === opt.value && (
                            <Check className="size-3.5" />
                          )}
                        </span>
                        {opt.label}
                      </CommandPrimitive.Item>
                    ))}
                  </CommandPrimitive.Group>
                ) : (
                  <CommandPrimitive.Item
                    key={item.value}
                    value={item.label}
                    disabled={item.disabled}
                    onSelect={() => handleSelect(item.value)}
                    className="relative flex cursor-default select-none items-center rounded-sm py-1.5 pl-7 pr-2 text-sm text-zinc-300 outline-none data-[selected=true]:bg-white/[0.08] data-[selected=true]:text-white data-[disabled=true]:pointer-events-none data-[disabled=true]:opacity-50"
                  >
                    <span className="absolute left-2 flex size-3.5 items-center justify-center">
                      {value === item.value && (
                        <Check className="size-3.5" />
                      )}
                    </span>
                    {item.label}
                  </CommandPrimitive.Item>
                ),
              )}
            </CommandPrimitive.List>
          </CommandPrimitive>
        </div>
      )}
    </div>
  )
}

export { Combobox }
export type { ComboboxProps, ComboboxOption, ComboboxGroup }
