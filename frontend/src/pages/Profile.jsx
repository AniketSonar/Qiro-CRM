import { Mail, Phone, MapPin, LogOut } from "lucide-react";
import { AppShell, GhostButton } from "../components/crm/AppShell";
import { Avatar, Chip, Panel, StatCard } from "../components/crm/ui-bits";
import { currency } from "../lib/crm-data";
import { useAuth } from "../lib/auth";
import { useNavigate } from "react-router-dom";
import { titleCase } from "../lib/crm-store";
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
          <div className="grid gap-4 sm:grid-cols-3">
            <StatCard label="Closed this quarter" value={currency(182e4)} delta="+11%" trend="up" />
            <StatCard label="Target attainment" value="83%" hint={`of ${currency(22e5)}`} />
            <StatCard label="Win rate" value="46%" delta="+4pt" trend="up" />
          </div>

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
