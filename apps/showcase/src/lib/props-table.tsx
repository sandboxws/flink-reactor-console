import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@flink-reactor/ui"

export type PropDef = {
  name: string
  type: string
  default?: string
  description: string
}

/** Renders a documentation table showing component prop names, types, defaults, and descriptions. */
export function PropsTable({ props }: { props: PropDef[] }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="w-[140px]">Prop</TableHead>
          <TableHead className="w-[180px]">Type</TableHead>
          <TableHead className="w-[100px]">Default</TableHead>
          <TableHead>Description</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {props.map((p) => (
          <TableRow key={p.name}>
            <TableCell className="font-mono text-xs text-fr-purple">
              {p.name}
            </TableCell>
            <TableCell className="font-mono text-xs text-fg-secondary">
              {p.type}
            </TableCell>
            <TableCell className="font-mono text-xs text-fg-muted">
              {p.default ?? "—"}
            </TableCell>
            <TableCell className="text-sm text-fg-muted">
              {p.description}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}
