import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, CalendarDays, CircleCheck, FilePlus2, ShieldAlert, UsersRound } from "lucide-react";
import { dashboardApi } from "@/lib/api/dashboard";
import { activities, compliance, contracts, notifications, obligations, renewals as renewalApi, users } from "@/lib/api/resources";
import { apiErrorMessage } from "@/lib/api/errors";
import { useAuth } from "@/lib/auth/auth-context";
import { hasPermission } from "@/lib/auth/permissions";

export const Route = createFileRoute("/")({ component: Index });

function Index() {
  const { user } = useAuth();
  const canManageUsers = hasPermission(user?.role, "users:manage");
  const summary = useQuery({ queryKey: ["dashboard", "summary"], queryFn: dashboardApi.summary });
  const renewals = useQuery({
    queryKey: ["dashboard", "upcoming-renewals"],
    queryFn: dashboardApi.upcomingRenewals,
  });
  const contractStatus = useQuery({
    queryKey: ["dashboard", "contract-status"],
    queryFn: dashboardApi.contractStatus,
  });
  const obligationStatus = useQuery({
    queryKey: ["dashboard", "obligation-status"],
    queryFn: dashboardApi.obligationStatus,
  });
  const obligationList = useQuery({ queryKey: ["obligations"], queryFn: obligations.list });
  const renewalList = useQuery({ queryKey: ["renewals"], queryFn: renewalApi.list });
  const contractList = useQuery({ queryKey: ["contracts"], queryFn: contracts.list });
  const userList = useQuery({ queryKey: ["users"], queryFn: users.list, enabled: canManageUsers });
  const activityList = useQuery({ queryKey: ["activities"], queryFn: activities.list });
  const complianceList = useQuery({ queryKey: ["compliance", "high-risk"], queryFn: compliance.highRisk });
  const notificationList = useQuery({ queryKey: ["notifications"], queryFn: notifications.list });
  const queriesToCheck = [
    summary,
    renewals,
    contractStatus,
    obligationStatus,
    obligationList,
    complianceList,
    notificationList,
    renewalList,
    contractList,
    activityList,
    ...(canManageUsers ? [userList] : []),
  ];
  const failed = queriesToCheck.find((query) => query.isError);
  const overdue = (obligationList.data ?? []).filter((item) => item.status === "Overdue");
  const unread = (notificationList.data ?? []).filter((item) => item.status !== "Read");
  return (
    <main className="mx-auto w-full max-w-[1500px] px-5 py-7 lg:px-8">
      <header className="mb-7">
        <p className="mb-2 text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
          Operational workspace
        </p>
        <h1 className="font-display text-3xl font-semibold leading-tight">Approval Queue</h1>
        <p className="mt-1.5 text-sm text-muted-foreground">
          {summary.data?.contracts.total ?? 0} contracts · {summary.data?.obligations.overdue ?? 0}{" "}
          overdue obligations
        </p>
      </header>
      {failed ? (
        <p className="mb-6 rounded-md border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
          {apiErrorMessage(failed.error, "Unable to load dashboard data.")}
        </p>
      ) : null}
      <QuickActions role={user?.role} />
      <AdminStats users={canManageUsers ? (userList.data?.length ?? 0) : null} contracts={contractList.data?.length ?? 0} renewals={renewalList.data?.length ?? 0} compliance={complianceList.data?.length ?? 0} activities={activityList.data?.length ?? 0} notifications={notificationList.data?.length ?? 0} />
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
        <div className="space-y-6 xl:col-span-8">
          <RecentContracts items={contractList.data ?? []} />
          <Panel
            title="Upcoming renewals"
            count={`${summary.data?.renewals.upcoming ?? 0} upcoming`}
            icon={<CircleCheck className="size-4 text-jade" />}
          >
            {(renewals.data ?? []).map((item) => (
              <Row
                key={item.id}
                title={item.contract_title}
                detail={item.status}
                value={item.renewal_date}
              />
            ))}
            <Empty
              show={!renewals.isLoading && !renewals.data?.length}
              text="No upcoming renewals."
            />
          </Panel>
          <CalendarPanel obligations={obligationList.data ?? []} renewals={renewalList.data ?? []} />
          <Panel title="Recent notifications" count={`${unread.length} unread`}>
            {unread.slice(0, 5).map((item) => (
              <Row
                key={item.id}
                title={item.title}
                detail={item.message}
                value={new Date(item.created_at).toLocaleDateString()}
              />
            ))}
            <Empty
              show={!notificationList.isLoading && !unread.length}
              text="No unread notifications."
            />
          </Panel>
        </div>
        <aside className="space-y-6 xl:col-span-4">
          <Panel
            title="Overdue obligations"
            count={`${overdue.length}`}
            icon={<AlertTriangle className="size-4 text-jade" />}
          >
            {overdue.map((item) => (
              <Row
                key={item.id}
                title={item.title}
                detail={item.obligation_type}
                value={item.due_date}
                emphasis
              />
            ))}
            <Empty
              show={!obligationList.isLoading && !overdue.length}
              text="No overdue obligations."
            />
          </Panel>
          <Panel
            title="High-risk compliance"
            count={`${(complianceList.data ?? []).length}`}
            icon={<ShieldAlert className="size-4 text-jade" />}
          >
            {(complianceList.data ?? []).map((item) => (
              <Row
                key={item.contract_id}
                title={item.contract_title}
                detail={item.status}
                value={item.risk_level}
                emphasis
              />
            ))}
            <Empty
              show={!complianceList.isLoading && !complianceList.data?.length}
              text="No high-risk contracts."
            />
          </Panel>
          <Panel title="Portfolio summary">
            <div className="grid grid-cols-2 gap-px bg-border text-xs">
              <Metric label="Active contracts" value={summary.data?.contracts.active ?? 0} />
              <Metric label="Pending obligations" value={summary.data?.obligations.pending ?? 0} />
              <Metric label="Renewals" value={summary.data?.renewals.total ?? 0} />
              <Metric label="Expired contracts" value={summary.data?.contracts.expired ?? 0} />
            </div>
          </Panel>
          <Panel title="Status analytics">
            <StatusGroup label="Contracts" items={contractStatus.data ?? []} />
            <StatusGroup label="Obligations" items={obligationStatus.data ?? []} />
          </Panel>
          <Panel title="Recent activity" count={`${activityList.data?.length ?? 0} events`}><div className="divide-y divide-border/60">{(activityList.data ?? []).slice(-5).reverse().map((item) => <Row key={item.id} title={item.activity} detail={`Contract ${item.contract_id} · User ${item.user_id}`} value={item.created_at ? new Date(item.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "—"} />)}</div></Panel>
        </aside>
      </div>
    </main>
  );
}

function QuickActions({ role }: { role?: string }) {
  const actions: { label: string; to: string; icon: typeof FilePlus2; permission: Parameters<typeof hasPermission>[1] }[] = [
    { label: "Contract", to: "/contracts", icon: FilePlus2, permission: "contracts:create" },
    { label: "User", to: "/users", icon: UsersRound, permission: "users:manage" },
    { label: "Obligation", to: "/obligations", icon: FilePlus2, permission: "obligations:create" },
    { label: "Renewal", to: "/renewals", icon: CalendarDays, permission: "renewals:create" },
    { label: "Report", to: "/reports", icon: FilePlus2, permission: "reports:view" },
  ];
  const allowed = actions.filter((a) => hasPermission(role, a.permission));
  if (allowed.length === 0) return null;
  return (
    <section className="mb-6 rounded-lg bg-card p-4 shadow-hairline">
      <div className="flex flex-wrap items-center gap-2">
        <span className="mr-2 text-sm font-semibold">Quick actions</span>
        {allowed.map((action) => (
          <Link
            key={action.label}
            to={action.to}
            className="inline-flex items-center gap-2 rounded-md border border-border px-3 py-2 text-sm transition-colors hover:border-jade hover:text-jade"
          >
            <action.icon className="size-4" />+ {action.label}
          </Link>
        ))}
      </div>
    </section>
  );
}

function AdminStats({
  users,
  contracts,
  renewals,
  compliance,
  activities,
  notifications,
}: {
  users: number | null;
  contracts: number;
  renewals: number;
  compliance: number;
  activities: number;
  notifications: number;
}) {
  const statList: [string, number][] = [
    ...(users !== null ? [["Users", users] as [string, number]] : []),
    ["Contracts", contracts],
    ["Renewals", renewals],
    ["Compliance", compliance],
    ["Activities", activities],
    ["Notifications", notifications],
  ];
  return (
    <section className={`mb-6 grid grid-cols-2 gap-px overflow-hidden rounded-lg bg-border shadow-hairline sm:grid-cols-3 lg:grid-cols-${statList.length}`}>
      {statList.map(([label, value]) => (
        <div key={label} className="bg-card p-4">
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className="mt-1 font-display text-2xl font-semibold text-jade">{value}</p>
        </div>
      ))}
    </section>
  );
}
function RecentContracts({ items }: { items: Array<{ id: number; title: string; status: string; updated_at: string }> }) { const recent = [...items].sort((a, b) => b.updated_at.localeCompare(a.updated_at)).slice(0, 5); return <Panel title="Recent contracts" count="Latest edited"><div className="divide-y divide-border/60">{recent.map((item) => <Link key={item.id} to="/contracts/$contractId" params={{ contractId: String(item.id) }}><Row title={item.title} detail={item.status} value={item.updated_at ? new Date(item.updated_at).toLocaleDateString() : "—"} /></Link>)}{!recent.length ? <Empty show text="No contracts yet." /> : null}</div></Panel>; }

function CalendarPanel({
  obligations,
  renewals,
}: {
  obligations: Array<{ id: number; title: string; due_date: string; status: string }>;
  renewals: Array<{ id: number; renewal_date: string; status: string }>;
}) {
  const today = new Date();
  const events = [
    ...obligations.map((item) => ({ id: `o-${item.id}`, date: item.due_date, label: item.title, type: item.status === "Completed" ? "completed" : "deadline" })),
    ...renewals.map((item) => ({ id: `r-${item.id}`, date: item.renewal_date, label: "Renewal", type: item.status === "Expired" ? "expired" : "renewal" })),
  ].sort((a, b) => a.date.localeCompare(b.date));
  return <Panel title="Calendar" count={`${events.length} tracked dates`} icon={<CalendarDays className="size-4 text-jade" />}>
    <div className="grid gap-2 p-5 sm:grid-cols-2 lg:grid-cols-3">
      {events.slice(0, 12).map((event) => {
        const days = Math.ceil((new Date(`${event.date}T00:00:00`).getTime() - new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime()) / 86400000);
        const tone = event.type === "expired" || days < 0 ? "text-destructive" : days <= 30 ? "text-amber-700" : "text-jade";
        return <div key={event.id} className="rounded-md border border-border/70 p-3"><p className="text-xs text-muted-foreground">{event.date}</p><p className="mt-1 truncate text-sm font-medium">{event.label}</p><p className={`mt-1 text-xs ${tone}`}>{event.type === "expired" || days < 0 ? "Expired" : days === 0 ? "Today" : `${days} days`}</p></div>;
      })}
      {!events.length ? <p className="text-sm text-muted-foreground">No renewals or deadlines scheduled.</p> : null}
    </div>
  </Panel>;
}

function StatusGroup({
  label,
  items,
}: {
  label: string;
  items: Array<{ status: string; count: number }>;
}) {
  const total = items.reduce((sum, item) => sum + item.count, 0);
  return (
    <div className="border-b border-border/60 px-5 py-4 last:border-b-0">
      <div className="mb-3 flex items-center justify-between text-xs">
        <span className="font-medium">{label}</span>
        <span className="text-muted-foreground">{total} total</span>
      </div>
      <div className="space-y-2">
        {items.map((item) => (
          <div key={`${label}-${item.status}`} className="flex items-center gap-3 text-xs">
            <span className="w-24 truncate text-muted-foreground">{item.status}</span>
            <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-secondary">
              <span
                className="block h-full rounded-full bg-jade"
                style={{ width: `${total ? (item.count / total) * 100 : 0}%` }}
              />
            </span>
            <span className="w-6 text-right tabular-nums">{item.count}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
function Panel({
  title,
  count,
  icon,
  children,
}: {
  title: string;
  count?: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="rise overflow-hidden rounded-lg bg-card shadow-hairline">
      <div className="flex items-center gap-2 px-5 py-3.5">
        {icon}
        <h2 className="font-display text-sm font-semibold">{title}</h2>
        {count ? <span className="ml-auto text-xs text-muted-foreground">{count}</span> : null}
      </div>
      <div className="border-t border-border/70">{children}</div>
    </section>
  );
}
function Row({
  title,
  detail,
  value,
  emphasis = false,
}: {
  title: string;
  detail: string;
  value: string;
  emphasis?: boolean;
}) {
  return (
    <div className="flex items-center gap-4 border-b border-border/60 px-5 py-3 last:border-b-0">
      <span className="size-1.5 shrink-0 rounded-full bg-jade" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-[13px] font-medium">{title}</p>
        <p className="truncate text-xs text-muted-foreground">{detail}</p>
      </div>
      <span
        className={
          emphasis ? "text-xs font-medium text-jade" : "text-xs tabular-nums text-muted-foreground"
        }
      >
        {value}
      </span>
    </div>
  );
}
function Empty({ show, text }: { show: boolean; text: string }) {
  return show ? (
    <p className="px-5 py-8 text-center text-sm text-muted-foreground">{text}</p>
  ) : null;
}
function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="bg-card px-4 py-3">
      <p className="text-muted-foreground">{label}</p>
      <p className="font-medium text-jade">{value}</p>
    </div>
  );
}
