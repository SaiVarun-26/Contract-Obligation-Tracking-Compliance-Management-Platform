import { Link, useRouterState } from "@tanstack/react-router";
import {
  Activity,
  Bell,
  ChartNoAxesCombined,
  CircleUserRound,
  FileCheck2,
  FileText,
  Gauge,
  LogOut,
  RefreshCw,
  Settings,
  ShieldCheck,
  SlidersHorizontal,
} from "lucide-react";
import { useState, type ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth/auth-context";
import { hasPermission, normalizeRole, type Permission } from "@/lib/auth/permissions";
import { LogoutDialog } from "@/components/auth/logout-dialog";

type NavItem = {
  title: string;
  to:
    | "/"
    | "/contracts"
    | "/obligations"
    | "/renewals"
    | "/compliance"
    | "/reports"
    | "/notifications"
    | "/activity-logs"
    | "/users"
    | "/profile"
    | "/settings";
  icon: LucideIcon;
  badge?: string;
  permission?: Permission;
};

const workspaceItems: NavItem[] = [
  { title: "Dashboard", to: "/", icon: Gauge, badge: "4" },
  { title: "Contracts", to: "/contracts", icon: FileText },
  { title: "Obligations", to: "/obligations", icon: FileCheck2 },
  { title: "Renewals", to: "/renewals", icon: RefreshCw },
  { title: "Compliance", to: "/compliance", icon: ShieldCheck },
  { title: "Reports", to: "/reports", icon: ChartNoAxesCombined, permission: "reports:view" },
];

const systemItems: NavItem[] = [
  { title: "Notifications", to: "/notifications", icon: Bell, badge: "12" },
  { title: "Activity Logs", to: "/activity-logs", icon: Activity, permission: "activities:view" },
  { title: "Users", to: "/users", icon: SlidersHorizontal, permission: "users:manage" },
  { title: "Profile", to: "/profile", icon: CircleUserRound },
  { title: "Settings", to: "/settings", icon: Settings },
];

function LedgerSidebar() {
  const { user } = useAuth();
  const userRole = user?.role;
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const { state } = useSidebar();
  const collapsed = state === "collapsed";

  const filterPermitted = (items: NavItem[]) =>
    items.filter((item) => !item.permission || hasPermission(userRole, item.permission));

  const renderItems = (items: NavItem[]) =>
    filterPermitted(items).map((item) => (
      <SidebarMenuItem key={item.to}>
        <SidebarMenuButton asChild isActive={pathname === item.to} tooltip={item.title}>
          <Link to={item.to}>
            <item.icon />
            <span>{item.title}</span>
          </Link>
        </SidebarMenuButton>
        {item.badge && !collapsed ? <SidebarMenuBadge>{item.badge}</SidebarMenuBadge> : null}
      </SidebarMenuItem>
    ));

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="px-3 py-4">
        <Link to="/" className="flex items-center gap-2.5 overflow-hidden px-1">
          <span className="grid size-8 shrink-0 place-items-center rounded-md bg-sidebar-primary font-display text-sm font-semibold text-sidebar-primary-foreground">
            V
          </span>
          <span className="min-w-0 leading-tight group-data-[collapsible=icon]:hidden">
            <span className="block truncate font-display text-sm font-semibold text-sidebar-foreground">
              ContractIQ
            </span>
            <span className="block text-[10px] uppercase tracking-[0.18em] text-sidebar-foreground/40">
              CLM Console
            </span>
          </span>
        </Link>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Workspace</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>{renderItems(workspaceItems)}</SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        <SidebarGroup>
          <SidebarGroupLabel>System</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>{renderItems(systemItems)}</SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter className="p-3 space-y-2">
        <div className="rounded-md border border-sidebar-border px-3 py-2.5 group-data-[collapsible=icon]:hidden">
          <p className="font-display text-[11px] font-semibold text-sidebar-foreground">
            All systems nominal
          </p>
          <p className="text-[11px] text-sidebar-foreground/40">Role: {normalizeRole(userRole)}</p>
        </div>
        <SidebarMenu>
          <SidebarMenuItem>
            <LogoutDialog
              trigger={
                <SidebarMenuButton
                  className="w-full text-destructive hover:bg-destructive/10 hover:text-destructive focus-visible:ring-destructive cursor-pointer transition-colors"
                  tooltip="Log Out"
                >
                  <LogOut className="size-4" />
                  <span>Log Out</span>
                </SidebarMenuButton>
              }
            />
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}

function UserMenu() {
  const { user } = useAuth();
  const [logoutOpen, setLogoutOpen] = useState(false);
  const currentRole = user?.role ? normalizeRole(user.role) : "Viewer";
  const initials = user?.email ? user.email.slice(0, 2).toUpperCase() : "IQ";

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            className="flex items-center gap-2 rounded-full p-0.5 outline-none transition-colors hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring cursor-pointer"
            aria-label="User profile menu"
          >
            <span className="hidden sm:inline-block text-xs font-medium text-foreground px-2 py-0.5 rounded-full bg-secondary border border-border">
              {currentRole}
            </span>
            <span className="grid size-8 place-items-center rounded-full bg-jade/10 font-display font-semibold text-jade border border-jade/20">
              {initials}
            </span>
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuLabel className="font-normal">
            <div className="flex flex-col space-y-1">
              <p className="text-sm font-medium leading-none truncate">{user?.email ?? "User"}</p>
              <p className="text-xs leading-none text-muted-foreground">{currentRole}</p>
            </div>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem asChild>
            <Link to="/profile" className="flex items-center gap-2 cursor-pointer">
              <CircleUserRound className="size-4" />
              <span>Profile</span>
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link to="/settings" className="flex items-center gap-2 cursor-pointer">
              <Settings className="size-4" />
              <span>Settings</span>
            </Link>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onSelect={(e) => {
              e.preventDefault();
              setLogoutOpen(true);
            }}
            className="text-destructive focus:bg-destructive/10 focus:text-destructive cursor-pointer flex items-center gap-2"
          >
            <LogOut className="size-4" />
            <span>Log Out</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <LogoutDialog open={logoutOpen} onOpenChange={setLogoutOpen} />
    </>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <SidebarProvider>
      <LedgerSidebar />
      <div className="min-w-0 flex-1 bg-background">
        <header className="sticky top-0 z-20 flex h-14 items-center border-b border-border/70 bg-background/90 px-4 backdrop-blur-md">
          <SidebarTrigger aria-label="Collapse navigation" />
          <div className="ml-auto flex items-center gap-3 text-xs text-muted-foreground">
            <SlidersHorizontal className="size-4" />
            <UserMenu />
            <LogoutDialog
              trigger={
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10 cursor-pointer"
                  title="Log Out"
                  aria-label="Log Out"
                >
                  <LogOut className="size-4" />
                </Button>
              }
            />
          </div>
        </header>
        {children}
      </div>
    </SidebarProvider>
  );
}
