"use client"

/**
 * OverviewSection demo — renders the full overview dashboard section
 * with fixture data from the healthyCluster scenario.
 */

import { OverviewSection } from "./overview-section"
import { healthyCluster } from "../../fixtures"

/** Standalone demo of the overview section with fixture data from the healthyCluster scenario. */
export function OverviewSectionDemo() {
  const scenario = healthyCluster()

  return (
    <OverviewSection
      overview={scenario.overview}
      runningJobs={scenario.jobs.filter((j) => j.status === "RUNNING")}
      completedJobs={scenario.jobs.filter((j) => j.status !== "RUNNING")}
      onJobClick={(id) => console.log("Job clicked:", id)}
      onRefresh={() => console.log("Refresh clicked")}
    />
  )
}
