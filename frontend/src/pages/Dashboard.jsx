import { Link } from "react-router-dom";
import { useAuth } from "../lib/auth";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";
import { ArrowRight, Phone, Mail, CalendarCheck2, StickyNote, GitBranch, MessageCircle, Activity as ActivityIcon } from "lucide-react";
import { AppShell } from "../components/crm/AppShell";
import { Chip, Panel, StatCard, stageTone, statusTone, Avatar, initialsOf } from "../components/crm/ui-bits";
import { currency } from "../lib/crm-data";
import { useAgenda, useActivities, useDashboard } from "../lib/crm-store";
const activityIcon = {
  Call: Phone,
  Email: Mail,
  Meeting: CalendarCheck2,
  Note: StickyNote,
  Whatsapp: MessageCircle,
  Sms: MessageCircle,
  "Stage change": GitBranch
};
const toneRing = {
  primary: "bg-primary-soft text-accent-foreground",
  info: "bg-info-soft text-info",
  warning: "bg-warning-soft text-warning-foreground",
  muted: "bg-muted text-muted-foreground"
};
export default function Dashboard() {
  const { user } = useAuth();
  const { kpis, leads, followUps, revenueTrend, sourceSplit, stageFunnel } = useDashboard();
  const { data: activities } = useActivities();
  const { agenda } = useAgenda();
  const maxSource = Math.max(...sourceSplit.map((s) => s.value));
  const topStageCount = stageFunnel[0]?.count ?? 1;
  return <AppShell
    title={user?.name ? `Welcome, ${user.name.split(" ")[0]}` : "Welcome"}
    subtitle={`${new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric" })} · ${followUps.filter((f) => f.status === "Today" || f.status === "Overdue").length} follow-ups need you today`}
    actions={<>
          <Link
      to="/pipeline"
      className="brand-surface inline-flex h-10 items-center gap-2 rounded-xl px-4 text-sm font-semibold text-primary-foreground"
    >
            Open pipeline <ArrowRight className="size-4" />
          </Link>
        </>}
  >
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {kpis.map((k) => <StatCard key={k.label} {...k} />)}
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.6fr_1fr]">
        <Panel
    title="Revenue momentum"
    description="Deal done vs open pipeline, in ₹ crore"
    action={<div className="flex items-center gap-3 text-xs font-semibold">
              <span className="flex items-center gap-1.5 text-muted-foreground">
                <span className="size-2 rounded-full bg-chart-1" /> Pipeline
              </span>
              <span className="flex items-center gap-1.5 text-muted-foreground">
                <span className="size-2 rounded-full bg-chart-3" /> Deal done
              </span>
            </div>}
    bodyClassName="pl-1 pr-3"
  >
          <div className="h-[260px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={revenueTrend} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
                <defs>
                  <linearGradient id="pipeFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--color-chart-1)" stopOpacity={0.32} />
                    <stop offset="100%" stopColor="var(--color-chart-1)" stopOpacity={0.02} />
                  </linearGradient>
                  <linearGradient id="wonFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--color-chart-3)" stopOpacity={0.34} />
                    <stop offset="100%" stopColor="var(--color-chart-3)" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 6" stroke="var(--color-border)" vertical={false} />
                <XAxis
    dataKey="month"
    tickLine={false}
    axisLine={false}
    tick={{ fontSize: 12, fill: "var(--color-muted-foreground)" }}
  />
                <YAxis
    tickLine={false}
    axisLine={false}
    width={34}
    tick={{ fontSize: 12, fill: "var(--color-muted-foreground)" }}
  />
                <Tooltip
    contentStyle={{
      borderRadius: 12,
      border: "1px solid var(--color-border)",
      background: "var(--color-card)",
      fontSize: 12,
      boxShadow: "var(--shadow-float)"
    }}
  />
                <Area
    type="monotone"
    dataKey="pipeline"
    stroke="var(--color-chart-1)"
    strokeWidth={2.4}
    fill="url(#pipeFill)"
  />
                <Area
    type="monotone"
    dataKey="won"
    stroke="var(--color-chart-3)"
    strokeWidth={2.4}
    fill="url(#wonFill)"
  />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Panel>

        <Panel title="Today's agenda" description="Your committed blocks">
          <ol className="space-y-3">
            {agenda.map((item) => <li key={item.time} className="flex gap-3">
                <span className="numeric w-12 pt-1 text-xs font-bold text-muted-foreground">
                  {item.time}
                </span>
                <div
    className={`flex-1 rounded-xl px-3 py-2.5 ${toneRing[item.tone]}`}
  >
                  <p className="text-sm font-semibold">{item.title}</p>
                  <p className="text-xs opacity-80">{item.meta}</p>
                </div>
              </li>)}
          </ol>
        </Panel>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_1fr_1fr]">
        <Panel title="Stage funnel" description="Live counts and weighted value">
          <ul className="space-y-3">
            {stageFunnel.map((s) => <li key={s.stage}>
                <div className="flex items-baseline justify-between text-sm">
                  <span className="font-semibold">{s.stage}</span>
                  <span className="numeric text-xs text-muted-foreground">
                    {s.count} · {currency(s.value)}
                  </span>
                </div>
                <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-muted">
                  <div
    className="brand-surface h-full rounded-full"
    style={{ width: `${s.count / topStageCount * 100}%` }}
  />
                </div>
              </li>)}
          </ul>
        </Panel>

        <Panel title="Lead sources" description="Leads created this quarter" bodyClassName="px-2 pb-4">
          <div className="h-[212px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={sourceSplit} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
                <CartesianGrid strokeDasharray="3 6" stroke="var(--color-border)" vertical={false} />
                <XAxis
    dataKey="source"
    tickLine={false}
    axisLine={false}
    tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }}
  />
                <YAxis hide domain={[0, maxSource + 12]} />
                <Tooltip
    cursor={{ fill: "var(--color-muted)" }}
    contentStyle={{
      borderRadius: 12,
      border: "1px solid var(--color-border)",
      background: "var(--color-card)",
      fontSize: 12
    }}
  />
                <Bar dataKey="value" radius={[8, 8, 0, 0]} fill="var(--color-chart-2)" barSize={26} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Panel>

        <Panel
    title="Recent activity"
    description="Team log"
    action={<Link to="/activities" className="text-xs font-semibold text-primary">
              View all
            </Link>}
  >
          <ol className="space-y-4">
            {activities.slice(0, 5).map((a) => {
    const Icon = activityIcon[a.type] ?? ActivityIcon;
    return <li key={a.id} className="flex gap-3">
                  <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-accent text-accent-foreground">
                    <Icon className="size-4" />
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-foreground">{a.subject}</p>
                    <p className="truncate text-xs text-muted-foreground">{a.detail}</p>
                    <p className="mt-0.5 text-[11px] text-muted-foreground/80">
                      {a.actor} · {a.when}
                    </p>
                  </div>
                </li>;
  })}
          </ol>
        </Panel>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <Panel
    title="Hot leads"
    description="Highest scoring open opportunities"
    action={<Link to="/leads" className="text-xs font-semibold text-primary">
              All leads
            </Link>}
    bodyClassName="p-0"
  >
          <ul className="divide-y divide-border">
            {leads.filter((l) => l.stage !== "Lost").sort((a, b) => b.score - a.score).slice(0, 5).map((l) => <li key={l.id} className="flex items-center gap-3 px-5 py-3.5">
                  <Avatar initials={initialsOf(l.name)} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">{l.name}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {l.company} · {l.city}
                    </p>
                  </div>
                  <Chip tone={stageTone(l.stage)}>{l.stage}</Chip>
                  <span className="numeric hidden w-24 text-right text-sm font-bold sm:block">
                    {currency(l.value)}
                  </span>
                </li>)}
          </ul>
        </Panel>

        <Panel
    title="Follow-ups queue"
    description="Sorted by urgency"
    action={<Link to="/follow-ups" className="text-xs font-semibold text-primary">
              Open queue
            </Link>}
    bodyClassName="p-0"
  >
          <ul className="divide-y divide-border">
            {followUps.slice(0, 5).map((f) => <li key={f.id} className="flex items-center gap-3 px-5 py-3.5">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{f.lead}</p>
                  <p className="truncate text-xs text-muted-foreground">{f.note}</p>
                </div>
                <span className="hidden text-xs text-muted-foreground sm:block">{f.due}</span>
                <Chip tone={statusTone(f.status)} dot>
                  {f.status}
                </Chip>
              </li>)}
          </ul>
        </Panel>
      </div>
    </AppShell>;
}
