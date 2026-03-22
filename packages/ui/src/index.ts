// ─────────────────────────────────────────────────────────────────────────────
// @flink-reactor/ui — Design System Package
// ─────────────────────────────────────────────────────────────────────────────

// ── UI Components ────────────────────────────────────────────────────────────
export {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "./components/ui/accordion"
export {
  Alert,
  AlertDescription,
  AlertTitle,
  type AlertVariant,
} from "./components/ui/alert"
export {
  Badge,
  type BadgeProps,
  type BadgeVariant,
} from "./components/ui/badge"
export {
  Button,
  type ButtonProps,
  type ButtonSize,
  type ButtonVariant,
} from "./components/ui/button"
export {
  ButtonGroup,
  type ButtonGroupProps,
  type ButtonGroupOrientation,
} from "./components/ui/button-group"
export {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
  type CardProps,
  type CardSize,
} from "./components/ui/card"
export { Checkbox } from "./components/ui/checkbox"
export {
  Combobox,
  type ComboboxProps,
  type ComboboxOption,
  type ComboboxGroup,
} from "./components/ui/combobox"
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
  Field,
  FieldContent,
  FieldDescription,
  FieldError,
  FieldLabel,
  FieldLegend,
  FieldSet,
  type FieldProps,
  type FieldSetProps,
} from "./components/ui/field"
export {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuPortal,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "./components/ui/dropdown-menu"
export {
  HoverCard,
  HoverCardArrow,
  HoverCardContent,
  HoverCardTrigger,
} from "./components/ui/hover-card"
export { Input } from "./components/ui/input"
export {
  InputGroup,
  InputGroupAddon,
  type InputGroupProps,
} from "./components/ui/input-group"
export {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemMedia,
  ItemTitle,
  type ItemProps,
  type ItemVariant,
} from "./components/ui/item"
export {
  Kbd,
  KbdGroup,
  type KbdProps,
  type KbdGroupProps,
} from "./components/ui/kbd"
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
export {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetOverlay,
  SheetPortal,
  SheetTitle,
  SheetTrigger,
  type SheetContentProps,
  type SheetSide,
} from "./components/ui/sheet"
export { Skeleton, type SkeletonVariant } from "./components/ui/skeleton"
export {
  Spinner,
  type SpinnerProps,
  type SpinnerSize,
} from "./components/ui/spinner"
export { Switch } from "./components/ui/switch"
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
export { formatBytes, formatDuration, formatTimestamp } from "./lib/format"

// ── Domain Types ────────────────────────────────────────────────────────────
export type * from "./types"

// ── Overview Components ──────────────────────────────────────────────────────
export { ClusterInfo } from "./components/overview/cluster-info"
export { JobStatusSummary } from "./components/overview/job-status-summary"
export { SlotUtilization } from "./components/overview/slot-utilization"
export { StatCard } from "./components/overview/stat-card"

// ── Jobs Components ─────────────────────────────────────────────────────────
export {
  CheckpointsTab,
  ConfigurationTab,
  DataSkewTab,
  ExceptionsTab,
  JobHeader,
  JobHistoryTable,
  type JobHistoryEntry,
  JobsTable,
  OperatorNode,
  SourceSinkCard,
  SourcesSinksTab,
  StrategyEdge,
  TimelineTab,
  VerticesTab,
} from "./components/jobs"

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
  type TimeRangeVariant,
  QueryResults,
  type QueryResultsProps,
  StackTrace,
  JobStatusBadge,
  MemoryBar,
  DurationCell,
  TaskCountsBar,
  HealthScoreGauge,
  MetricChart,
  formatMetricValue,
  getChartColor,
  getUnitBadgeLabel,
  ThreadDumpViewer,
  StaticLogExplorer,
} from "./shared"

// ── Logs Components ────────────────────────────────────────────────────────
export {
  LogLine,
  type LogLineProps,
  type TimestampFormat,
  LogList,
  type LogListProps,
  LogDetailPanel,
  type LogDetailPanelProps,
  LogHistogram,
  type LogHistogramProps,
} from "./components/logs"

// ── Errors Components ──────────────────────────────────────────────────────
export {
  ErrorDetail,
  type ErrorDetailProps,
  ErrorTimeline,
  type ErrorTimelineProps,
} from "./components/errors"

// ── Monitoring Components ──────────────────────────────────────────────────
export {
  AlertCard,
  type AlertCardProps,
  CheckpointTimelineChart,
  type CheckpointTimelineChartProps,
  StateSizeChart,
  type StateSizeChartProps,
  CheckpointJobTable,
  type CheckpointJobTableProps,
} from "./components/monitoring"

// ── Insights Components ────────────────────────────────────────────────────
export {
  HealthTrendChart,
  type HealthTrendChartProps,
  SubScoreGrid,
  type SubScoreGridProps,
  TopIssuesList,
  type TopIssuesListProps,
  BottleneckDAG,
  type BottleneckDAGProps,
  BottleneckTable,
  type BottleneckTableProps,
} from "./components/insights"

// ── Plan Analyzer Components ─────────────────────────────────────────────
export {
  PlanDAG,
  PlanOperatorNode,
  type PlanOperatorNodeData,
  PlanStrategyEdge,
  PlanAntiPatternCard,
  PlanStateForecast,
} from "./components/plan-analyzer"
export { SHUFFLE_STRATEGY_LABELS } from "./lib/plan-analyzer-constants"

// ── Catalogs Components ──────────────────────────────────────────────────
export {
  ColumnsTable,
  type CatalogColumnInfo,
  TemplateSelector,
  type ExploreTemplate,
  EXPLORE_TEMPLATES,
  SAMPLE_QUERY_TEMPLATES,
  resolveTemplate,
  SqlHighlight,
} from "./components/catalogs"

// ── Tap Components ───────────────────────────────────────────────────────
export {
  TapDataTable,
  type TapColumnInfo,
  TapStatusBar,
  type TapSessionStatus,
  TapSourceConfig,
  type TapSourceConfigData,
  TapErrorPanel,
} from "./components/tap"

// ── Materialized Tables Components ───────────────────────────────────────
export { RefreshStatusBadge } from "./components/materialized-tables"
