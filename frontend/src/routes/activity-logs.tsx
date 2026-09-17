import { useState, useMemo } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Activity,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Clock,
  Search,
  RefreshCw,
  Download,
  FileSpreadsheet,
  FileText,
  Trash2,
  Copy,
  Check,
  ChevronLeft,
  ChevronRight,
  ArrowUpDown,
  FilterX,
  Globe,
  User as UserIcon,
  Shield,
  Layers,
  FileCode,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { activities } from "@/lib/api/resources";
import type { ActivityLog } from "@/lib/api/types";
import { ProtectedRoute } from "@/components/auth/protected-route";
import { useAuth } from "@/lib/auth/auth-context";
import { hasPermission, normalizeRole } from "@/lib/auth/permissions";

export const Route = createFileRoute("/activity-logs")({ component: ActivityLogsWrapper });

function ActivityLogsWrapper() {
  return (
    <ProtectedRoute permission="activities:view">
      <ActivityLogs />
    </ProtectedRoute>
  );
}

const ACTION_OPTIONS = [
  { label: "All Actions", value: "ALL" },
  { label: "User Login", value: "USER_LOGIN" },
  { label: "User Logout", value: "USER_LOGOUT" },
  { label: "Create Contract", value: "CREATE_CONTRACT" },
  { label: "Update Contract", value: "UPDATE_CONTRACT" },
  { label: "Delete Contract", value: "DELETE_CONTRACT" },
  { label: "Approve Contract", value: "APPROVE_CONTRACT" },
  { label: "Activate Contract", value: "ACTIVATE_CONTRACT" },
  { label: "Assign Contract", value: "ASSIGN_CONTRACT" },
  { label: "Submit Review", value: "SUBMIT_REVIEW" },
  { label: "Contract Status Change", value: "STATUS_CHANGE" },
  { label: "Generate Report", value: "GENERATE_REPORT" },
  { label: "Download Report", value: "DOWNLOAD_REPORT" },
  { label: "Delete Report", value: "DELETE_REPORT" },
  { label: "Create Obligation", value: "CREATE_OBLIGATION" },
  { label: "Update Obligation", value: "UPDATE_OBLIGATION" },
  { label: "Complete Obligation", value: "COMPLETE_OBLIGATION" },
  { label: "Delete Obligation", value: "DELETE_OBLIGATION" },
  { label: "Create Renewal", value: "CREATE_RENEWAL" },
  { label: "Update Renewal", value: "UPDATE_RENEWAL" },
  { label: "Renew Contract", value: "RENEW_CONTRACT" },
  { label: "Delete Renewal", value: "DELETE_RENEWAL" },
  { label: "Create User", value: "CREATE_USER" },
  { label: "Update User", value: "UPDATE_USER" },
  { label: "Role Change", value: "ROLE_CHANGE" },
  { label: "Delete User", value: "DELETE_USER" },
];

const STATUS_OPTIONS = [
  { label: "All Statuses", value: "ALL" },
  { label: "Success", value: "success" },
  { label: "Failed / Error", value: "failed" },
  { label: "Warning", value: "warning" },
  { label: "Info", value: "info" },
];

const ROLE_OPTIONS = [
  { label: "All Roles", value: "ALL" },
  { label: "Admin", value: "Admin" },
  { label: "Compliance Officer", value: "Compliance Officer" },
  { label: "Legal Manager", value: "Legal Manager" },
  { label: "Contract Manager", value: "Contract Manager" },
  { label: "Viewer", value: "Viewer" },
];

function getInitials(name?: string | null): string {
  if (!name) return "U";
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function formatDateTime(dateStr?: string | null): string {
  if (!dateStr) return "—";
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
      second: "2-digit",
      hour12: true,
    });
  } catch {
    return dateStr;
  }
}

function formatRelativeTime(dateStr?: string | null): string {
  if (!dateStr) return "";
  try {
    const d = new Date(dateStr);
    const now = new Date();
    const diffSecs = Math.floor((now.getTime() - d.getTime()) / 1000);
    if (diffSecs < 60) return "Just now";
    const diffMins = Math.floor(diffSecs / 60);
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays < 7) return `${diffDays}d ago`;
    return d.toLocaleDateString();
  } catch {
    return "";
  }
}

