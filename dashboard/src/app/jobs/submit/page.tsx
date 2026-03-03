"use client"

import { useEffect } from "react"
import { SubmitJobPage } from "@/components/jobs/submit-job-page"
import { useClusterStore } from "@/stores/cluster-store"

export default function SubmitPage() {
  const initialize = useClusterStore((s) => s.initialize)

  useEffect(() => {
    initialize()
  }, [initialize])

  return <SubmitJobPage />
}
