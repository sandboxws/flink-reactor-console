import { JobPageContent } from "./content"

// Static export requires at least one param — the SPA fallback on Go server
// will serve index.html for any ID not pre-rendered
export async function generateStaticParams() {
  return [{ id: "_" }]
}

export default function JobPage() {
  return <JobPageContent />
}
