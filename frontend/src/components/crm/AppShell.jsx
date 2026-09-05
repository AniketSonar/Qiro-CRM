import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../../lib/auth";
import { titleCase, useFollowUps, useNotifications } from "../../lib/crm-store";
import {
  LayoutDashboard,
  CalendarClock,
  GitBranch,
  Target,
  Clock,
  BadgePercent,
  Building2,
  Users2,
  CalendarCheck2,
  CircleDollarSign,
  BarChart3,
  ShieldCheck,
  Bell,
  Search,
  Plus,
  Menu,
  X,
  PanelLeftClose,
  PanelLeftOpen,
  LogOut
} from "lucide-react";
import { cn } from "../../lib/utils";
import { Avatar } from "./ui-bits";
import { OverdueReminder } from "./OverdueReminder";
const navGroups = [
  {
    items: [
      { to: "/", label: "Dashboard", icon: LayoutDashboard },
      { to: "/agenda", label: "Agenda", icon: CalendarClock },
      { to: "/pipeline", label: "Pipeline", icon: GitBranch }
    ]
  },
  {
    label: "Sales process",
    items: [
      { to: "/leads", label: "Capture leads", icon: Target, step: "1" },
      { to: "/follow-ups", label: "Follow up", icon: Clock, step: "2", badgeKey: "followUps" },
      { to: "/deals", label: "Develop deals", icon: BadgePercent, step: "3" },
      { to: "/customers", label: "Convert customers", icon: Building2, step: "4" }
    ]
  },
  {
    label: "Supporting work",
    items: [
      { to: "/contacts", label: "Contacts", icon: Users2 },
      { to: "/activities", label: "Activities", icon: CalendarCheck2 },
      { to: "/sales", label: "Sales", icon: CircleDollarSign },
      { to: "/reports", label: "Reports", icon: BarChart3 }
    ]
  },
  {
    label: "Administration",
    items: [
      { to: "/users", label: "Users & roles", icon: ShieldCheck, adminOnly: true },
      { to: "/notifications", label: "Notifications", icon: Bell, badgeKey: "notifications" }
    ]
  }
];
function Rail({ collapsed, onToggle, mobileOpen, onClose }) {
  const { user } = useAuth();
  const { data: followUpRows } = useFollowUps();
  const { data: notificationRows } = useNotifications();
  const badges = {
    followUps: followUpRows.filter((f) => f.status === "Overdue" || f.status === "Today").length,
    notifications: notificationRows.filter((n) => n.unread).length
  };
  const userInitials = (user?.name ?? "?")
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase() || "?";
  const pathname = useLocation().pathname;
  const isAdmin = String(user?.role ?? "").toUpperCase() === "ADMIN";
  const groups = navGroups
    .map((g) => ({ ...g, items: g.items.filter((i) => !i.adminOnly || isAdmin) }))
    .filter((g) => g.items.length > 0);
  return <>
    <button
      type="button"
      aria-label="Close navigation"
      onClick={onClose}
      className={cn(
        "fixed inset-0 z-30 bg-slate-950/40 transition-opacity lg:hidden",
        mobileOpen ? "opacity-100" : "pointer-events-none opacity-0"
      )}
    />
    <aside
      className={cn(
        "rail-surface fixed inset-y-0 left-0 z-40 flex h-screen w-[262px] shrink-0 flex-col text-rail-foreground transition-transform duration-200 lg:sticky lg:top-0 lg:z-auto lg:translate-x-0",
        mobileOpen ? "translate-x-0" : "-translate-x-full",
        collapsed ? "lg:w-[76px]" : "lg:w-[262px]"
      )}
    >
      <div className="flex items-center gap-3 px-4 py-5">
        <span className="grid size-9 shrink-0 place-items-center overflow-hidden rounded-xl bg-white">
          <img src="/qiro_logo.png" alt="QIRO" className="size-full object-contain" />
        </span>
        {!collapsed && <div className="min-w-0 flex-1">
            <p className="font-display text-sm font-extrabold tracking-tight">QIRO CRM</p>
          </div>}
        <button
          type="button"
          onClick={onToggle}
          aria-label={collapsed ? "Expand navigation" : "Collapse navigation"}
          className="hidden size-7 place-items-center rounded-lg text-rail-muted transition-colors hover:bg-rail-hover hover:text-rail-foreground"
        >
          {collapsed ? <PanelLeftOpen className="size-4" /> : <PanelLeftClose className="size-4" />}
        </button>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close navigation"
          className="ml-auto grid size-8 place-items-center rounded-lg text-rail-muted transition-colors hover:bg-rail-hover hover:text-rail-foreground lg:hidden"
        >
          <X className="size-5" />
        </button>
      </div>

      <nav className="rail-scroll flex-1 space-y-5 overflow-y-auto overscroll-contain px-3 pb-4">
        {groups.map((group, gi) => <div key={gi} className="space-y-1">
            {group.label && !collapsed && <p className="px-3 pb-1 text-[10px] font-bold uppercase tracking-[0.18em] text-rail-muted/80">
                {group.label}
              </p>}
            {group.items.map((item) => {
    const active = pathname === item.to;
    return <Link
      key={item.to}
      to={item.to}
      title={collapsed ? item.label : void 0}
      className={cn(
        "group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
        active ? "bg-rail-hover text-rail-foreground" : "text-rail-muted hover:bg-rail-hover/70 hover:text-rail-foreground"
      )}
      onClick={onClose}
    >
                  {active && <span className="brand-surface absolute left-0 top-1/2 h-6 w-[3px] -translate-y-1/2 rounded-r-full" />}
                  <item.icon className="size-[18px] shrink-0" />
                  {!collapsed && <>
                      <span className="flex-1 truncate">{item.label}</span>
                      {item.step && <span className="grid size-5 place-items-center rounded-md bg-rail-foreground/10 text-[10px] font-bold">
                          {item.step}
                        </span>}
                      {Boolean(badges[item.badgeKey]) && <span className="rounded-full bg-warning px-1.5 py-0.5 text-[10px] font-bold text-warning-foreground">
                          {badges[item.badgeKey] ?? item.badge}
                        </span>}
                    </>}
                </Link>;
  })}
          </div>)}
      </nav>

      <div className="border-t border-rail-hover p-3">
        <Link
    to="/profile"
    className="flex items-center gap-3 rounded-xl px-2 py-2 transition-colors hover:bg-rail-hover"
  >
          <Avatar initials={userInitials} className="bg-rail-hover text-rail-foreground" />
          {!collapsed && <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold">{user?.name ?? "Signed out"}</p>
              <p className="truncate text-[11px] text-rail-muted">{titleCase(user?.role) || "\u2014"}</p>
            </div>}
          {!collapsed && <LogOut className="size-4 text-rail-muted" />}
        </Link>
      </div>
    </aside>
  </>;
}
function AppShell({
  title,
  subtitle,
  actions,
  children
}) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const { user } = useAuth();
  const topInitials = (user?.name ?? "?")
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase() || "?";
  const navigate = useNavigate();
  useEffect(() => {
    const closeOnEscape = (event) => {
      if (event.key === "Escape") setMobileOpen(false);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, []);
  return <div className="flex min-h-screen bg-background">
      <Rail
        collapsed={collapsed}
        onToggle={() => setCollapsed((c) => !c)}
        mobileOpen={mobileOpen}
        onClose={() => setMobileOpen(false)}
      />

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 border-b border-border bg-card/85 backdrop-blur-xl">
          <div className="flex items-center gap-4 px-5 py-3.5 lg:px-8">
            <button
              type="button"
              onClick={() => setMobileOpen(true)}
              aria-label="Open navigation"
              className="grid size-10 place-items-center rounded-xl border border-border bg-card text-muted-foreground transition-colors hover:text-foreground lg:hidden"
            >
              <Menu className="size-5" />
            </button>
            <button
              type="button"
              onClick={() => setCollapsed((c) => !c)}
              aria-label={collapsed ? "Expand navigation" : "Collapse navigation"}
              className="hidden size-10 place-items-center rounded-xl border border-border bg-card text-muted-foreground transition-colors hover:text-foreground lg:grid"
            >
              {collapsed ? <PanelLeftOpen className="size-5" /> : <PanelLeftClose className="size-5" />}
            </button>
            <div className="relative hidden max-w-sm flex-1 sm:block">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <input
    type="search"
    placeholder="Search leads, deals, customers…"
    onKeyDown={(e) => {
      if (e.key === "Enter" && e.currentTarget.value.trim()) {
        navigate(`/leads?q=${encodeURIComponent(e.currentTarget.value.trim())}`);
      }
    }}
    className="h-10 w-full rounded-xl border border-border bg-muted/60 pl-9 pr-3 text-sm outline-none transition-colors placeholder:text-muted-foreground focus:border-ring focus:bg-card"
  />
            </div>
            <div className="ml-auto flex items-center gap-2">
              <button
    onClick={() => navigate("/leads?new=1")}
    className="brand-surface inline-flex h-10 items-center gap-2 rounded-xl px-4 text-sm font-semibold text-primary-foreground shadow-float transition-transform hover:-translate-y-0.5"
  >
                <Plus className="size-4" />
                <span className="hidden sm:inline">New lead</span>
              </button>
              <Link
    to="/notifications"
    className="relative grid size-10 place-items-center rounded-xl border border-border bg-card text-muted-foreground transition-colors hover:text-foreground"
  >
                <Bell className="size-4" />
                <span className="absolute right-2.5 top-2.5 size-2 rounded-full bg-destructive ring-2 ring-card" />
              </Link>
              <Link to="/profile">
                <Avatar initials={topInitials} className="size-10" />
              </Link>
            </div>
          </div>
        </header>

        <div className="px-5 py-6 lg:px-8 lg:py-8">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <h1 className="font-display text-2xl font-extrabold text-foreground lg:text-[28px]">
                {title}
              </h1>
              {subtitle && <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>}
            </div>
            {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
          </div>

          <div className="mt-6 space-y-6">
            <OverdueReminder />
            {children}
          </div>
        </div>
      </div>
    </div>;
}
function GhostButton({ children, ...rest }) {
  return <button {...rest} className="inline-flex h-10 items-center gap-2 rounded-xl border border-border bg-card px-4 text-sm font-semibold text-foreground transition-colors hover:bg-muted">
      {children}
    </button>;
}
function TableShell({ children }) {
  return <div className="panel overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] text-sm">{children}</table>
      </div>
    </div>;
}
function Th({ children, className }) {
  return <th
    className={cn(
      "border-b border-border bg-muted/50 px-5 py-3 text-left text-[11px] font-bold uppercase tracking-[0.12em] text-muted-foreground",
      className
    )}
  >
      {children}
    </th>;
}
function Td({ children, className, ...props }) {
  return <td className={cn("border-b border-border px-5 py-3.5 align-middle", className)} {...props}>{children}</td>;
}
export {
  AppShell,
  GhostButton,
  TableShell,
  Td,
  Th
};
