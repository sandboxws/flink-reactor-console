import {
  Alert,
  AlertDescription,
  AlertTitle,
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
  cn,
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  HoverCard,
  HoverCardArrow,
  HoverCardContent,
  HoverCardTrigger,
  Input,
  Label,
  Popover,
  PopoverContent,
  PopoverTrigger,
  Progress,
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
  Separator,
  Skeleton,
  Switch,
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  Textarea,
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
  Spinner,
  Kbd,
  KbdGroup,
  Checkbox,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuCheckboxItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  Item,
  ItemMedia,
  ItemContent,
  ItemTitle,
  ItemDescription,
  ItemActions,
  ButtonGroup,
  InputGroup,
  InputGroupAddon,
  Field,
  FieldLabel,
  FieldDescription,
  FieldError,
  Combobox,
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@flink-reactor/ui"
import { createFileRoute } from "@tanstack/react-router"
import { ChevronsUpDown, MoreHorizontal, Copy, Trash2, Pencil, Activity, AlertCircle, Server, Search, Mail } from "lucide-react"
import { useState } from "react"
import { ImportSnippet } from "@/lib/code-sample"
import { type PropDef, PropsTable } from "@/lib/props-table"
import { Section, ShowcasePage } from "@/lib/section"

/* ─── Table of Contents items ─────────────────────────────────────────────── */
const tocItems = [
  { id: "button", label: "Button" },
  { id: "badge", label: "Badge" },
  { id: "alert", label: "Alert" },
  { id: "switch", label: "Switch" },
  { id: "progress", label: "Progress" },
  { id: "card", label: "Card" },
  { id: "input-label", label: "Input & Label" },
  { id: "textarea", label: "Textarea" },
  { id: "skeleton", label: "Skeleton" },
  { id: "separator", label: "Separator" },
  { id: "collapsible", label: "Collapsible" },
  { id: "dialog", label: "Dialog" },
  { id: "hover-card", label: "HoverCard" },
  { id: "popover", label: "Popover" },
  { id: "select", label: "Select" },
  { id: "table", label: "Table" },
  { id: "tabs", label: "Tabs" },
  { id: "tooltip", label: "Tooltip" },
  { id: "resizable", label: "Resizable" },
  { id: "spinner", label: "Spinner" },
  { id: "kbd", label: "Kbd" },
  { id: "checkbox", label: "Checkbox" },
  { id: "dropdown-menu", label: "DropdownMenu" },
  { id: "item", label: "Item" },
  { id: "button-group", label: "ButtonGroup" },
  { id: "input-group", label: "InputGroup" },
  { id: "field", label: "Field" },
  { id: "combobox", label: "Combobox" },
  { id: "sheet", label: "Sheet" },
  { id: "accordion", label: "Accordion" },
]

/* ─── Props definitions ───────────────────────────────────────────────────── */
const buttonProps: PropDef[] = [
  {
    name: "variant",
    type: '"default" | "secondary" | "destructive" | "outline" | "ghost" | "link"',
    default: '"default"',
    description: "Visual style variant",
  },
  {
    name: "size",
    type: '"default" | "sm" | "lg" | "icon"',
    default: '"default"',
    description: "Button size",
  },
  {
    name: "disabled",
    type: "boolean",
    default: "false",
    description: "Disables the button",
  },
  {
    name: "asChild",
    type: "boolean",
    default: "false",
    description:
      "Merge props onto child element instead of rendering a <button>",
  },
]

const badgeProps: PropDef[] = [
  {
    name: "variant",
    type: '"default" | "secondary" | "destructive" | "outline"',
    default: '"default"',
    description: "Visual style variant",
  },
  { name: "className", type: "string", description: "Additional CSS classes" },
]

const alertProps: PropDef[] = [
  {
    name: "variant",
    type: '"default" | "destructive"',
    default: '"default"',
    description: "Alert style variant",
  },
  { name: "className", type: "string", description: "Additional CSS classes" },
]

const switchProps: PropDef[] = [
  { name: "checked", type: "boolean", description: "Controlled checked state" },
  {
    name: "onCheckedChange",
    type: "(checked: boolean) => void",
    description: "Called when checked state changes",
  },
  {
    name: "disabled",
    type: "boolean",
    default: "false",
    description: "Disables the switch",
  },
  {
    name: "defaultChecked",
    type: "boolean",
    description: "Initial checked state (uncontrolled)",
  },
]

const progressProps: PropDef[] = [
  {
    name: "value",
    type: "number",
    default: "0",
    description: "Current progress value (0-100)",
  },
  {
    name: "max",
    type: "number",
    default: "100",
    description: "Maximum progress value",
  },
  { name: "className", type: "string", description: "Additional CSS classes" },
]

const cardProps: PropDef[] = [
  {
    name: "size",
    type: '"compact" | "default" | "lg"',
    default: '"default"',
    description: "Size variant — cascades padding to sub-components",
  },
  { name: "className", type: "string", description: "Additional CSS classes" },
  {
    name: "children",
    type: "ReactNode",
    description: "Card content (CardHeader, CardContent, CardFooter, etc.)",
  },
]

const inputProps: PropDef[] = [
  {
    name: "type",
    type: "string",
    default: '"text"',
    description: "HTML input type",
  },
  { name: "placeholder", type: "string", description: "Placeholder text" },
  {
    name: "disabled",
    type: "boolean",
    default: "false",
    description: "Disables the input",
  },
  { name: "className", type: "string", description: "Additional CSS classes" },
]

const labelProps: PropDef[] = [
  {
    name: "htmlFor",
    type: "string",
    description: "ID of the associated form element",
  },
  { name: "className", type: "string", description: "Additional CSS classes" },
]

const textareaProps: PropDef[] = [
  { name: "placeholder", type: "string", description: "Placeholder text" },
  { name: "rows", type: "number", description: "Number of visible text rows" },
  {
    name: "disabled",
    type: "boolean",
    default: "false",
    description: "Disables the textarea",
  },
  { name: "className", type: "string", description: "Additional CSS classes" },
]

const skeletonProps: PropDef[] = [
  {
    name: "variant",
    type: '"default" | "text" | "heading" | "avatar" | "card"',
    default: '"default"',
    description: "Shape preset — sets dimensions and border-radius",
  },
  {
    name: "className",
    type: "string",
    description:
      "Width, height, and shape via Tailwind classes (e.g. h-4 w-3/4 rounded-full)",
  },
]

const separatorProps: PropDef[] = [
  {
    name: "orientation",
    type: '"horizontal" | "vertical"',
    default: '"horizontal"',
    description: "Direction of the separator",
  },
  {
    name: "decorative",
    type: "boolean",
    default: "true",
    description:
      "Whether the separator is purely decorative (removes from accessibility tree)",
  },
]

const collapsibleProps: PropDef[] = [
  { name: "open", type: "boolean", description: "Controlled open state" },
  {
    name: "onOpenChange",
    type: "(open: boolean) => void",
    description: "Called when open state changes",
  },
  {
    name: "defaultOpen",
    type: "boolean",
    default: "false",
    description: "Initial open state (uncontrolled)",
  },
  {
    name: "disabled",
    type: "boolean",
    default: "false",
    description: "Prevents user interaction",
  },
]

const dialogProps: PropDef[] = [
  { name: "open", type: "boolean", description: "Controlled open state" },
  {
    name: "onOpenChange",
    type: "(open: boolean) => void",
    description: "Called when open state changes",
  },
  {
    name: "modal",
    type: "boolean",
    default: "true",
    description: "Whether interaction outside the dialog is blocked",
  },
]

const hoverCardProps: PropDef[] = [
  {
    name: "openDelay",
    type: "number",
    default: "700",
    description: "Delay in ms before opening",
  },
  {
    name: "closeDelay",
    type: "number",
    default: "300",
    description: "Delay in ms before closing",
  },
  { name: "open", type: "boolean", description: "Controlled open state" },
  {
    name: "onOpenChange",
    type: "(open: boolean) => void",
    description: "Called when open state changes",
  },
]

const popoverProps: PropDef[] = [
  { name: "open", type: "boolean", description: "Controlled open state" },
  {
    name: "onOpenChange",
    type: "(open: boolean) => void",
    description: "Called when open state changes",
  },
  {
    name: "modal",
    type: "boolean",
    default: "false",
    description: "Whether interaction outside is blocked",
  },
]

const selectProps: PropDef[] = [
  { name: "value", type: "string", description: "Controlled selected value" },
  {
    name: "onValueChange",
    type: "(value: string) => void",
    description: "Called when selection changes",
  },
  {
    name: "defaultValue",
    type: "string",
    description: "Initial value (uncontrolled)",
  },
  {
    name: "disabled",
    type: "boolean",
    default: "false",
    description: "Disables the select",
  },
]

const tableProps: PropDef[] = [
  {
    name: "className",
    type: "string",
    description: "Additional CSS classes on the <table> element",
  },
  {
    name: "children",
    type: "ReactNode",
    description:
      "Compound sub-components: TableHeader, TableBody, TableFooter, TableRow, TableHead, TableCell, TableCaption",
  },
]

const tabsProps: PropDef[] = [
  { name: "value", type: "string", description: "Controlled active tab value" },
  {
    name: "onValueChange",
    type: "(value: string) => void",
    description: "Called when active tab changes",
  },
  {
    name: "defaultValue",
    type: "string",
    description: "Initial active tab (uncontrolled)",
  },
  {
    name: "orientation",
    type: '"horizontal" | "vertical"',
    default: '"horizontal"',
    description: "Orientation of the tabs",
  },
]

const tooltipProps: PropDef[] = [
  {
    name: "delayDuration",
    type: "number",
    default: "200",
    description: "Delay in ms before the tooltip opens",
  },
  {
    name: "side",
    type: '"top" | "right" | "bottom" | "left"',
    default: '"top"',
    description: "Preferred side of the trigger to render",
  },
  {
    name: "sideOffset",
    type: "number",
    default: "0",
    description: "Distance in px from the trigger",
  },
]

const resizableProps: PropDef[] = [
  {
    name: "orientation",
    type: '"horizontal" | "vertical"',
    description: "Direction of the panel group layout",
  },
  {
    name: "defaultSize",
    type: "number",
    description: "Default size of a panel as a percentage (0-100)",
  },
  {
    name: "minSize",
    type: "number",
    description: "Minimum size of a panel as a percentage",
  },
  {
    name: "maxSize",
    type: "number",
    description: "Maximum size of a panel as a percentage",
  },
]

/* ─── Sample data for the Table demo ──────────────────────────────────────── */
type TaskManagerRow = {
  id: string
  host: string
  status: "ALIVE" | "UNREACHABLE" | "DRAINING"
  slots: { used: number; total: number }
  heapUsed: number
  heapMax: number
  cpuPercent: number
  uptime: number
}

const taskManagers: TaskManagerRow[] = [
  {
    id: "tm-001",
    host: "flink-worker-01.prod",
    status: "ALIVE",
    slots: { used: 3, total: 4 },
    heapUsed: 2_100_000_000,
    heapMax: 4_294_967_296,
    cpuPercent: 42,
    uptime: 86_400_000 * 3 + 7_200_000,
  },
  {
    id: "tm-002",
    host: "flink-worker-02.prod",
    status: "ALIVE",
    slots: { used: 4, total: 4 },
    heapUsed: 3_800_000_000,
    heapMax: 4_294_967_296,
    cpuPercent: 87,
    uptime: 86_400_000 * 3 + 3_600_000,
  },
  {
    id: "tm-003",
    host: "flink-worker-03.prod",
    status: "ALIVE",
    slots: { used: 1, total: 4 },
    heapUsed: 980_000_000,
    heapMax: 4_294_967_296,
    cpuPercent: 18,
    uptime: 86_400_000 * 2,
  },
  {
    id: "tm-004",
    host: "flink-worker-04.prod",
    status: "DRAINING",
    slots: { used: 2, total: 4 },
    heapUsed: 1_600_000_000,
    heapMax: 4_294_967_296,
    cpuPercent: 31,
    uptime: 86_400_000 * 5 + 14_400_000,
  },
  {
    id: "tm-005",
    host: "flink-worker-05.prod",
    status: "ALIVE",
    slots: { used: 0, total: 4 },
    heapUsed: 420_000_000,
    heapMax: 4_294_967_296,
    cpuPercent: 5,
    uptime: 86_400_000 + 1_800_000,
  },
  {
    id: "tm-006",
    host: "flink-worker-06.prod",
    status: "UNREACHABLE",
    slots: { used: 4, total: 4 },
    heapUsed: 4_100_000_000,
    heapMax: 4_294_967_296,
    cpuPercent: 98,
    uptime: 86_400_000 * 7,
  },
  {
    id: "tm-007",
    host: "flink-worker-07.prod",
    status: "ALIVE",
    slots: { used: 3, total: 4 },
    heapUsed: 2_700_000_000,
    heapMax: 4_294_967_296,
    cpuPercent: 55,
    uptime: 86_400_000 * 1 + 43_200_000,
  },
  {
    id: "tm-008",
    host: "flink-worker-08.prod",
    status: "ALIVE",
    slots: { used: 2, total: 4 },
    heapUsed: 1_900_000_000,
    heapMax: 4_294_967_296,
    cpuPercent: 38,
    uptime: 3_600_000 * 6,
  },
]

type SortField = "id" | "host" | "status" | "cpu" | "heap"
type SortDir = "asc" | "desc"

function fmtBytes(bytes: number): string {
  if (bytes >= 1_073_741_824) return `${(bytes / 1_073_741_824).toFixed(1)} GB`
  if (bytes >= 1_048_576) return `${(bytes / 1_048_576).toFixed(0)} MB`
  return `${(bytes / 1024).toFixed(0)} KB`
}

function fmtUptime(ms: number): string {
  const days = Math.floor(ms / 86_400_000)
  const hours = Math.floor((ms % 86_400_000) / 3_600_000)
  if (days > 0) return `${days}d ${hours}h`
  const mins = Math.floor((ms % 3_600_000) / 60_000)
  return `${hours}h ${mins}m`
}

function sortRows(rows: TaskManagerRow[], field: SortField, dir: SortDir) {
  return [...rows].sort((a, b) => {
    let cmp = 0
    switch (field) {
      case "id":
        cmp = a.id.localeCompare(b.id)
        break
      case "host":
        cmp = a.host.localeCompare(b.host)
        break
      case "status":
        cmp = a.status.localeCompare(b.status)
        break
      case "cpu":
        cmp = a.cpuPercent - b.cpuPercent
        break
      case "heap":
        cmp = a.heapUsed - b.heapUsed
        break
    }
    return dir === "asc" ? cmp : -cmp
  })
}

/* ─── Page Component ──────────────────────────────────────────────────────── */
/** Showcase route: /primitives -- UI primitives showcase with buttons, inputs, badges, cards, tables, and Radix-based components. */
function PrimitivesPage() {
  const [switchChecked, setSwitchChecked] = useState(false)
  const [collapsibleOpen, setCollapsibleOpen] = useState(false)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [selectedFruit, setSelectedFruit] = useState("")
  const [activeTab, setActiveTab] = useState("overview")
  const [sortField, setSortField] = useState<SortField>("id")
  const [sortDir, setSortDir] = useState<SortDir>("asc")
  const [selectedTm, setSelectedTm] = useState<string | null>(null)
  const [comboValue, setComboValue] = useState("")

  const sortedTms = sortRows(taskManagers, sortField, sortDir)
  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"))
    } else {
      setSortField(field)
      setSortDir("asc")
    }
  }
  const sortIndicator = (field: SortField) =>
    sortField === field ? (sortDir === "asc" ? " ↑" : " ↓") : ""

  return (
    <ShowcasePage
      title="Primitives"
      description="All 30 UI primitives from @flink-reactor/ui"
      items={tocItems}
    >
      {/* ── Button ─────────────────────────────────────────────────────────── */}
      <Section
        id="button"
        title="Button"
        description="Clickable action trigger with multiple style variants and sizes."
      >
        <div className="flex flex-wrap gap-3 mb-4">
          <Button variant="default">Default</Button>
          <Button variant="secondary">Secondary</Button>
          <Button variant="destructive">Destructive</Button>
          <Button variant="outline">Outline</Button>
          <Button variant="ghost">Ghost</Button>
          <Button variant="link">Link</Button>
        </div>
        <div className="flex flex-wrap gap-3 mb-6">
          <Button size="sm">Small</Button>
          <Button size="default">Default</Button>
          <Button size="lg">Large</Button>
          <Button disabled>Disabled</Button>
        </div>
        <ImportSnippet code={`import { Button } from "@flink-reactor/ui"`} />
        <div className="mt-4">
          <PropsTable props={buttonProps} />
        </div>
      </Section>

      {/* ── Badge ──────────────────────────────────────────────────────────── */}
      <Section
        id="badge"
        title="Badge"
        description="Small status indicator label."
      >
        <div className="flex flex-wrap gap-3 mb-6">
          <Badge variant="default">Default</Badge>
          <Badge variant="secondary">Secondary</Badge>
          <Badge variant="destructive">Destructive</Badge>
          <Badge variant="outline">Outline</Badge>
        </div>
        <ImportSnippet code={`import { Badge } from "@flink-reactor/ui"`} />
        <div className="mt-4">
          <PropsTable props={badgeProps} />
        </div>
      </Section>

      {/* ── Alert ──────────────────────────────────────────────────────────── */}
      <Section
        id="alert"
        title="Alert"
        description="Callout for important messages with optional title and description."
      >
        <div className="flex flex-col gap-3 max-w-md mb-6">
          <Alert>
            <AlertTitle>Default Alert</AlertTitle>
            <AlertDescription>
              This is a default alert message.
            </AlertDescription>
          </Alert>
          <Alert variant="destructive">
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>Something went wrong.</AlertDescription>
          </Alert>
        </div>
        <ImportSnippet
          code={`import { Alert, AlertTitle, AlertDescription } from "@flink-reactor/ui"`}
        />
        <div className="mt-4">
          <PropsTable props={alertProps} />
        </div>
      </Section>

      {/* ── Switch ─────────────────────────────────────────────────────────── */}
      <Section
        id="switch"
        title="Switch"
        description="Toggle control for binary on/off states."
      >
        <div className="flex items-center gap-3 mb-6">
          <Switch checked={switchChecked} onCheckedChange={setSwitchChecked} />
          <span className="text-sm text-fg-muted">
            {switchChecked ? "Enabled" : "Disabled"}
          </span>
        </div>
        <ImportSnippet code={`import { Switch } from "@flink-reactor/ui"`} />
        <div className="mt-4">
          <PropsTable props={switchProps} />
        </div>
      </Section>

      {/* ── Progress ───────────────────────────────────────────────────────── */}
      <Section
        id="progress"
        title="Progress"
        description="Horizontal bar indicating completion progress."
      >
        <div className="flex flex-col gap-3 max-w-md mb-6">
          <Progress value={33} />
          <Progress value={66} />
          <Progress value={100} />
        </div>
        <ImportSnippet code={`import { Progress } from "@flink-reactor/ui"`} />
        <div className="mt-4">
          <PropsTable props={progressProps} />
        </div>
      </Section>

      {/* ── Card ───────────────────────────────────────────────────────────── */}
      <Section
        id="card"
        title="Card"
        description="Container with header, content, description, and footer sub-components."
      >
        <div className="flex flex-col gap-4 max-w-sm mb-6">
          <Card>
            <CardHeader>
              <CardTitle>Default Card</CardTitle>
              <CardDescription>Standard padding (p-4).</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-fg-muted">Card content goes here.</p>
            </CardContent>
            <CardFooter>
              <Button variant="outline" size="sm">
                Action
              </Button>
            </CardFooter>
          </Card>
          <Card size="compact">
            <CardHeader>
              <CardTitle>Compact Card</CardTitle>
              <CardDescription>Tighter padding (p-3).</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-fg-muted">Card content goes here.</p>
            </CardContent>
            <CardFooter>
              <Button variant="outline" size="sm">
                Action
              </Button>
            </CardFooter>
          </Card>
          <Card size="lg">
            <CardHeader>
              <CardTitle>Large Card</CardTitle>
              <CardDescription>Spacious padding (p-6).</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-fg-muted">Card content goes here.</p>
            </CardContent>
            <CardFooter>
              <Button variant="outline" size="sm">
                Action
              </Button>
            </CardFooter>
          </Card>
        </div>
        <ImportSnippet
          code={`import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@flink-reactor/ui"`}
        />
        <div className="mt-4">
          <PropsTable props={cardProps} />
        </div>
      </Section>

      {/* ── Input & Label ──────────────────────────────────────────────────── */}
      <Section
        id="input-label"
        title="Input & Label"
        description="Text input field with associated label."
      >
        <div className="flex flex-col gap-3 max-w-sm mb-6">
          <div>
            <Label htmlFor="email-demo">Email</Label>
            <Input
              id="email-demo"
              placeholder="name@example.com"
              className="mt-1"
            />
          </div>
          <div>
            <Label htmlFor="disabled-demo">Disabled</Label>
            <Input
              id="disabled-demo"
              placeholder="Cannot type here"
              disabled
              className="mt-1"
            />
          </div>
        </div>
        <ImportSnippet
          code={`import { Input, Label } from "@flink-reactor/ui"`}
        />
        <div className="mt-4">
          <h3 className="text-sm font-medium text-fg mb-2">Input Props</h3>
          <PropsTable props={inputProps} />
        </div>
        <div className="mt-4">
          <h3 className="text-sm font-medium text-fg mb-2">Label Props</h3>
          <PropsTable props={labelProps} />
        </div>
      </Section>

      {/* ── Textarea ───────────────────────────────────────────────────────── */}
      <Section
        id="textarea"
        title="Textarea"
        description="Multi-line text input field."
      >
        <div className="flex flex-col gap-3 max-w-sm mb-6">
          <Label htmlFor="textarea-demo">Message</Label>
          <Textarea
            id="textarea-demo"
            placeholder="Type your message here..."
            rows={3}
          />
        </div>
        <ImportSnippet code={`import { Textarea } from "@flink-reactor/ui"`} />
        <div className="mt-4">
          <PropsTable props={textareaProps} />
        </div>
      </Section>

      {/* ── Skeleton ───────────────────────────────────────────────────────── */}
      <Section
        id="skeleton"
        title="Skeleton"
        description="Placeholder loading animation for content that is not yet available."
      >
        <div className="flex flex-col gap-3 max-w-sm mb-6">
          <div className="flex items-center gap-3">
            <Skeleton variant="avatar" />
            <div className="flex flex-col gap-2 flex-1">
              <Skeleton variant="heading" />
              <Skeleton variant="text" />
            </div>
          </div>
          <Skeleton variant="card" />
          <div className="flex items-center gap-4 text-xs text-fg-dim mt-2">
            <span className="flex items-center gap-2"><Skeleton variant="avatar" className="size-4" /> avatar</span>
            <span className="flex items-center gap-2"><Skeleton variant="text" className="w-12" /> text</span>
            <span className="flex items-center gap-2"><Skeleton variant="heading" className="w-12" /> heading</span>
          </div>
        </div>
        <ImportSnippet code={`import { Skeleton } from "@flink-reactor/ui"`} />
        <div className="mt-4">
          <PropsTable props={skeletonProps} />
        </div>
      </Section>

      {/* ── Separator ──────────────────────────────────────────────────────── */}
      <Section
        id="separator"
        title="Separator"
        description="Visual divider between content sections."
      >
        <div className="max-w-md mb-6">
          <p className="text-sm text-fg-muted">Content above</p>
          <Separator className="my-3" />
          <p className="text-sm text-fg-muted">Content below</p>
          <div className="flex items-center gap-3 mt-4 h-6">
            <span className="text-sm text-fg-muted">Left</span>
            <Separator orientation="vertical" />
            <span className="text-sm text-fg-muted">Center</span>
            <Separator orientation="vertical" />
            <span className="text-sm text-fg-muted">Right</span>
          </div>
        </div>
        <ImportSnippet code={`import { Separator } from "@flink-reactor/ui"`} />
        <div className="mt-4">
          <PropsTable props={separatorProps} />
        </div>
      </Section>

      {/* ── Collapsible ────────────────────────────────────────────────────── */}
      <Section
        id="collapsible"
        title="Collapsible"
        description="Expandable/collapsible content panel with trigger."
      >
        <div className="max-w-md mb-6">
          <Collapsible open={collapsibleOpen} onOpenChange={setCollapsibleOpen}>
            <div className="flex items-center justify-between rounded-md border border-white/10 px-4 py-2">
              <span className="text-sm font-medium text-fg">
                3 tagged items
              </span>
              <CollapsibleTrigger asChild>
                <Button variant="ghost" size="sm">
                  <ChevronsUpDown className="h-4 w-4" />
                </Button>
              </CollapsibleTrigger>
            </div>
            <CollapsibleContent className="mt-2 space-y-2">
              <div className="rounded-md border border-white/10 px-4 py-2 text-sm text-fg-muted">
                @flink-reactor/ui
              </div>
              <div className="rounded-md border border-white/10 px-4 py-2 text-sm text-fg-muted">
                @flink-reactor/dsl
              </div>
              <div className="rounded-md border border-white/10 px-4 py-2 text-sm text-fg-muted">
                @flink-reactor/console
              </div>
            </CollapsibleContent>
          </Collapsible>
        </div>
        <ImportSnippet
          code={`import { Collapsible, CollapsibleTrigger, CollapsibleContent } from "@flink-reactor/ui"`}
        />
        <div className="mt-4">
          <PropsTable props={collapsibleProps} />
        </div>
      </Section>

      {/* ── Dialog ─────────────────────────────────────────────────────────── */}
      <Section
        id="dialog"
        title="Dialog"
        description="Modal overlay for focused interactions like confirmations and forms."
      >
        <div className="mb-6">
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline">Open Dialog</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Confirm Action</DialogTitle>
                <DialogDescription>
                  Are you sure you want to proceed? This action cannot be
                  undone.
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <DialogClose asChild>
                  <Button variant="ghost">Cancel</Button>
                </DialogClose>
                <Button
                  variant="destructive"
                  onClick={() => setDialogOpen(false)}
                >
                  Confirm
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
        <ImportSnippet
          code={`import { Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from "@flink-reactor/ui"`}
        />
        <div className="mt-4">
          <PropsTable props={dialogProps} />
        </div>
      </Section>

      {/* ── HoverCard ──────────────────────────────────────────────────────── */}
      <Section
        id="hover-card"
        title="HoverCard"
        description="Content card that appears on hover for previews and supplementary info."
      >
        <div className="mb-6">
          <HoverCard>
            <HoverCardTrigger asChild>
              <Button variant="link" className="text-fr-purple">
                @flink-reactor
              </Button>
            </HoverCardTrigger>
            <HoverCardContent className="w-72">
              <div className="flex flex-col gap-2">
                <h4 className="text-sm font-semibold text-fg">FlinkReactor</h4>
                <p className="text-xs text-fg-muted">
                  A reactive management platform for Apache Flink clusters.
                  Provides real-time monitoring, alerting, and operational
                  tooling.
                </p>
                <div className="flex items-center gap-2 text-xs text-fg-muted">
                  <span>12 repositories</span>
                  <Separator orientation="vertical" className="h-3" />
                  <span>Updated 2h ago</span>
                </div>
              </div>
              <HoverCardArrow />
            </HoverCardContent>
          </HoverCard>
        </div>
        <ImportSnippet
          code={`import { HoverCard, HoverCardTrigger, HoverCardContent, HoverCardArrow } from "@flink-reactor/ui"`}
        />
        <div className="mt-4">
          <PropsTable props={hoverCardProps} />
        </div>
      </Section>

      {/* ── Popover ────────────────────────────────────────────────────────── */}
      <Section
        id="popover"
        title="Popover"
        description="Floating panel anchored to a trigger, for menus or supplementary controls."
      >
        <div className="mb-6">
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline">Open Popover</Button>
            </PopoverTrigger>
            <PopoverContent className="w-72">
              <div className="flex flex-col gap-3">
                <h4 className="text-sm font-semibold text-fg">Dimensions</h4>
                <div className="grid grid-cols-3 items-center gap-2">
                  <Label htmlFor="pop-width" className="text-xs">
                    Width
                  </Label>
                  <Input
                    id="pop-width"
                    defaultValue="100%"
                    className="col-span-2 h-8 text-xs"
                  />
                </div>
                <div className="grid grid-cols-3 items-center gap-2">
                  <Label htmlFor="pop-height" className="text-xs">
                    Height
                  </Label>
                  <Input
                    id="pop-height"
                    defaultValue="auto"
                    className="col-span-2 h-8 text-xs"
                  />
                </div>
              </div>
            </PopoverContent>
          </Popover>
        </div>
        <ImportSnippet
          code={`import { Popover, PopoverTrigger, PopoverContent } from "@flink-reactor/ui"`}
        />
        <div className="mt-4">
          <PropsTable props={popoverProps} />
        </div>
      </Section>

      {/* ── Select ─────────────────────────────────────────────────────────── */}
      <Section
        id="select"
        title="Select"
        description="Dropdown menu for choosing a single value from a list."
      >
        <div className="max-w-xs mb-6">
          <Select value={selectedFruit} onValueChange={setSelectedFruit}>
            <SelectTrigger>
              <SelectValue placeholder="Pick a fruit..." />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectLabel>Fruits</SelectLabel>
                <SelectItem value="apple">Apple</SelectItem>
                <SelectItem value="banana">Banana</SelectItem>
                <SelectItem value="cherry">Cherry</SelectItem>
                <SelectItem value="date">Date</SelectItem>
                <SelectItem value="elderberry">Elderberry</SelectItem>
              </SelectGroup>
            </SelectContent>
          </Select>
          {selectedFruit && (
            <p className="mt-2 text-xs text-fg-muted">
              Selected:{" "}
              <span className="text-fr-purple font-mono">{selectedFruit}</span>
            </p>
          )}
        </div>
        <ImportSnippet
          code={`import { Select, SelectTrigger, SelectValue, SelectContent, SelectGroup, SelectLabel, SelectItem } from "@flink-reactor/ui"`}
        />
        <div className="mt-4">
          <PropsTable props={selectProps} />
        </div>
      </Section>

      {/* ── Table ──────────────────────────────────────────────────────────── */}
      <Section
        id="table"
        title="Table"
        description="Rich data table — sortable columns, row selection, mixed data types, and footer summary."
      >
        <div className="glass-card overflow-hidden mb-6">
          <Table>
            <TableCaption>
              Task Manager fleet — click a column header to sort, click a row to
              select
            </TableCaption>
            <TableHeader>
              <TableRow>
                <TableHead
                  className="w-[80px] cursor-pointer select-none"
                  onClick={() => toggleSort("id")}
                >
                  ID{sortIndicator("id")}
                </TableHead>
                <TableHead
                  className="cursor-pointer select-none"
                  onClick={() => toggleSort("host")}
                >
                  Host{sortIndicator("host")}
                </TableHead>
                <TableHead
                  className="w-[110px] cursor-pointer select-none"
                  onClick={() => toggleSort("status")}
                >
                  Status{sortIndicator("status")}
                </TableHead>
                <TableHead className="w-[80px]">Slots</TableHead>
                <TableHead
                  className="w-[180px] cursor-pointer select-none"
                  onClick={() => toggleSort("heap")}
                >
                  Heap{sortIndicator("heap")}
                </TableHead>
                <TableHead
                  className="w-[90px] cursor-pointer select-none text-right"
                  onClick={() => toggleSort("cpu")}
                >
                  CPU{sortIndicator("cpu")}
                </TableHead>
                <TableHead className="w-[90px] text-right">Uptime</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedTms.map((tm) => {
                const heapPct = Math.round((tm.heapUsed / tm.heapMax) * 100)
                return (
                  <TableRow
                    key={tm.id}
                    className={cn(
                      "cursor-pointer transition-colors",
                      selectedTm === tm.id && "bg-fr-purple/10",
                    )}
                    onClick={() =>
                      setSelectedTm(selectedTm === tm.id ? null : tm.id)
                    }
                  >
                    <TableCell className="font-mono text-xs text-fr-purple">
                      {tm.id}
                    </TableCell>
                    <TableCell className="font-mono text-xs">
                      {tm.host}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          tm.status === "UNREACHABLE"
                            ? "destructive"
                            : tm.status === "DRAINING"
                              ? "outline"
                              : "default"
                        }
                      >
                        {tm.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-mono text-xs">
                      {tm.slots.used}/{tm.slots.total}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Progress value={heapPct} className="h-2 w-20" />
                        <span
                          className={cn(
                            "font-mono text-xs",
                            heapPct > 85
                              ? "text-job-failed"
                              : heapPct > 60
                                ? "text-fr-amber"
                                : "text-fg-muted",
                          )}
                        >
                          {fmtBytes(tm.heapUsed)}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell
                      className={cn(
                        "text-right font-mono text-xs",
                        tm.cpuPercent > 85
                          ? "text-job-failed"
                          : tm.cpuPercent > 60
                            ? "text-fr-amber"
                            : "text-fg-muted",
                      )}
                    >
                      {tm.cpuPercent}%
                    </TableCell>
                    <TableCell className="text-right font-mono text-xs text-fg-muted">
                      {fmtUptime(tm.uptime)}
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
            <TableFooter>
              <TableRow>
                <TableCell colSpan={3} className="font-medium">
                  {taskManagers.length} Task Managers
                </TableCell>
                <TableCell className="font-mono text-xs">
                  {taskManagers.reduce((s, t) => s + t.slots.used, 0)}/
                  {taskManagers.reduce((s, t) => s + t.slots.total, 0)}
                </TableCell>
                <TableCell className="font-mono text-xs">
                  avg{" "}
                  {fmtBytes(
                    taskManagers.reduce((s, t) => s + t.heapUsed, 0) /
                      taskManagers.length,
                  )}
                </TableCell>
                <TableCell className="text-right font-mono text-xs">
                  avg{" "}
                  {Math.round(
                    taskManagers.reduce((s, t) => s + t.cpuPercent, 0) /
                      taskManagers.length,
                  )}
                  %
                </TableCell>
                <TableCell />
              </TableRow>
            </TableFooter>
          </Table>
        </div>
        {selectedTm && (
          <div className="mb-4 rounded-lg border border-dash-border bg-dash-surface p-4">
            <p className="text-sm text-fg-muted">
              Selected:{" "}
              <span className="font-mono text-fr-purple">{selectedTm}</span> —{" "}
              {taskManagers.find((t) => t.id === selectedTm)?.host}
            </p>
          </div>
        )}
        <ImportSnippet
          code={`import { Table, TableHeader, TableBody, TableFooter, TableRow, TableHead, TableCell, TableCaption } from "@flink-reactor/ui"`}
        />
        <div className="mt-4">
          <PropsTable props={tableProps} />
        </div>
      </Section>

      {/* ── Tabs ───────────────────────────────────────────────────────────── */}
      <Section
        id="tabs"
        title="Tabs"
        description="Tabbed interface for switching between content panels."
      >
        <div className="max-w-md mb-6">
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList>
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="metrics">Metrics</TabsTrigger>
              <TabsTrigger value="logs">Logs</TabsTrigger>
            </TabsList>
            <TabsContent value="overview" className="mt-3">
              <Card>
                <CardContent className="pt-4">
                  <p className="text-sm text-fg-muted">
                    Job overview information: status, uptime, and resource
                    allocation.
                  </p>
                </CardContent>
              </Card>
            </TabsContent>
            <TabsContent value="metrics" className="mt-3">
              <Card>
                <CardContent className="pt-4">
                  <p className="text-sm text-fg-muted">
                    Throughput, latency, and backpressure metrics for this job.
                  </p>
                </CardContent>
              </Card>
            </TabsContent>
            <TabsContent value="logs" className="mt-3">
              <Card>
                <CardContent className="pt-4">
                  <p className="text-sm text-fg-muted">
                    Recent log entries from the job manager and task managers.
                  </p>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
        <ImportSnippet
          code={`import { Tabs, TabsList, TabsTrigger, TabsContent } from "@flink-reactor/ui"`}
        />
        <div className="mt-4">
          <PropsTable props={tabsProps} />
        </div>
      </Section>

      {/* ── Tooltip ────────────────────────────────────────────────────────── */}
      <Section
        id="tooltip"
        title="Tooltip"
        description="Small informational popup that appears on hover or focus."
      >
        <div className="flex gap-4 mb-6">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="outline">Hover me (top)</Button>
              </TooltipTrigger>
              <TooltipContent side="top">
                <p>Tooltip on top</p>
              </TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="outline">Hover me (right)</Button>
              </TooltipTrigger>
              <TooltipContent side="right">
                <p>Tooltip on right</p>
              </TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="outline">Hover me (bottom)</Button>
              </TooltipTrigger>
              <TooltipContent side="bottom">
                <p>Tooltip on bottom</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
        <ImportSnippet
          code={`import { TooltipProvider, Tooltip, TooltipTrigger, TooltipContent } from "@flink-reactor/ui"`}
        />
        <div className="mt-4">
          <PropsTable props={tooltipProps} />
        </div>
      </Section>

      {/* ── Resizable ──────────────────────────────────────────────────────── */}
      <Section
        id="resizable"
        title="Resizable"
        description="Drag-to-resize panel layout for adjustable split views."
      >
        <div className="max-w-2xl mb-6 rounded-lg border border-white/10 overflow-hidden">
          <ResizablePanelGroup
            orientation="horizontal"
            className="min-h-[200px]"
          >
            <ResizablePanel defaultSize={50} minSize={20}>
              <div className="flex h-full items-center justify-center p-4">
                <span className="text-sm text-fg-muted font-mono">Panel A</span>
              </div>
            </ResizablePanel>
            <ResizableHandle />
            <ResizablePanel defaultSize={50} minSize={20}>
              <div className="flex h-full items-center justify-center p-4">
                <span className="text-sm text-fg-muted font-mono">Panel B</span>
              </div>
            </ResizablePanel>
          </ResizablePanelGroup>
        </div>
        <ImportSnippet
          code={`import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from "@flink-reactor/ui"`}
        />
        <div className="mt-4">
          <PropsTable props={resizableProps} />
        </div>
      </Section>
      {/* ── Spinner ──────────────────────────────────────────────────────── */}
      <Section
        id="spinner"
        title="Spinner"
        description="Accessible loading indicator with standardized sizes."
      >
        <div className="flex items-center gap-6 mb-6">
          <div className="flex flex-col items-center gap-2">
            <Spinner size="sm" />
            <span className="text-xs text-fg-muted">sm</span>
          </div>
          <div className="flex flex-col items-center gap-2">
            <Spinner size="default" />
            <span className="text-xs text-fg-muted">default</span>
          </div>
          <div className="flex flex-col items-center gap-2">
            <Spinner size="lg" />
            <span className="text-xs text-fg-muted">lg</span>
          </div>
        </div>
        <div className="flex items-center gap-3 mb-6">
          <Button disabled>
            <Spinner size="sm" className="mr-1" /> Saving…
          </Button>
        </div>
        <ImportSnippet code={`import { Spinner } from "@flink-reactor/ui"`} />
        <div className="mt-4">
          <PropsTable
            props={[
              {
                name: "size",
                type: '"sm" | "default" | "lg"',
                default: '"default"',
                description: "Spinner icon size",
              },
              {
                name: "label",
                type: "string",
                default: '"Loading"',
                description: "Accessible aria-label for screen readers",
              },
            ]}
          />
        </div>
      </Section>

      {/* ── Kbd ──────────────────────────────────────────────────────────── */}
      <Section
        id="kbd"
        title="Kbd"
        description="Keyboard shortcut display with styled key caps."
      >
        <div className="flex items-center gap-6 mb-6">
          <KbdGroup>
            <Kbd>⌘</Kbd>
            <Kbd>K</Kbd>
          </KbdGroup>
          <KbdGroup>
            <Kbd>Ctrl</Kbd>
            <Kbd>Shift</Kbd>
            <Kbd>P</Kbd>
          </KbdGroup>
          <Kbd>Esc</Kbd>
          <Kbd>Enter</Kbd>
        </div>
        <div className="flex items-center gap-2 mb-6 text-sm text-fg-muted">
          <span>Open command palette</span>
          <KbdGroup>
            <Kbd>⌘</Kbd>
            <Kbd>K</Kbd>
          </KbdGroup>
        </div>
        <ImportSnippet code={`import { Kbd, KbdGroup } from "@flink-reactor/ui"`} />
        <div className="mt-4">
          <PropsTable
            props={[
              {
                name: "children",
                type: "ReactNode",
                description: "Key label text",
              },
              {
                name: "className",
                type: "string",
                description: "Additional CSS classes",
              },
            ]}
          />
        </div>
      </Section>

      {/* ── Checkbox ─────────────────────────────────────────────────────── */}
      <Section
        id="checkbox"
        title="Checkbox"
        description="Radix-based themed checkbox with check indicator."
      >
        <div className="flex flex-col gap-3 mb-6">
          <div className="flex items-center gap-2">
            <Checkbox id="terms" defaultChecked />
            <label htmlFor="terms" className="text-sm text-zinc-300">Accept terms and conditions</label>
          </div>
          <div className="flex items-center gap-2">
            <Checkbox id="newsletter" />
            <label htmlFor="newsletter" className="text-sm text-zinc-300">Subscribe to newsletter</label>
          </div>
          <div className="flex items-center gap-2">
            <Checkbox id="disabled" disabled />
            <label htmlFor="disabled" className="text-sm text-fg-muted">Disabled option</label>
          </div>
        </div>
        <ImportSnippet code={`import { Checkbox } from "@flink-reactor/ui"`} />
        <div className="mt-4">
          <PropsTable
            props={[
              {
                name: "checked",
                type: "boolean",
                description: "Controlled checked state",
              },
              {
                name: "onCheckedChange",
                type: "(checked: boolean) => void",
                description: "Called when checked state changes",
              },
              {
                name: "defaultChecked",
                type: "boolean",
                description: "Initial checked state (uncontrolled)",
              },
              {
                name: "disabled",
                type: "boolean",
                default: "false",
                description: "Disables the checkbox",
              },
            ]}
          />
        </div>
      </Section>

      {/* ── DropdownMenu ─────────────────────────────────────────────────── */}
      <Section
        id="dropdown-menu"
        title="DropdownMenu"
        description="Radix-based dropdown menu with items, checkboxes, labels, and separators."
      >
        <div className="flex gap-4 mb-6">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="icon">
                <MoreHorizontal className="size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              <DropdownMenuLabel>Actions</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem>
                <Pencil className="size-3.5" /> Edit
              </DropdownMenuItem>
              <DropdownMenuItem>
                <Copy className="size-3.5" /> Duplicate
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem className="text-red-400 focus:text-red-300">
                <Trash2 className="size-3.5" /> Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        <ImportSnippet
          code={`import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator } from "@flink-reactor/ui"`}
        />
        <div className="mt-4">
          <PropsTable
            props={[
              {
                name: "align",
                type: '"start" | "center" | "end"',
                default: '"center"',
                description: "Content alignment relative to trigger",
              },
              {
                name: "sideOffset",
                type: "number",
                default: "4",
                description: "Offset from trigger in pixels",
              },
              {
                name: "inset",
                type: "boolean",
                default: "false",
                description: "Add left padding for items without icons",
              },
            ]}
          />
        </div>
      </Section>

      {/* ── Item ─────────────────────────────────────────────────────────── */}
      <Section
        id="item"
        title="Item"
        description="Versatile list/card container with media, content, and action slots."
      >
        <div className="flex flex-col gap-3 max-w-md mb-6">
          <Item variant="outline">
            <ItemMedia>
              <Server className="size-5 text-fr-coral" />
            </ItemMedia>
            <ItemContent>
              <ItemTitle>flink-worker-01.prod</ItemTitle>
              <ItemDescription>4/4 slots • 2.1 GB heap • 42% CPU</ItemDescription>
            </ItemContent>
            <ItemActions>
              <Badge variant="outline">ALIVE</Badge>
            </ItemActions>
          </Item>
          <Item variant="muted">
            <ItemMedia>
              <Activity className="size-5 text-fr-purple" />
            </ItemMedia>
            <ItemContent>
              <ItemTitle>Backpressure detected</ItemTitle>
              <ItemDescription>Window aggregate vertex at 87% backpressure</ItemDescription>
            </ItemContent>
          </Item>
          <Item>
            <ItemMedia>
              <AlertCircle className="size-5 text-red-400" />
            </ItemMedia>
            <ItemContent>
              <ItemTitle>NullPointerException</ItemTitle>
              <ItemDescription>at com.example.Processor.process(Processor.java:42)</ItemDescription>
            </ItemContent>
            <ItemActions>
              <span className="text-xs text-fg-dim">3m ago</span>
            </ItemActions>
          </Item>
        </div>
        <ImportSnippet
          code={`import { Item, ItemMedia, ItemContent, ItemTitle, ItemDescription, ItemActions } from "@flink-reactor/ui"`}
        />
        <div className="mt-4">
          <PropsTable
            props={[
              {
                name: "variant",
                type: '"default" | "outline" | "muted"',
                default: '"default"',
                description: "Visual container style",
              },
              {
                name: "className",
                type: "string",
                description: "Additional CSS classes",
              },
            ]}
          />
        </div>
      </Section>

      {/* ── ButtonGroup ──────────────────────────────────────────────────── */}
      <Section
        id="button-group"
        title="ButtonGroup"
        description="Groups related buttons with coordinated border-radius and orientation."
      >
        <div className="flex flex-col gap-4 mb-6">
          <div className="flex items-center gap-4">
            <span className="text-xs text-fg-muted w-20">Horizontal</span>
            <ButtonGroup>
              <Button variant="outline" size="sm">Left</Button>
              <Button variant="outline" size="sm">Center</Button>
              <Button variant="outline" size="sm">Right</Button>
            </ButtonGroup>
          </div>
          <div className="flex items-start gap-4">
            <span className="text-xs text-fg-muted w-20 pt-1">Vertical</span>
            <ButtonGroup orientation="vertical">
              <Button variant="outline" size="sm">Top</Button>
              <Button variant="outline" size="sm">Middle</Button>
              <Button variant="outline" size="sm">Bottom</Button>
            </ButtonGroup>
          </div>
        </div>
        <ImportSnippet code={`import { ButtonGroup } from "@flink-reactor/ui"`} />
        <div className="mt-4">
          <PropsTable
            props={[
              {
                name: "orientation",
                type: '"horizontal" | "vertical"',
                default: '"horizontal"',
                description: "Stack direction of grouped buttons",
              },
            ]}
          />
        </div>
      </Section>

      {/* ── InputGroup ───────────────────────────────────────────────────── */}
      <Section
        id="input-group"
        title="InputGroup"
        description="Wraps an Input with leading/trailing addons (icons, text, buttons)."
      >
        <div className="flex flex-col gap-3 max-w-sm mb-6">
          <InputGroup>
            <InputGroupAddon><Search className="size-3.5" /></InputGroupAddon>
            <Input placeholder="Search jobs…" className="border-0 bg-transparent focus:ring-0" />
          </InputGroup>
          <InputGroup>
            <InputGroupAddon><Mail className="size-3.5" /></InputGroupAddon>
            <Input placeholder="email@example.com" className="border-0 bg-transparent focus:ring-0" />
            <InputGroupAddon className="border-l border-dash-border">
              <Button variant="ghost" size="sm">Send</Button>
            </InputGroupAddon>
          </InputGroup>
        </div>
        <ImportSnippet code={`import { InputGroup, InputGroupAddon } from "@flink-reactor/ui"`} />
      </Section>

      {/* ── Field ────────────────────────────────────────────────────────── */}
      <Section
        id="field"
        title="Field"
        description="Form field composition: label + input + description + error message."
      >
        <div className="flex flex-col gap-4 max-w-sm mb-6">
          <Field>
            <FieldLabel htmlFor="job-name">Job Name</FieldLabel>
            <Input id="job-name" placeholder="my-flink-job" />
            <FieldDescription>Must be unique within the cluster.</FieldDescription>
          </Field>
          <Field>
            <FieldLabel htmlFor="parallelism">Parallelism</FieldLabel>
            <Input id="parallelism" type="number" defaultValue="4" />
            <FieldError>Parallelism must be between 1 and 128.</FieldError>
          </Field>
        </div>
        <ImportSnippet code={`import { Field, FieldLabel, FieldDescription, FieldError } from "@flink-reactor/ui"`} />
      </Section>

      {/* ── Combobox ─────────────────────────────────────────────────────── */}
      <Section
        id="combobox"
        title="Combobox"
        description="Searchable select with autocomplete, built on cmdk."
      >
        <div className="max-w-xs mb-6">
          <Combobox
            value={comboValue}
            onValueChange={setComboValue}
            placeholder="Select operator…"
            options={[
              { label: "Sources", options: [
                { value: "kafka-source", label: "Kafka Source" },
                { value: "file-source", label: "File Source" },
              ]},
              { label: "Transforms", options: [
                { value: "map", label: "Map" },
                { value: "filter", label: "Filter" },
                { value: "window-agg", label: "Window Aggregate" },
              ]},
              { label: "Sinks", options: [
                { value: "kafka-sink", label: "Kafka Sink" },
                { value: "jdbc-sink", label: "JDBC Sink" },
              ]},
            ]}
          />
        </div>
        <ImportSnippet code={`import { Combobox } from "@flink-reactor/ui"`} />
        <div className="mt-4">
          <PropsTable
            props={[
              {
                name: "options",
                type: "(ComboboxOption | ComboboxGroup)[]",
                description: "Flat options or grouped options to display",
              },
              {
                name: "value",
                type: "string",
                description: "Currently selected value (controlled)",
              },
              {
                name: "onValueChange",
                type: "(value: string) => void",
                description: "Called when selection changes",
              },
              {
                name: "placeholder",
                type: "string",
                default: '"Select…"',
                description: "Trigger placeholder text",
              },
              {
                name: "searchPlaceholder",
                type: "string",
                default: '"Search…"',
                description: "Search input placeholder",
              },
              {
                name: "emptyMessage",
                type: "string",
                default: '"No results found."',
                description: "Message when no options match search",
              },
            ]}
          />
        </div>
      </Section>

      {/* ── Sheet ────────────────────────────────────────────────────────── */}
      <Section
        id="sheet"
        title="Sheet"
        description="Side panel overlay that slides in from any edge."
      >
        <div className="flex gap-3 mb-6">
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="outline">Open Right</Button>
            </SheetTrigger>
            <SheetContent side="right">
              <SheetHeader>
                <SheetTitle>Job Configuration</SheetTitle>
                <SheetDescription>View and edit the job settings.</SheetDescription>
              </SheetHeader>
              <div className="flex-1 py-4 text-sm text-fg-muted">Sheet content goes here.</div>
            </SheetContent>
          </Sheet>
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="outline">Open Left</Button>
            </SheetTrigger>
            <SheetContent side="left">
              <SheetHeader>
                <SheetTitle>Navigation</SheetTitle>
                <SheetDescription>Mobile sidebar navigation.</SheetDescription>
              </SheetHeader>
            </SheetContent>
          </Sheet>
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="outline">Open Bottom</Button>
            </SheetTrigger>
            <SheetContent side="bottom">
              <SheetHeader>
                <SheetTitle>Quick Actions</SheetTitle>
                <SheetDescription>Common operations for this view.</SheetDescription>
              </SheetHeader>
            </SheetContent>
          </Sheet>
        </div>
        <ImportSnippet
          code={`import { Sheet, SheetTrigger, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@flink-reactor/ui"`}
        />
        <div className="mt-4">
          <PropsTable
            props={[
              {
                name: "side",
                type: '"top" | "right" | "bottom" | "left"',
                default: '"right"',
                description: "Edge from which the sheet slides in",
              },
            ]}
          />
        </div>
      </Section>

      {/* ── Accordion ────────────────────────────────────────────────────── */}
      <Section
        id="accordion"
        title="Accordion"
        description="Multi-item collapsible sections with single or multiple mode."
      >
        <div className="max-w-md mb-6">
          <Accordion type="single" collapsible>
            <AccordionItem value="checkpoints">
              <AccordionTrigger>Checkpoint Configuration</AccordionTrigger>
              <AccordionContent>
                Mode: EXACTLY_ONCE, Interval: 30s, Timeout: 10m, Max Concurrent: 1
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="restart">
              <AccordionTrigger>Restart Strategy</AccordionTrigger>
              <AccordionContent>
                Fixed-delay restart with 3 attempts, 10s between restarts.
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="resources">
              <AccordionTrigger>Resource Allocation</AccordionTrigger>
              <AccordionContent>
                Task Manager Memory: 4096 MB, Parallelism: 8, Task Slots: 4
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </div>
        <ImportSnippet
          code={`import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from "@flink-reactor/ui"`}
        />
        <div className="mt-4">
          <PropsTable
            props={[
              {
                name: "type",
                type: '"single" | "multiple"',
                description: "Allow one or multiple items open at once",
              },
              {
                name: "collapsible",
                type: "boolean",
                default: "false",
                description: "Allow closing all items (single mode only)",
              },
              {
                name: "defaultValue",
                type: "string | string[]",
                description: "Initially opened item(s)",
              },
            ]}
          />
        </div>
      </Section>
    </ShowcasePage>
  )
}

export const Route = createFileRoute("/primitives/")({
  component: PrimitivesPage,
})
