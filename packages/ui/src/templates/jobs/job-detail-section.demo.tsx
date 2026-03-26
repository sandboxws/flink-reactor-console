"use client"

/**
 * JobDetailSection demo — renders the tabbed job detail view
 * with a fully-populated running job fixture.
 */

import { JobDetailSection } from "./job-detail-section"
import { createFlinkJob, createFeatureFlags, createJobException } from "../../fixtures"

/** Standalone demo of the job detail section with a fully-populated running job fixture. */
export function JobDetailSectionDemo() {
  const job = createFlinkJob({
    name: "ecommerce-order-enrichment",
    status: "RUNNING",
    exceptions: [
      createJobException({
        name: "java.lang.RuntimeException",
        message: "Transient deserialization error (recovered)",
      }),
    ],
  })

  return (
    <JobDetailSection
      job={job}
      featureFlags={createFeatureFlags()}
      onBack={() => console.log("Back clicked")}
      onCancel={() => console.log("Cancel clicked")}
      onSavepoint={() => console.log("Savepoint triggered")}
    />
  )
}
