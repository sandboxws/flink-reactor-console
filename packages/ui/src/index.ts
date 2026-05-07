/** Root entry point for the @flink-reactor/ui component library. */

// ── Catalogs Components ──────────────────────────────────────────────────
export {
  type CatalogColumnInfo,
  ColumnsTable,
  EXPLORE_TEMPLATES,
  type ExploreTemplate,
  resolveTemplate,
  SAMPLE_QUERY_TEMPLATES,
  SqlHighlight,
  TemplateSelector,
} from "./components/catalogs"
// ── Errors Components ──────────────────────────────────────────────────────
export {
  ErrorDetail,
  type ErrorDetailProps,
  ErrorTimeline,
  type ErrorTimelineProps,
} from "./components/errors"
// ── Insights Components ────────────────────────────────────────────────────
export {
  BottleneckDAG,
  type BottleneckDAGProps,
  BottleneckTable,
  type BottleneckTableProps,
  HealthTrendChart,
  type HealthTrendChartProps,
  SubScoreGrid,
  type SubScoreGridProps,
  TopIssuesList,
  type TopIssuesListProps,
} from "./components/insights"
// ── Jobs Components ─────────────────────────────────────────────────────────
export {
  CheckpointsTab,
  ConfigurationTab,
  DataSkewTab,
  ExceptionsTab,
  JobHeader,
  type JobHistoryEntry,
  JobHistoryTable,
  JobsTable,
  OperatorNode,
  SourceSinkCard,
  SourcesSinksTab,
  StrategyEdge,
  TimelineTab,
  VerticesTab,
} from "./components/jobs"
// ── Logs Components ────────────────────────────────────────────────────────
export {
  LogDetailPanel,
  type LogDetailPanelProps,
  LogHistogram,
  type LogHistogramProps,
  LogLine,
  type LogLineProps,
  LogList,
  type LogListProps,
  type TimestampFormat,
} from "./components/logs"
// ── Materialized Tables Components ───────────────────────────────────────
export { RefreshStatusBadge } from "./components/materialized-tables"
// ── Monitoring Components ──────────────────────────────────────────────────
export {
  AlertCard,
  type AlertCardProps,
  CheckpointJobTable,
  type CheckpointJobTableProps,
  CheckpointTimelineChart,
  type CheckpointTimelineChartProps,
  StateSizeChart,
  type StateSizeChartProps,
} from "./components/monitoring"
// ── Overview Components ──────────────────────────────────────────────────────
export { ClusterInfo } from "./components/overview/cluster-info"
export { JobStatusSummary } from "./components/overview/job-status-summary"
export { SlotUtilization } from "./components/overview/slot-utilization"
export { StatCard } from "./components/overview/stat-card"
// ── Plan Analyzer Components ─────────────────────────────────────────────
export {
  PlanAntiPatternCard,
  PlanDAG,
  PlanOperatorNode,
  type PlanOperatorNodeData,
  PlanStateForecast,
  PlanStrategyEdge,
} from "./components/plan-analyzer"
// ── Tap Components ───────────────────────────────────────────────────────
export {
  type TapColumnInfo,
  TapDataTable,
  TapErrorPanel,
  type TapSessionStatus,
  TapSourceConfig,
  type TapSourceConfigData,
  TapStatusBar,
} from "./components/tap"
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
  type BadgeTone,
  type BadgeVariant,
} from "./components/ui/badge"
export {
  BrandGlyph,
  type BrandGlyphProps,
} from "./components/ui/brand-glyph"
export {
  Button,
  type ButtonProps,
  type ButtonSize,
  type ButtonVariant,
} from "./components/ui/button"
export {
  ButtonGroup,
  type ButtonGroupOrientation,
  type ButtonGroupProps,
} from "./components/ui/button-group"
export {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  type CardProps,
  type CardSize,
  CardTitle,
} from "./components/ui/card"
export { Checkbox } from "./components/ui/checkbox"
export {
  type ClusterEnv,
  ClusterSelector,
  type ClusterSelectorProps,
} from "./components/ui/cluster-selector"
export {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "./components/ui/collapsible"
export {
  Combobox,
  type ComboboxGroup,
  type ComboboxOption,
  type ComboboxProps,
} from "./components/ui/combobox"
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
  DiffLine,
  type DiffLineProps,
  type DiffVariant,
} from "./components/ui/diff-line"
export {
  DiffViewer,
  type DiffViewerProps,
} from "./components/ui/diff-viewer"
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
  Field,
  FieldContent,
  FieldDescription,
  FieldError,
  FieldLabel,
  FieldLegend,
  type FieldProps,
  FieldSet,
  type FieldSetProps,
} from "./components/ui/field"
export {
  HeatmapCalendar,
  type HeatmapCalendarProps,
} from "./components/ui/heatmap-calendar"
export {
  HeatmapCell,
  type HeatmapCellProps,
  type HeatmapIntensity,
} from "./components/ui/heatmap-cell"
export {
  HoverCard,
  HoverCardArrow,
  HoverCardContent,
  HoverCardTrigger,
} from "./components/ui/hover-card"
export {
  HubBreadcrumb,
  type HubBreadcrumbCrumb,
  type HubBreadcrumbProps,
} from "./components/ui/hub-breadcrumb"
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
  type ItemProps,
  ItemTitle,
  type ItemVariant,
} from "./components/ui/item"
export {
  Kbd,
  KbdGroup,
  type KbdGroupProps,
  type KbdProps,
} from "./components/ui/kbd"
export {
  KpiCard,
  type KpiCardProps,
} from "./components/ui/kpi-card"
export { Label } from "./components/ui/label"
export {
  LiveDot,
  type LiveDotProps,
  type LiveDotTone,
} from "./components/ui/live-dot"
export {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "./components/ui/popover"
export {
  PriorityBars,
  type PriorityBarsProps,
  type PriorityLevel,
} from "./components/ui/priority-bars"
export { Progress } from "./components/ui/progress"
export {
  PropChip,
  type PropChipProps,
} from "./components/ui/prop-chip"
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
  SevBadge,
  type SevBadgeProps,
  type SevTone,
} from "./components/ui/sev-badge"
export {
  Sheet,
  SheetClose,
  SheetContent,
  type SheetContentProps,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetOverlay,
  SheetPortal,
  type SheetSide,
  SheetTitle,
  SheetTrigger,
} from "./components/ui/sheet"
export { Skeleton, type SkeletonVariant } from "./components/ui/skeleton"
export {
  Spinner,
  type SpinnerProps,
  type SpinnerSize,
} from "./components/ui/spinner"
export {
  StatePill,
  type StatePillProps,
  type StatePillState,
} from "./components/ui/state-pill"
export {
  StatusIcon,
  type StatusIconProps,
  type StatusIconState,
} from "./components/ui/status-icon"
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
  HubCommandPalette,
  type HubCommandPaletteProps,
  type HubCommandRoute,
  HubShell,
  type HubShellLinkProps,
  type HubShellProps,
  HubSidebar,
  type HubSidebarItem,
  type HubSidebarLinkProps,
  type HubSidebarProps,
  type HubSidebarSection,
  HubTopBar,
  type HubTopBarLinkProps,
  type HubTopBarProps,
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
export { SHUFFLE_STRATEGY_LABELS } from "./lib/plan-analyzer-constants"
// ── Shared Components ────────────────────────────────────────────────────────
export {
  DurationCell,
  EmptyState,
  type EmptyStateProps,
  formatMetricValue,
  getChartColor,
  getUnitBadgeLabel,
  HealthScoreGauge,
  JobStatusBadge,
  type LogLevel,
  type LogSource,
  MemoryBar,
  MetricCard,
  type MetricCardProps,
  MetricChart,
  QueryResults,
  type QueryResultsProps,
  SearchInput,
  type SearchInputProps,
  SeverityBadge,
  type SeverityBadgeProps,
  SourceBadge,
  type SourceBadgeProps,
  StackTrace,
  StaticLogExplorer,
  TaskCountsBar,
  TextViewer,
  type TextViewerProps,
  ThreadDumpViewer,
  TimeRange,
  type TimeRangePreset,
  type TimeRangeProps,
  type TimeRangeValue,
  type TimeRangeVariant,
} from "./shared"
// ── Domain Types ────────────────────────────────────────────────────────────
export type * from "./types"
