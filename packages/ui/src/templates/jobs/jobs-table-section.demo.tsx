"use client"

/**
 * JobsTableSection demo — renders the filterable jobs table
 * with a mix of running and completed fixture jobs.
 */

import { JobsTableSection } from "./jobs-table-section"
import { createFlinkJob } from "../../fixtures"

export function JobsTableSectionDemo() {
  const jobs = [
    createFlinkJob({ name: "ecommerce-order-enrichment", status: "RUNNING" }),
    createFlinkJob({
      name: "user-activity-aggregation",
      status: "RUNNING",
      id: "job-002",
    }),
    createFlinkJob({
      name: "fraud-detection-pipeline",
      status: "FINISHED",
      id: "job-003",
      endTime: new Date(Date.now() - 7_200_000),
    }),
    createFlinkJob({
      name: "session-windowing",
      status: "CANCELED",
      id: "job-004",
      endTime: new Date(Date.now() - 3_600_000),
    }),
    createFlinkJob({
      name: "clickstream-etl",
      status: "FAILED",
      id: "job-005",
      endTime: new Date(Date.now() - 1_800_000),
    }),
  ]

  return (
    <JobsTableSection
      jobs={jobs}
      onJobClick={(id) => console.log("Navigate to job:", id)}
      onCancelJob={(id) => console.log("Cancel job:", id)}
    />
  )
}
