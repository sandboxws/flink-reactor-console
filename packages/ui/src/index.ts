// ─────────────────────────────────────────────────────────────────────────────
// @flink-reactor/ui — Design System Package
// ─────────────────────────────────────────────────────────────────────────────

export {
  Badge,
  type BadgeProps,
  type BadgeVariant,
} from "./components/ui/badge"
// ── UI Components ────────────────────────────────────────────────────────────
export {
  Button,
  type ButtonProps,
  type ButtonSize,
  type ButtonVariant,
} from "./components/ui/button"
export {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "./components/ui/card"
export {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "./components/ui/collapsible"
export {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogOverlay,
  DialogPortal,
  DialogTitle,
  DialogTrigger,
} from "./components/ui/dialog"
export {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "./components/ui/hover-card"
export { Input } from "./components/ui/input"
export { Label } from "./components/ui/label"
export {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "./components/ui/popover"
export { Progress } from "./components/ui/progress"
export {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "./components/ui/resizable"
export {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectScrollDownButton,
  SelectScrollUpButton,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "./components/ui/select"
export { Separator } from "./components/ui/separator"
export { Skeleton } from "./components/ui/skeleton"
export {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "./components/ui/table"
export { Tabs, TabsContent, TabsList, TabsTrigger } from "./components/ui/tabs"
export { Textarea } from "./components/ui/textarea"
export {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "./components/ui/tooltip"
// ── Layout Components ────────────────────────────────────────────────────────
export {
  type Breadcrumb,
  breadcrumbFromPath,
  CommandPalette,
  type CommandPaletteProps,
  type CommandRoute,
  Header,
  type HeaderProps,
  type NavGroup,
  type NavItem,
  Shell,
  type ShellProps,
  Sidebar,
  type SidebarProps,
} from "./layout"
// ── Utilities ────────────────────────────────────────────────────────────────
export { cn } from "./lib/cn"
export {
  DEFAULT_LEVEL_FILTER,
  LOG_BUFFER_LIMIT,
  LOG_RENDER_LIMIT,
  SEVERITY_COLORS,
  TIMESTAMP_FORMATS,
} from "./lib/constants"

// ── Shared Components ────────────────────────────────────────────────────────
export {
  EmptyState,
  type EmptyStateProps,
  type LogLevel,
  type LogSource,
  MetricCard,
  type MetricCardProps,
  SearchInput,
  type SearchInputProps,
  SeverityBadge,
  type SeverityBadgeProps,
  SourceBadge,
  type SourceBadgeProps,
  TextViewer,
  type TextViewerProps,
  TimeRange,
  type TimeRangePreset,
  type TimeRangeProps,
  type TimeRangeValue,
  QueryResults,
  type QueryResultsProps,
} from "./shared"
