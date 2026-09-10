import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import { cn } from "../../lib/utils";
const toneClasses = {
  primary: "bg-primary-soft text-accent-foreground",
  success: "bg-success-soft text-success",
  warning: "bg-warning-soft text-warning-foreground",
  danger: "bg-destructive/10 text-destructive",
  info: "bg-info-soft text-info",
  muted: "bg-muted text-muted-foreground"
};
function Chip({
  children,
  tone = "muted",
  dot = false,
  className
}) {
  return <span
    className={cn(
      "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold",
      toneClasses[tone],
      className
    )}
  >
      {dot && <span className="size-1.5 rounded-full bg-current" />}
      {children}
    </span>;
}
const stageTones = {
  New: "muted",
  Contacted: "info",
  Qualified: "primary",
  Proposal: "primary",
  Negotiation: "warning",
  "Deal done": "success",
  Lost: "danger"
};
const statusTones = {
  Overdue: "danger",
  Today: "warning",
  Upcoming: "info",
  Done: "success",
  Paid: "success",
  Pending: "warning",
  Healthy: "success",
  "At risk": "warning",
  "Churn risk": "danger",
  Active: "success",
  Invited: "info"
};
const stageTone = (stage) => stageTones[stage] ?? "muted";
const statusTone = (status) => statusTones[status] ?? "muted";
const defaultLeadProbability = {
  NEW: 30,
  CONTACTED: 50,
  QUALIFIED: 65,
  DEMO: 75,
  PROPOSAL: 80,
  NEGOTIATION: 90,
  CONVERTED: 100,
  WON: 100,
  CLOSED_WON: 100,
  CLOSED_LOST: 0,
  LOST: 0
};
const leadProbability = (lead) => {
  const explicitScore = Number(lead?.score);
  if (lead?.score !== null && lead?.score !== undefined && Number.isFinite(explicitScore)) {
    return Math.max(0, Math.min(100, explicitScore));
  }
  const status = String(lead?.status ?? lead?.raw?.status ?? "NEW").toUpperCase();
  let probability = defaultLeadProbability[status] ?? 0;
  if (status === "LOST" || status === "CONVERTED" || status === "WON") return probability;

  const email = lead?.email && lead.email !== "—";
  const phone = lead?.phone && lead.phone !== "—";
  const company = lead?.company && lead.company !== "—";
  const source = lead?.source && lead.source !== "Direct";
  const notes = String(lead?.notes ?? lead?.raw?.notes ?? "").trim().length >= 20;
  const value = Number(lead?.value ?? lead?.amount ?? lead?.raw?.amount ?? 0);

  probability += email ? 5 : 0;
  probability += phone ? 5 : 0;
  probability += company ? 5 : 0;
  probability += source ? 5 : 0;
  probability += value > 0 ? 5 : 0;
  probability += notes ? 5 : 0;
  return Math.min(100, probability);
};
const leadTemperature = (lead) => {
  const probability = leadProbability(lead);
  if (probability >= 80) return "Hot";
  if (probability >= 50) return "Warm";
  return "Cold";
};
const leadTemperatureTone = (temperature) =>
  ({ Hot: "danger", Warm: "warning", Cold: "info" }[temperature] ?? "muted");
function StatCard({
  label,
  value,
  delta,
  trend,
  hint
}) {
  const good = trend === "up";
  return <div className="panel group relative overflow-hidden p-5">
      <span className="brand-surface absolute inset-x-0 top-0 h-0.5 opacity-0 transition-opacity group-hover:opacity-100" />
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
        {label}
      </p>
      <p className="numeric mt-3 font-display text-2xl font-extrabold text-foreground">{value}</p>
      <div className="mt-2 flex items-center gap-2 text-xs">
        {delta && <span
    className={cn(
      "inline-flex items-center gap-1 font-semibold",
      good ? "text-success" : "text-destructive"
    )}
  >
            {good ? <ArrowUpRight className="size-3.5" /> : <ArrowDownRight className="size-3.5" />}
            {delta}
          </span>}
        {hint && <span className="text-muted-foreground">{hint}</span>}
      </div>
    </div>;
}
function Panel({
  title,
  description,
  action,
  children,
  className,
  bodyClassName
}) {
  return <section className={cn("panel flex flex-col", className)}>
      {(title || action) && <header className="flex items-start justify-between gap-4 border-b border-border px-5 py-4">
          <div>
            {title && <h3 className="text-sm font-bold text-foreground">{title}</h3>}
            {description && <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>}
          </div>
          {action}
        </header>}
      <div className={cn("flex-1 p-5", bodyClassName)}>{children}</div>
    </section>;
}
function Avatar({ initials, className }) {
  return <span
    className={cn(
      "inline-flex size-8 shrink-0 items-center justify-center rounded-full bg-accent text-[11px] font-bold text-accent-foreground",
      className
    )}
  >
      {initials}
    </span>;
}
function initialsOf(name) {
  return name.split(" ").filter(Boolean).slice(0, 2).map((p) => p[0]).join("").toUpperCase();
}
export {
  Avatar,
  Chip,
  Panel,
  StatCard,
  initialsOf,
  leadProbability,
  leadTemperature,
  leadTemperatureTone,
  stageTone,
  statusTone
};
