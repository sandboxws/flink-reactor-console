"use client"

/**
 * JobGraphSection demo — renders the plan vertices/edges view
 * with a fixture job that has a 4-operator plan.
 */

import { JobGraphSection } from "./job-graph-section"
import { createFlinkJob } from "../../fixtures"

export function JobGraphSectionDemo() {
  const job = createFlinkJob({ name: "ecommerce-order-enrichment" })

  return <JobGraphSection job={job} />
}
