import {
  Select,
  SelectContent,
  SelectTrigger,
  SelectValue,
} from "@flink-reactor/ui"
import * as SelectPrimitive from "@radix-ui/react-select"
import { Check } from "lucide-react"
import { TEMPLATES, type TemplateId } from "./templates"

interface TemplatePickerProps {
  value: TemplateId | null
  onSelect: (id: TemplateId) => void
}

export function TemplatePicker({ value, onSelect }: TemplatePickerProps) {
  return (
    <Select
      key={value ?? "__empty__"}
      value={value ?? undefined}
      onValueChange={(v) => onSelect(v as TemplateId)}
    >
      <SelectTrigger className="h-7 w-64 text-xs">
        <SelectValue placeholder="Select a template…" />
      </SelectTrigger>
      <SelectContent>
        {TEMPLATES.map((t) => (
          <SelectPrimitive.Item
            key={t.id}
            value={t.id}
            className="relative flex w-full cursor-default select-none flex-col rounded-sm py-1.5 pl-7 pr-2 text-sm text-zinc-300 outline-none focus:bg-white/[0.08] focus:text-white"
          >
            <span className="absolute left-2 top-2 flex size-3.5 items-center justify-center">
              <SelectPrimitive.ItemIndicator>
                <Check className="size-3.5" />
              </SelectPrimitive.ItemIndicator>
            </span>
            <SelectPrimitive.ItemText>{t.name}</SelectPrimitive.ItemText>
            <span className="text-[10px] text-zinc-500">{t.description}</span>
          </SelectPrimitive.Item>
        ))}
      </SelectContent>
    </Select>
  )
}
