import type { LucideIcon } from "lucide-react"
import {
  Activity,
  Container,
  Database,
  HardDrive,
  Layers,
  MessageSquare,
  Network,
  Waves,
} from "lucide-react"
import type { InstrumentType } from "../types"

const INSTRUMENT_ICON_MAP: Record<InstrumentType, LucideIcon> = {
  kafka: Waves,
  database: Database,
  kubernetes: Container,
  s3: HardDrive,
  prometheus: Activity,
  redis: Network,
  schemaregistry: MessageSquare,
  fluss: Layers,
}

export function getInstrumentIcon(type: InstrumentType): LucideIcon {
  return INSTRUMENT_ICON_MAP[type] ?? Activity
}
