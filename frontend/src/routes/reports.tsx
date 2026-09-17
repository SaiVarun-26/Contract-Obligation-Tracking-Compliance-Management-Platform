import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import {
  AlertCircle,
  BarChart3,
  CheckCircle2,
  Clock,
  Download,
  FileBarChart2,
  FileCheck2,
  FileClock,
  FileSpreadsheet,
  FileText,
  Loader2,
  Lock,
  RefreshCw,
  Search,
  ShieldCheck,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { reports, reportFiles } from "@/lib/api/resources";
import type { Report } from "@/lib/api/types";
import { ProtectedRoute } from "@/components/auth/protected-route";
import { useAuth } from "@/lib/auth/auth-context";
import { canDeleteReport, canGenerateReportType, normalizeRole } from "@/lib/auth/permissions";

export const Route = createFileRoute("/reports")({ component: ReportsPageWrapper });

function ReportsPageWrapper() {
  return (
    <ProtectedRoute permission="reports:view">
      <ReportsPage />
    </ProtectedRoute>
  );
}

const REPORT_DEFINITIONS = [
  {
    type: "Compliance Report",
    label: "Compliance Report",
    description: "Evaluates contract obligation scores, overdue percentages, high-risk flags, and violation statistics.",
    icon: ShieldCheck,
    rolesRequired: "Compliance Officer, Legal Manager, Admin",
  },
  {
    type: "Contract Report",
    label: "Contract Report",
    description: "Summarizes contract lifecycle portfolio, status distributions, active contracts, and departmental allocations.",
    icon: FileText,
    rolesRequired: "Contract Manager, Legal Manager, Admin",
  },
  {
    type: "Renewal Report",
    label: "Renewal Report",
    description: "Tracks upcoming renewals, completed contract extensions, lapsed renewals, and renewal deadlines.",
    icon: FileClock,
    rolesRequired: "Contract Manager, Legal Manager, Admin",
  },
  {
    type: "Obligation Report",
    label: "Obligation Report",
    description: "Detailed analysis of deliverables, completion metrics, pending tasks, and priority distributions.",
    icon: FileCheck2,
    rolesRequired: "Compliance Officer, Legal Manager, Admin",
  },
  {
    type: "Audit Report",
    label: "Audit Trail Report",
    description: "Full audit trail of user access, contract modifications, approval records, and entity state transitions.",
    icon: BarChart3,
    rolesRequired: "Legal Manager, Admin",
  },
];

function formatDate(dateStr?: string | null): string {
  if (!dateStr) return "—";
  try {
    const d = new Date(dateStr);
    return d.toLocaleString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return dateStr;
  }
}

function ReportsPage() {
  const { user } = useAuth();
  const userRole = normalizeRole(user?.role);
  const client = useQueryClient();

  const [format, setFormat] = useState<"pdf" | "excel">("pdf");
  const [busyType, setBusyType] = useState<string | null>(null);
  const [downloadingId, setDownloadingId] = useState<number | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  const listQuery = useQuery({
    queryKey: ["reports"],
    queryFn: reports.list,
  });

  const generate = async (type: string, label: string) => {
    setBusyType(type);
    const toastId = toast.loading(`Generating ${label} as ${format.toUpperCase()}...`);
    try {
      await reports.generate({
        report_type: type,
        file_format: format,
        report_name: `${label} (${format.toUpperCase()})`,
      });
      await client.invalidateQueries({ queryKey: ["reports"] });
      toast.success(`${label} generated successfully!`, { id: toastId });
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Report generation failed. Please try again.",
        { id: toastId }
      );
    } finally {
      setBusyType(null);
    }
  };

  const download = async (report: Report) => {
    setDownloadingId(report.id);
    const toastId = toast.loading(`Preparing ${report.report_name} download...`);
    try {
      const ext = report.file_format === "excel" ? "xlsx" : "pdf";
      const fallback = `${report.report_name.replace(/\s+/g, "_")}.${ext}`;
      const savedName = await reportFiles.download(report.id, fallback);
      // Invalidate to refresh the incremented download counter
      await client.invalidateQueries({ queryKey: ["reports"] });
      toast.success(`Downloaded ${savedName || report.report_name}`, { id: toastId });
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Unable to download report file.",
        { id: toastId }
      );
    } finally {
      setDownloadingId(null);
    }
  };

  const deleteReport = async (report: Report) => {
    const confirmed = window.confirm(
      `Are you sure you want to permanently delete "${report.report_name}" and its generated file?`
    );
    if (!confirmed) return;

    setDeletingId(report.id);
    const toastId = toast.loading(`Deleting ${report.report_name}...`);
    try {
      await reports.delete(report.id);
      await client.invalidateQueries({ queryKey: ["reports"] });
      toast.success("Report deleted successfully", { id: toastId });
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Unable to delete report.",
        { id: toastId }
      );
    } finally {
      setDeletingId(null);
    }
  };

  const allReports = listQuery.data || [];
  const filteredReports = allReports.filter((r) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      r.report_name.toLowerCase().includes(q) ||
      r.report_type.toLowerCase().includes(q) ||
      (r.file_format || "").toLowerCase().includes(q) ||
      (r.generated_by_name || "").toLowerCase().includes(q)
    );
  });

  return (
    <main className="mx-auto w-full max-w-7xl space-y-8 px-5 py-8 lg:px-8">
      {/* Header Banner */}
      <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-4">
          <span className="grid size-12 place-items-center rounded-xl bg-primary/10 text-primary shadow-sm">
            <FileBarChart2 className="size-6 text-emerald-600 dark:text-emerald-400" />
          </span>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="font-display text-2xl font-bold tracking-tight text-foreground">
                Operational Reports
              </h1>
              <span className="rounded-full bg-muted px-2.5 py-0.5 text-xs font-semibold text-muted-foreground">
                Role: {userRole}
              </span>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              Generate real-time database reports in PDF and Excel formats with audit history.
            </p>
          </div>
        </div>

        {/* Global Controls & Format Selector */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center rounded-lg border bg-card p-1 shadow-sm">
            <button
              type="button"
              onClick={() => setFormat("pdf")}
              className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition-all ${
                format === "pdf"
                  ? "bg-rose-600 text-white shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <FileText className="size-3.5" />
              PDF Document
            </button>
            <button
              type="button"
              onClick={() => setFormat("excel")}
              className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition-all ${
                format === "excel"
                  ? "bg-emerald-600 text-white shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <FileSpreadsheet className="size-3.5" />
              Excel (.xlsx)
            </button>
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={() => client.invalidateQueries({ queryKey: ["reports"] })}
            disabled={listQuery.isFetching}
            className="gap-1.5"
          >
            <RefreshCw className={`size-3.5 ${listQuery.isFetching ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>
      </header>

      {/* Role Notice Banner for Viewer */}
      {userRole === "Viewer" && (
        <div className="flex items-center gap-3 rounded-lg border border-amber-200 bg-amber-50/70 p-4 text-sm text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/20 dark:text-amber-300">
          <AlertCircle className="size-5 shrink-0 text-amber-600 dark:text-amber-400" />
          <div>
            <span className="font-semibold">Viewer Access Mode:</span> You have view and download permissions for all generated enterprise reports. Generation of new reports requires managerial credentials.
          </div>
        </div>
      )}

      {/* 5 Report Generation Cards */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-base font-semibold text-foreground">
            Generate Operational Reports
          </h2>
          <span className="text-xs text-muted-foreground">
            Target Output: <b className="uppercase text-foreground">{format}</b>
          </span>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {REPORT_DEFINITIONS.map((item) => {
            const isAllowed = canGenerateReportType(userRole, item.type);
            const isCurrentBusy = busyType === item.type;

            return (
              <div
                key={item.type}
                className={`group relative flex flex-col justify-between rounded-xl border bg-card p-5 shadow-sm transition-all hover:shadow-md ${
                  !isAllowed ? "opacity-75 bg-muted/30" : ""
                }`}
              >
                <div>
                  <div className="flex items-center justify-between">
                    <span className="grid size-10 place-items-center rounded-lg bg-primary/10 text-primary">
                      <item.icon className="size-5 text-emerald-600 dark:text-emerald-400" />
                    </span>
                    {isAllowed ? (
                      <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
                        Authorized
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                        <Lock className="size-3" />
                        Restricted
                      </span>
                    )}
                  </div>

                  <h3 className="mt-3 font-display text-base font-semibold text-foreground">
                    {item.label}
                  </h3>
                  <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                    {item.description}
                  </p>
                </div>

                <div className="mt-4 pt-3 border-t border-border/60">
                  {isAllowed ? (
                    <Button
                      className="w-full gap-2 font-medium"
                      size="sm"
                      onClick={() => generate(item.type, item.label)}
                      disabled={busyType !== null}
                    >
                      {isCurrentBusy ? (
                        <>
                          <Loader2 className="size-4 animate-spin" />
                          Generating {format.toUpperCase()}…
                        </>
                      ) : (
                        <>
                          {format === "pdf" ? (
                            <FileText className="size-4 text-rose-300" />
                          ) : (
                            <FileSpreadsheet className="size-4 text-emerald-300" />
                          )}
                          Generate {format.toUpperCase()}
                        </>
                      )}
                    </Button>
                  ) : (
                    <div className="rounded-md bg-muted/60 px-3 py-2 text-center text-xs text-muted-foreground">
                      <span>Restricted. Requires: </span>
                      <span className="font-semibold text-foreground">{item.rolesRequired}</span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Generated Reports History Section */}
      <section className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="font-display text-base font-semibold text-foreground">
              Report History & Downloads
            </h2>
            <p className="text-xs text-muted-foreground">
              Persistent storage repository. Reports are generated once and can be downloaded multiple times.
            </p>
          </div>

          <div className="relative w-full sm:w-64">
            <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
            <Input
              placeholder="Search reports..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8 text-xs h-9"
            />
          </div>
        </div>

        {listQuery.isLoading ? (
          <div className="flex flex-col items-center justify-center rounded-xl border border-dashed p-12 text-center">
            <Loader2 className="size-8 animate-spin text-muted-foreground" />
            <p className="mt-3 text-sm text-muted-foreground">Loading report archive...</p>
          </div>
        ) : filteredReports.length > 0 ? (
          <div className="overflow-hidden rounded-xl border bg-card shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="border-b bg-muted/40 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3">Report Details</th>
                    <th className="px-4 py-3">Format</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Generated By</th>
                    <th className="px-4 py-3">Date Generated</th>
                    <th className="px-4 py-3 text-center">Downloads</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {filteredReports.map((report) => {
                    const isExcel = (report.file_format || "").toLowerCase() === "excel";
                    const isDownloading = downloadingId === report.id;
                    const isDeleting = deletingId === report.id;

                    return (
                      <tr key={report.id} className="transition-colors hover:bg-muted/30">
                        <td className="px-4 py-3.5">
                          <div className="font-medium text-foreground">{report.report_name}</div>
                          <div className="text-xs text-muted-foreground">{report.report_type}</div>
                        </td>

                        <td className="px-4 py-3.5">
                          {isExcel ? (
                            <span className="inline-flex items-center gap-1.5 rounded-md bg-emerald-500/10 px-2.5 py-1 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                              <FileSpreadsheet className="size-3.5" />
                              Excel (.xlsx)
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 rounded-md bg-rose-500/10 px-2.5 py-1 text-xs font-semibold text-rose-600 dark:text-rose-400">
                              <FileText className="size-3.5" />
                              PDF
                            </span>
                          )}
                        </td>

                        <td className="px-4 py-3.5">
                          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2 py-0.5 text-xs font-medium text-emerald-600 dark:text-emerald-400">
                            <CheckCircle2 className="size-3" />
                            {report.status || "Completed"}
                          </span>
                        </td>

                        <td className="px-4 py-3.5 text-xs text-muted-foreground">
                          {report.generated_by_name || (report.generated_by ? `User #${report.generated_by}` : "System")}
                        </td>

                        <td className="px-4 py-3.5 text-xs text-muted-foreground whitespace-nowrap">
                          <div className="flex items-center gap-1.5">
                            <Clock className="size-3 text-muted-foreground" />
                            {formatDate(report.generated_at)}
                          </div>
                        </td>

                        <td className="px-4 py-3.5 text-center">
                          <span className="inline-flex items-center rounded-full bg-secondary px-2.5 py-0.5 text-xs font-semibold text-secondary-foreground">
                            {report.download_count ?? 0} {report.download_count === 1 ? "download" : "downloads"}
                          </span>
                        </td>

                        <td className="px-4 py-3.5 text-right whitespace-nowrap">
                          <div className="flex items-center justify-end gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => download(report)}
                              disabled={isDownloading || isDeleting}
                              className="h-8 gap-1.5 text-xs font-medium"
                            >
                              {isDownloading ? (
                                <Loader2 className="size-3.5 animate-spin" />
                              ) : (
                                <Download className="size-3.5" />
                              )}
                              Download
                            </Button>

                            {canDeleteReport(userRole) && (
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => deleteReport(report)}
                                disabled={isDownloading || isDeleting}
                                className="h-8 text-rose-600 hover:bg-rose-50 hover:text-rose-700 dark:hover:bg-rose-950/30"
                                title="Delete report and file (Admin only)"
                              >
                                {isDeleting ? (
                                  <Loader2 className="size-3.5 animate-spin" />
                                ) : (
                                  <Trash2 className="size-3.5" />
                                )}
                              </Button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-card/40 p-12 text-center">
            <div className="grid size-12 place-items-center rounded-full bg-muted text-muted-foreground">
              <FileBarChart2 className="size-6" />
            </div>
            <h3 className="mt-4 font-display text-sm font-semibold text-foreground">
              {searchQuery ? "No matching reports found" : "No reports generated yet"}
            </h3>
            <p className="mt-1 max-w-sm text-xs text-muted-foreground">
              {searchQuery
                ? "Try adjusting your search terms or filter to find the report."
                : "Select your desired format (PDF or Excel) above and click Generate to produce your first enterprise report."}
            </p>
          </div>
        )}
      </section>
    </main>
  );
}
