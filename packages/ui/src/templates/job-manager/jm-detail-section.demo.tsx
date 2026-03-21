"use client"

import { createJobManagerInfo } from "../../fixtures"
import { JmDetailSection } from "./jm-detail-section"

const info = createJobManagerInfo()

export function JmDetailSectionDemo() {
  return (
    <div className="max-w-5xl rounded-lg border border-dash-border bg-dash-surface">
      <JmDetailSection info={info} />
    </div>
  )
}
