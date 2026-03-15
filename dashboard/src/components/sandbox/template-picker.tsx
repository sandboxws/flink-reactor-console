import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { TEMPLATES, type TemplateId } from "./templates"

interface TemplatPickerProps {
  value: TemplateId | null
  onSelect: (id: TemplateId) => void
}

export function TemplatePicker({ value, onSelect }: TemplatPickerProps) {
  return (
    <Select
      value={value ?? undefined}
      onValueChange={(v) => onSelect(v as TemplateId)}
    >
      <SelectTrigger className="h-7 w-52 text-xs">
        <SelectValue placeholder="Select a template…" />
      </SelectTrigger>
      <SelectContent>
        {TEMPLATES.map((t) => (
          <SelectItem key={t.id} value={t.id}>
            <div className="flex flex-col">
              <span>{t.name}</span>
              <span className="text-[10px] text-zinc-500">{t.description}</span>
            </div>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
