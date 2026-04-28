import { CompatibilityChecker } from "../components/schemaregistry/compatibility-checker"

export function SchemaRegistryCompatibilityRoute({
  instrumentName,
}: {
  instrumentName: string
}) {
  return <CompatibilityChecker instrumentName={instrumentName} />
}
