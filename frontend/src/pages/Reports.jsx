import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";
import { Download } from "lucide-react";
import { AppShell, GhostButton } from "../components/crm/AppShell";
import { Panel, StatCard } from "../components/crm/ui-bits";
import { currency } from "../lib/crm-data";
import { useDashboard } from "../lib/crm-store";
const pieColors = [
  "var(--color-chart-1)",
  "var(--color-chart-2)",
  "var(--color-chart-3)",
  "var(--color-chart-4)",
  "var(--color-chart-5)"
];
const tooltipStyle = {
  borderRadius: 12,
  border: "1px solid var(--color-border)",
  background: "var(--color-card)",
  fontSize: 12
};
export default function Reports() {
  const { repPerformance, revenueTrend, sourceSplit, stageFunnel } = useDashboard();
  return <AppShell
    title="Reports"
    subtitle={`${new Date().toLocaleDateString("en-IN", { month: "short", year: "numeric" })} \u00b7 manager and admin visibility`}
    actions={<>
          <GhostButton>Last 6 months</GhostButton>
          <button className="brand-surface inline-flex h-10 items-center gap-2 rounded-xl px-4 text-sm font-semibold text-primary-foreground">
            <Download className="size-4" /> Download PDF
          </button>
        </>}
  >
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Lead → deal rate" value="28.4%" delta="+3.1pt" trend="up" hint="vs last quarter" />
        <StatCard label="Deal → win rate" value="41.2%" delta="+1.8pt" trend="up" />
        <StatCard label="Revenue per rep" value={currency(1065e3)} delta="+9.6%" trend="up" />
        <StatCard label="Lost to price" value="34%" delta="+5pt" trend="down" hint="top loss reason" />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.4fr_1fr]">
        <Panel title="Rep performance vs target" description="₹ lakh closed this quarter" bodyClassName="px-2">
          <div className="h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={repPerformance} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 6" stroke="var(--color-border)" vertical={false} />
                <XAxis dataKey="rep" tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }} />
                <YAxis tickLine={false} axisLine={false} width={30} tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }} />
                <Tooltip cursor={{ fill: "var(--color-muted)" }} contentStyle={tooltipStyle} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="target" name="Target" radius={[8, 8, 0, 0]} fill="var(--color-muted)" barSize={20} />
                <Bar dataKey="won" name="Closed" radius={[8, 8, 0, 0]} fill="var(--color-chart-1)" barSize={20} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Panel>

        <Panel title="Lead source mix" description="Share of new leads">
          <div className="h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
    data={sourceSplit}
    dataKey="value"
    nameKey="source"
    innerRadius={62}
    outerRadius={100}
    paddingAngle={3}
    stroke="var(--color-card)"
    strokeWidth={3}
  >
                  {sourceSplit.map((_, i) => <Cell key={i} fill={pieColors[i % pieColors.length]} />)}
                </Pie>
                <Tooltip contentStyle={tooltipStyle} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </Panel>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_1fr]">
        <Panel title="Won revenue trend" description="₹ crore per month" bodyClassName="px-2">
          <div className="h-[240px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={revenueTrend} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 6" stroke="var(--color-border)" vertical={false} />
                <XAxis dataKey="month" tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }} />
                <YAxis tickLine={false} axisLine={false} width={30} tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }} />
                <Tooltip contentStyle={tooltipStyle} />
                <Line type="monotone" dataKey="won" stroke="var(--color-chart-3)" strokeWidth={2.6} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Panel>

        <Panel title="Conversion by stage" description="Drop-off between stages">
          <ul className="space-y-3.5">
            {stageFunnel.map((s, i) => {
    const prev = stageFunnel[i - 1];
    const rate = prev ? Math.round(s.count / prev.count * 100) : 100;
    return <li key={s.stage} className="flex items-center gap-3">
                  <span className="w-24 text-sm font-semibold">{s.stage}</span>
                  <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-muted">
                    <div className="brand-surface h-full rounded-full" style={{ width: `${rate}%` }} />
                  </div>
                  <span className="numeric w-12 text-right text-xs font-bold text-muted-foreground">
                    {rate}%
                  </span>
                </li>;
  })}
          </ul>
        </Panel>
      </div>
    </AppShell>;
}