function getRoleBadgeVariant(role?: string | null): {
  bg: string;
  text: string;
  border: string;
} {
  const norm = normalizeRole(role);
  switch (norm) {
    case "Admin":
      return {
        bg: "bg-rose-500/10 dark:bg-rose-500/20",
        text: "text-rose-600 dark:text-rose-400",
        border: "border-rose-500/30",
      };
    case "Compliance Officer":
      return {
        bg: "bg-emerald-500/10 dark:bg-emerald-500/20",
        text: "text-emerald-600 dark:text-emerald-400",
        border: "border-emerald-500/30",
      };
    case "Legal Manager":
      return {
        bg: "bg-indigo-500/10 dark:bg-indigo-500/20",
        text: "text-indigo-600 dark:text-indigo-400",
        border: "border-indigo-500/30",
      };
    case "Contract Manager":
      return {
        bg: "bg-amber-500/10 dark:bg-amber-500/20",
        text: "text-amber-600 dark:text-amber-400",
        border: "border-amber-500/30",
      };
    default:
      return {
        bg: "bg-muted",
        text: "text-muted-foreground",
        border: "border-border",
      };
  }
}

function ActivityLogs() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const userRole = normalizeRole(user?.role);
  const canExport = hasPermission(userRole, "activities:export");
  const canDelete = hasPermission(userRole, "activities:delete");

  // State
  const [page, setPage] = useState(1);
  const [pageSize] = useState(15);
  const [search, setSearch] = useState("");
  const [actionFilter, setActionFilter] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [roleFilter, setRoleFilter] = useState("ALL");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [sortOrder, setSortOrder] = useState<"desc" | "asc">("desc");
  const [autoRefresh, setAutoRefresh] = useState(false);

  // Drawer & Selection
  const [selectedActivity, setSelectedActivity] = useState<ActivityLog | null>(null);
  const [isCopied, setIsCopied] = useState(false);
  const [deleteTargetId, setDeleteTargetId] = useState<number | null>(null);
  const [isExporting, setIsExporting] = useState(false);

  // Query
  const query = useQuery({
    queryKey: [
      "activities-paginated",
      {
        page,
        pageSize,
        search,
        actionFilter,
        statusFilter,
        roleFilter,
        startDate,
        endDate,
        sortOrder,
      },
    ],
    queryFn: () =>
      activities.listPaginated({
        page,
        page_size: pageSize,
        search: search.trim() || undefined,
        action: actionFilter !== "ALL" ? actionFilter : undefined,
        status: statusFilter !== "ALL" ? statusFilter : undefined,
        role: roleFilter !== "ALL" ? roleFilter : undefined,
        start_date: startDate || undefined,
        end_date: endDate || undefined,
        order: sortOrder,
      }),
    refetchInterval: autoRefresh ? 30000 : false,
  });

  // Delete Mutation (Admin only)
  const deleteMutation = useMutation({
    mutationFn: (id: number) => activities.delete(id),
    onSuccess: () => {
      toast.success("Activity log deleted successfully.");
      setDeleteTargetId(null);
      if (selectedActivity?.id === deleteTargetId) {
        setSelectedActivity(null);
      }
      queryClient.invalidateQueries({ queryKey: ["activities-paginated"] });
      queryClient.invalidateQueries({ queryKey: ["activities"] });
    },
    onError: (err: any) => {
      const msg = err.response?.data?.detail || "Failed to delete activity log.";
      toast.error(msg);
    },
  });

  const handleExport = async (format: "csv" | "excel" | "pdf") => {
    try {
      setIsExporting(true);
      toast.info(`Generating ${format.toUpperCase()} export...`);
      const filename = await activities.downloadExport(format, {
        search: search.trim() || undefined,
        action: actionFilter !== "ALL" ? actionFilter : undefined,
        status: statusFilter !== "ALL" ? statusFilter : undefined,
        role: roleFilter !== "ALL" ? roleFilter : undefined,
        start_date: startDate || undefined,
        end_date: endDate || undefined,
        order: sortOrder,
      });
      toast.success(`Export downloaded: ${filename}`);
    } catch (err: any) {
      const msg = err.response?.data?.detail || "Export download failed.";
      toast.error(msg);
    } finally {
      setIsExporting(false);
    }
  };

  const handleCopyMetadata = (data: any) => {
    navigator.clipboard.writeText(JSON.stringify(data, null, 2));
    setIsCopied(true);
    toast.info("Metadata copied to clipboard.");
    setTimeout(() => setIsCopied(false), 2000);
  };

  const resetFilters = () => {
    setSearch("");
    setActionFilter("ALL");
    setStatusFilter("ALL");
    setRoleFilter("ALL");
    setStartDate("");
    setEndDate("");
    setSortOrder("desc");
    setPage(1);
  };

  const hasActiveFilters = useMemo(() => {
    return (
      search !== "" ||
      actionFilter !== "ALL" ||
      statusFilter !== "ALL" ||
      roleFilter !== "ALL" ||
      startDate !== "" ||
      endDate !== "" ||
      sortOrder !== "desc"
    );
  }, [search, actionFilter, statusFilter, roleFilter, startDate, endDate, sortOrder]);

  const items = query.data?.items ?? [];
  const total = query.data?.total ?? 0;
  const totalPages = query.data?.total_pages ?? 1;

  return (
    <main className="mx-auto w-full max-w-5xl space-y-6 px-5 py-8 lg:px-8">
      {/* Top Header */}
      <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <span className="grid size-10 place-items-center rounded-md bg-jade/10 text-jade">
            <Activity className="size-5" />
          </span>
          <div>
            <h1 className="font-display text-2xl font-semibold tracking-tight">
              Activity timeline
            </h1>
            <p className="mt-0.5 text-sm text-muted-foreground">
              A chronological record of contract workspace activity.
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          {/* Auto Refresh Switch */}
          <div className="flex items-center gap-2 rounded-lg border bg-card px-3 py-1.5 shadow-xs">
            <span
              className={`size-2 rounded-full ${
                autoRefresh ? "bg-jade animate-pulse" : "bg-muted-foreground/40"
              }`}
            />
            <label
              htmlFor="auto-refresh-toggle"
              className="text-xs font-medium cursor-pointer select-none text-muted-foreground"
            >
              Auto-refresh (30s)
            </label>
            <Switch
              id="auto-refresh-toggle"
              checked={autoRefresh}
              onCheckedChange={setAutoRefresh}
            />
          </div>

          {/* Manual Refresh Button */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => query.refetch()}
            disabled={query.isFetching}
            className="h-9 gap-1.5"
          >
            <RefreshCw
              className={`size-3.5 ${query.isFetching ? "animate-spin text-jade" : ""}`}
            />
            <span className="hidden sm:inline">Refresh</span>
          </Button>

          {/* Export Dropdown */}
          {canExport && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="default"
                  size="sm"
                  disabled={isExporting}
                  className="h-9 gap-1.5 bg-jade hover:bg-jade/90 text-white font-medium"
                >
                  <Download className="size-3.5" />
                  <span>Export</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuLabel>Export Audit Log</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => handleExport("csv")}
                  className="gap-2 cursor-pointer"
                >
                  <FileText className="size-4 text-emerald-600" />
                  <span>Export as CSV</span>
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => handleExport("excel")}
                  className="gap-2 cursor-pointer"
                >
                  <FileSpreadsheet className="size-4 text-emerald-600" />
                  <span>Export as Excel (.xlsx)</span>
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => handleExport("pdf")}
                  className="gap-2 cursor-pointer"
                >
                  <FileCode className="size-4 text-rose-600" />
                  <span>Export as PDF</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </header>

      {/* Filters Bar */}
      <section className="rounded-lg border bg-card p-4 shadow-hairline space-y-3">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {/* Search Input */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input
              placeholder="Search activities, users, entities..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              className="pl-9 h-9 text-sm"
            />
          </div>

          {/* Action Filter */}
          <Select
            value={actionFilter}
            onValueChange={(val) => {
              setActionFilter(val);
              setPage(1);
            }}
          >
            <SelectTrigger className="h-9 text-sm">
              <SelectValue placeholder="All Actions" />
            </SelectTrigger>
            <SelectContent className="max-h-72">
              {ACTION_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Status Filter */}
          <Select
            value={statusFilter}
            onValueChange={(val) => {
              setStatusFilter(val);
              setPage(1);
            }}
          >
            <SelectTrigger className="h-9 text-sm">
              <SelectValue placeholder="All Statuses" />
            </SelectTrigger>
            <SelectContent>
              {STATUS_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Sort Order Toggle */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => setSortOrder((prev) => (prev === "desc" ? "asc" : "desc"))}
            className="h-9 justify-between text-sm font-normal"
          >
            <span className="text-muted-foreground">Order:</span>
            <span className="font-medium flex items-center gap-1.5">
              <ArrowUpDown className="size-3.5" />
              {sortOrder === "desc" ? "Newest First" : "Oldest First"}
            </span>
          </Button>
        </div>

        {/* Secondary Filter Row: Dates, Role, Reset */}
        <div className="flex flex-wrap items-center gap-3 pt-1 border-t border-border/50 text-xs text-muted-foreground">
          {/* Start Date */}
          <div className="flex items-center gap-1.5">
            <span>From:</span>
            <Input
              type="date"
              value={startDate}
              onChange={(e) => {
                setStartDate(e.target.value);
                setPage(1);
              }}
              className="h-8 w-36 text-xs"
            />
          </div>

          {/* End Date */}
          <div className="flex items-center gap-1.5">
            <span>To:</span>
            <Input
              type="date"
              value={endDate}
              onChange={(e) => {
                setEndDate(e.target.value);
                setPage(1);
              }}
              className="h-8 w-36 text-xs"
            />
          </div>

          {/* Role Filter (if Admin or Compliance) */}
          {(userRole === "Admin" || userRole === "Compliance Officer") && (
            <div className="flex items-center gap-1.5">
              <span>Role:</span>
              <Select
                value={roleFilter}
                onValueChange={(val) => {
                  setRoleFilter(val);
                  setPage(1);
                }}
              >
                <SelectTrigger className="h-8 w-40 text-xs">
                  <SelectValue placeholder="All Roles" />
                </SelectTrigger>
                <SelectContent>
                  {ROLE_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value} className="text-xs">
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Reset Filters */}
          {hasActiveFilters && (
            <Button
              variant="ghost"
              size="sm"
              onClick={resetFilters}
              className="h-8 px-2.5 text-xs text-muted-foreground hover:text-foreground gap-1 ml-auto"
            >
              <FilterX className="size-3.5" />
              Reset filters
            </Button>
          )}
        </div>
      </section>

      {/* Main Timeline Card */}
      <section className="rounded-lg bg-card p-6 shadow-hairline border border-border/50">
        {/* Count & Status Header */}
        <div className="mb-6 flex items-center justify-between pb-3 border-b border-border/50">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Event Stream
            </span>
            <Badge variant="secondary" className="text-xs font-normal">
              {total} {total === 1 ? "record" : "records"}
            </Badge>
          </div>
          {query.isFetching && !query.isLoading && (
            <span className="text-xs text-muted-foreground animate-pulse flex items-center gap-1">
              <RefreshCw className="size-3 animate-spin text-jade" /> Syncing...
            </span>
          )}
        </div>

        {/* Timeline Content */}
        {query.isLoading ? (
          <div className="space-y-6 pl-6 border-l-2 border-jade/30">
            {[1, 2, 3, 4, 5].map((item) => (
              <div key={item} className="relative space-y-2">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-16 w-full rounded-md" />
              </div>
            ))}
          </div>
        ) : items.length > 0 ? (
          <ol className="space-y-6 border-l-2 border-jade/30 pl-6">
            {items.map((item) => {
              const roleBadge = getRoleBadgeVariant(item.user_role);
              const isSuccess = item.status === "success";
              const isError = item.status === "failed" || item.status === "error";
              const isWarning = item.status === "warning";

              return (
                <li
                  key={item.id}
                  onClick={() => setSelectedActivity(item)}
                  className="group relative cursor-pointer rounded-lg p-3 -m-3 transition hover:bg-muted/40 border border-transparent hover:border-border/60"
                >
                  {/* Status Dot */}
                  <span
                    className={`absolute -left-[31px] top-4 grid size-5 place-items-center rounded-full border-2 border-background text-white shadow-xs transition-transform group-hover:scale-110 ${
                      isSuccess
                        ? "bg-jade"
                        : isError
                        ? "bg-rose-500"
                        : isWarning
                        ? "bg-amber-500"
                        : "bg-sky-500"
                    }`}
                  >
                    {isSuccess ? (
                      <CheckCircle2 className="size-3" />
                    ) : isError ? (
                      <XCircle className="size-3" />
                    ) : isWarning ? (
                      <AlertCircle className="size-3" />
                    ) : (
                      <Clock className="size-3" />
                    )}
                  </span>

                  {/* Header Row: User, Role, Timestamp, Status */}
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2.5">
                      <Avatar className="size-6 text-[10px] font-semibold border">
                        <AvatarFallback className="bg-primary/10 text-primary">
                          {getInitials(item.user_name)}
                        </AvatarFallback>
                      </Avatar>
                      <span className="text-sm font-medium text-foreground">
                        {item.user_name || "System"}
                      </span>
                      {item.user_role && (
                        <span
                          className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium border ${roleBadge.bg} ${roleBadge.text} ${roleBadge.border}`}
                        >
                          {item.user_role}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span>{formatRelativeTime(item.timestamp || item.created_at)}</span>
                      <span>·</span>
                      <span>{formatDateTime(item.timestamp || item.created_at)}</span>
                    </div>
                  </div>

                  {/* Body: Action Pill & Description */}
                  <div className="mt-2 flex flex-wrap items-baseline gap-2">
                    <span className="inline-flex items-center rounded bg-muted px-2 py-0.5 text-xs font-mono font-medium text-foreground/90">
                      {item.action}
                    </span>
                    <p className="text-sm text-foreground/90 font-normal">
                      {item.description || item.activity || "Action performed"}
                    </p>
                  </div>

                  {/* Footer Row: Tags, IP, and details hint */}
                  <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-2">
                      {item.contract_id && (
                        <Badge variant="outline" className="text-[11px] font-normal py-0 h-5">
                          Contract #{item.contract_id}
                        </Badge>
                      )}
                      {item.entity_type && item.entity_id && (
                        <Badge variant="secondary" className="text-[11px] font-normal py-0 h-5">
                          {item.entity_type} #{item.entity_id}
                        </Badge>
                      )}
                      {item.ip_address && (
                        <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                          <Globe className="size-3" />
                          {item.ip_address}
                        </span>
                      )}
                    </div>

                    <span className="text-xs text-jade opacity-0 transition-opacity group-hover:opacity-100 font-medium">
                      View details →
                    </span>
                  </div>
                </li>
              );
            })}
          </ol>
        ) : (
          <div className="py-12 text-center">
            <div className="mx-auto grid size-12 place-items-center rounded-full bg-muted">
              <Activity className="size-6 text-muted-foreground" />
            </div>
            <h3 className="mt-3 text-sm font-semibold text-foreground">No activity recorded</h3>
            <p className="mt-1 text-xs text-muted-foreground max-w-sm mx-auto">
              {hasActiveFilters
                ? "No activities matched your current filters. Try changing or resetting them."
                : "No platform activities have been logged yet."}
            </p>
            {hasActiveFilters && (
              <Button
                variant="outline"
                size="sm"
                onClick={resetFilters}
                className="mt-4 h-8 text-xs gap-1.5"
              >
                <FilterX className="size-3.5" />
                Reset Filters
              </Button>
            )}
          </div>
        )}

        {/* Pagination Bar */}
        {totalPages > 1 && (
          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between pt-4 border-t border-border/50">
            <p className="text-xs text-muted-foreground">
              Showing page <span className="font-medium text-foreground">{page}</span> of{" "}
              <span className="font-medium text-foreground">{totalPages}</span> ({total} total)
            </p>
            <div className="flex items-center gap-1.5">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1 || query.isLoading}
                className="h-8 px-2.5 text-xs gap-1"
              >
                <ChevronLeft className="size-3.5" />
                Previous
              </Button>
              <span className="px-2 text-xs text-muted-foreground">
                {page} / {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages || query.isLoading}
                className="h-8 px-2.5 text-xs gap-1"
              >
                Next
                <ChevronRight className="size-3.5" />
              </Button>
            </div>
          </div>
        )}
      </section>

      {/* Interactive Detail Drawer */}
      <Sheet open={!!selectedActivity} onOpenChange={(open) => !open && setSelectedActivity(null)}>
        <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
          {selectedActivity && (
            <div className="space-y-6 py-2">
              <SheetHeader className="text-left space-y-1 border-b pb-4">
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="font-mono text-xs">
                    LOG #{selectedActivity.id}
                  </Badge>
                  <Badge
                    variant={
                      selectedActivity.status === "success"
                        ? "default"
                        : selectedActivity.status === "failed"
                        ? "destructive"
                        : "secondary"
                    }
                    className="text-xs capitalize"
                  >
                    {selectedActivity.status}
                  </Badge>
                </div>
                <SheetTitle className="text-xl font-display font-semibold pt-1">
                  {selectedActivity.action}
                </SheetTitle>
                <SheetDescription className="text-xs">
                  Audit event details and recorded context metadata.
                </SheetDescription>
              </SheetHeader>

              {/* Event Overview Grid */}
              <div className="grid grid-cols-2 gap-4 text-xs">
                <div className="space-y-1">
                  <span className="text-muted-foreground flex items-center gap-1">
                    <UserIcon className="size-3.5" /> Performed By
                  </span>
                  <p className="font-medium text-foreground">
                    {selectedActivity.user_name || "System"}
                    {selectedActivity.user_id && (
                      <span className="text-muted-foreground ml-1">
                        (ID #{selectedActivity.user_id})
                      </span>
                    )}
                  </p>
                </div>

                <div className="space-y-1">
                  <span className="text-muted-foreground flex items-center gap-1">
                    <Shield className="size-3.5" /> User Role
                  </span>
                  <p className="font-medium text-foreground">
                    {selectedActivity.user_role || "—"}
                  </p>
                </div>

                <div className="space-y-1">
                  <span className="text-muted-foreground flex items-center gap-1">
                    <Clock className="size-3.5" /> Timestamp
                  </span>
                  <p className="font-medium text-foreground">
                    {formatDateTime(selectedActivity.timestamp || selectedActivity.created_at)}
                  </p>
                </div>

                <div className="space-y-1">
                  <span className="text-muted-foreground flex items-center gap-1">
                    <Globe className="size-3.5" /> Client IP Address
                  </span>
                  <p className="font-medium font-mono text-foreground">
                    {selectedActivity.ip_address || "Unknown"}
                  </p>
                </div>

                {selectedActivity.contract_id && (
                  <div className="space-y-1">
                    <span className="text-muted-foreground flex items-center gap-1">
                      <Layers className="size-3.5" /> Contract ID
                    </span>
                    <p className="font-medium text-foreground">
                      #{selectedActivity.contract_id}
                    </p>
                  </div>
                )}

                {selectedActivity.entity_type && (
                  <div className="space-y-1">
                    <span className="text-muted-foreground flex items-center gap-1">
                      <Layers className="size-3.5" /> Affected Entity
                    </span>
                    <p className="font-medium text-foreground">
                      {selectedActivity.entity_type}{" "}
                      {selectedActivity.entity_id ? `(#${selectedActivity.entity_id})` : ""}
                    </p>
                  </div>
                )}
              </div>

              {/* Description */}
              <div className="space-y-1.5 rounded-md bg-muted/50 p-3 text-xs border">
                <span className="font-medium text-foreground">Narrative Description:</span>
                <p className="text-muted-foreground leading-relaxed">
                  {selectedActivity.description ||
                    selectedActivity.activity ||
                    "No description available."}
                </p>
              </div>

              {/* Formatted Metadata JSON */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Event Metadata
                  </span>
                  {selectedActivity.metadata && Object.keys(selectedActivity.metadata).length > 0 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleCopyMetadata(selectedActivity.metadata)}
                      className="h-7 px-2 text-xs gap-1"
                    >
                      {isCopied ? <Check className="size-3 text-jade" /> : <Copy className="size-3" />}
                      <span>{isCopied ? "Copied" : "Copy JSON"}</span>
                    </Button>
                  )}
                </div>

                {selectedActivity.metadata && Object.keys(selectedActivity.metadata).length > 0 ? (
                  <pre className="max-h-64 overflow-auto rounded-lg bg-zinc-950 p-3.5 font-mono text-[11px] text-zinc-100 border border-zinc-800">
                    {JSON.stringify(selectedActivity.metadata, null, 2)}
                  </pre>
                ) : (
                  <p className="text-xs text-muted-foreground italic bg-muted/30 p-3 rounded border">
                    No contextual metadata payload attached to this record.
                  </p>
                )}
              </div>

              {/* Actions Footer: Admin Delete */}
              {canDelete && (
                <div className="pt-4 border-t space-y-3">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setDeleteTargetId(selectedActivity.id)}
                    className="w-full text-rose-600 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/20 border-rose-200 dark:border-rose-900 gap-1.5 h-9"
                  >
                    <Trash2 className="size-3.5" />
                    Delete Audit Log Entry
                  </Button>
                </div>
              )}
            </div>
          )}
        </SheetContent>
      </Sheet>

      {/* Delete Confirmation Alert Dialog (Admin only) */}
      <AlertDialog open={!!deleteTargetId} onOpenChange={(open) => !open && setDeleteTargetId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Activity Log Entry?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete activity log entry #{deleteTargetId}? This action
              cannot be undone and will permanently remove this record from the database.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteMutation.isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteTargetId && deleteMutation.mutate(deleteTargetId)}
              disabled={deleteMutation.isPending}
              className="bg-rose-600 hover:bg-rose-700 text-white"
            >
              {deleteMutation.isPending ? "Deleting..." : "Delete Log"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </main>
  );
}
