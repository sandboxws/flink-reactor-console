// ─────────────────────────────────────────────────────────────────────────────
// @flink-reactor/ui — Design System Package
// ─────────────────────────────────────────────────────────────────────────────

// ── Utilities ────────────────────────────────────────────────────────────────
export { cn } from "./lib/cn";
export {
  SEVERITY_COLORS,
  LOG_BUFFER_LIMIT,
  LOG_RENDER_LIMIT,
  DEFAULT_LEVEL_FILTER,
  TIMESTAMP_FORMATS,
} from "./lib/constants";

// ── UI Components ────────────────────────────────────────────────────────────
export { Button, type ButtonProps, type ButtonVariant, type ButtonSize } from "./components/ui/button";
export { Badge, type BadgeProps, type BadgeVariant } from "./components/ui/badge";
export {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "./components/ui/card";
export { Input } from "./components/ui/input";
export { Label } from "./components/ui/label";
export { Textarea } from "./components/ui/textarea";
export {
  Table,
  TableHeader,
  TableBody,
  TableFooter,
  TableRow,
  TableHead,
  TableCell,
  TableCaption,
} from "./components/ui/table";
export { Tabs, TabsList, TabsTrigger, TabsContent } from "./components/ui/tabs";
export {
  Dialog,
  DialogPortal,
  DialogOverlay,
  DialogClose,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
} from "./components/ui/dialog";
export {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
  TooltipProvider,
} from "./components/ui/tooltip";
export {
  Collapsible,
  CollapsibleTrigger,
  CollapsibleContent,
} from "./components/ui/collapsible";
export { Popover, PopoverTrigger, PopoverContent } from "./components/ui/popover";
export {
  HoverCard,
  HoverCardTrigger,
  HoverCardContent,
} from "./components/ui/hover-card";
export {
  Select,
  SelectGroup,
  SelectValue,
  SelectTrigger,
  SelectContent,
  SelectLabel,
  SelectItem,
  SelectSeparator,
  SelectScrollUpButton,
  SelectScrollDownButton,
} from "./components/ui/select";
export { Progress } from "./components/ui/progress";
export { Separator } from "./components/ui/separator";
export {
  ResizablePanelGroup,
  ResizablePanel,
  ResizableHandle,
} from "./components/ui/resizable";

// ── Layout Components ────────────────────────────────────────────────────────
export {
  Shell,
  type ShellProps,
  Sidebar,
  type SidebarProps,
  type NavItem,
  type NavGroup,
  Header,
  breadcrumbFromPath,
  type HeaderProps,
  type Breadcrumb,
  CommandPalette,
  type CommandPaletteProps,
  type CommandRoute,
} from "./layout";

// ── Shared Components ────────────────────────────────────────────────────────
export {
  MetricCard,
  type MetricCardProps,
  EmptyState,
  type EmptyStateProps,
  TextViewer,
  type TextViewerProps,
  SearchInput,
  type SearchInputProps,
  SeverityBadge,
  type SeverityBadgeProps,
  type LogLevel,
  SourceBadge,
  type SourceBadgeProps,
  type LogSource,
  TimeRange,
  type TimeRangeProps,
  type TimeRangeValue,
  type TimeRangePreset,
} from "./shared";
