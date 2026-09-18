import { Mail, Phone, MapPin, LogOut, Award } from "lucide-react";
import { Link } from "react-router-dom";
import { AppShell, GhostButton } from "../components/crm/AppShell";
import { Avatar, Chip, Panel, StatCard } from "../components/crm/ui-bits";
import { currency } from "../lib/crm-data";
import { useAuth } from "../lib/auth";
import { useNavigate } from "react-router-dom";
import { titleCase, useMySalary } from "../lib/crm-store";
const buildFields = (user, roleLabel) => [
  { label: "Full name", value: user?.name ?? "\u2014" },
  { label: "Role", value: roleLabel },
  { label: "Email", value: user?.email ?? "\u2014" },
  { label: "Account status", value: user?.status ? String(user.status) : "Active" },
  { label: "User ID", value: user?.id ? `QT-${String(user.id).padStart(4, "0")}` : "\u2014" },
  {
    label: "Joined",
    value: user?.createdAt || user?.created_at
      ? new Date(user.createdAt ?? user.created_at).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })
      : "\u2014"
  }
];
function CompensationSnapshot() {
  const { data: p, loading } = useMySalary();
  if (loading) return <div className="grid gap-4 sm:grid-cols-3"><StatCard label="Loading…" value="—" /></div>;
  if (!p) return (
    <div className="grid gap-4 sm:grid-cols-3">
      <StatCard label="Net Base Salary" value="—" hint="Not configured yet" />
      <StatCard label="Target" value="—" />
      <StatCard label="Bonus" value="—" />
    </div>
  );
  const comp = p.target?.completionRate || 0;
  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Net Base Salary" value={currency(p.salary?.netBaseSalary || 0)} hint="Basic + Allowances − Deductions" />
        <StatCard
          label="Target Progress"
          value={`${comp}%`}
          delta={currency(p.target?.achievedSales || 0)}
          trend={comp >= 100 ? "up" : "down"}
          hint={`of ${currency(p.target?.targetAmount || 0)} target`}
        />
        <StatCard
          label="Projected Payout"
          value={currency(p.totalProjectedPayout || 0)}
          delta={p.target?.earnedBonus > 0 ? `+${currency(p.target.earnedBonus)} bonus` : "Base only"}
          trend="up"
        />
      </div>
      <Link
        to="/compensation"
        className="inline-flex items-center gap-2 text-xs font-semibold text-primary hover:underline"
      >
        <Award className="size-3.5" /> View full Compensation & Target details →
      </Link>
    </div>
  );
}
export default function Profile() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const name = user?.name ?? "—";
  const roleLabel = titleCase(user?.role) || "—";
  const initials = name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();

  const fields = buildFields(user, roleLabel);

  const signOut = async () => {
    await logout();
    navigate("/login", { replace: true });
  };

  return <AppShell
    title="My profile"
    subtitle="Your details, targets and preferences"
    actions={<>
          <GhostButton>Change password</GhostButton>
          <GhostButton onClick={signOut}>
            <LogOut className="size-4" /> Sign out
          </GhostButton>
        </>}
  >
      <div className="grid gap-6 xl:grid-cols-[1fr_1.4fr]">
        <Panel>
          <div className="flex flex-col items-center text-center">
            <Avatar initials={initials || "?"} className="size-20 font-display text-2xl" />
            <p className="mt-4 font-display text-xl font-extrabold">{name}</p>
            <p className="text-sm text-muted-foreground">{roleLabel}</p>
            <Chip tone="success" dot className="mt-3">
              Active
            </Chip>
            <div className="mt-6 w-full space-y-2.5 border-t border-border pt-5 text-left text-sm text-muted-foreground">
              <p className="flex items-center gap-2">
                <Mail className="size-3.5" /> {user?.email ?? "—"}
              </p>
              <p className="numeric flex items-center gap-2">
                <Phone className="size-3.5" /> +91 98200 40021
              </p>
              <p className="flex items-center gap-2">
                <MapPin className="size-3.5" /> Mumbai, Maharashtra
              </p>
            </div>
          </div>
        </Panel>

        <div className="space-y-6">
          <CompensationSnapshot />

          <Panel title="Account details" description="Managed by your administrator">
            <dl className="grid gap-x-8 gap-y-4 sm:grid-cols-2">
              {fields.map((f) => <div key={f.label}>
                  <dt className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                    {f.label}
                  </dt>
                  <dd className="mt-1 text-sm font-semibold">{f.value}</dd>
                </div>)}
            </dl>
          </Panel>

        </div>
      </div>
    </AppShell>;
}
