import { useMemo, useState } from "react";
import {
  Award,
  CircleDollarSign,
  TrendingUp,
  Target,
  Edit,
  CheckCircle2,
  AlertCircle,
  Zap,
  Percent,
  ShieldCheck,
  Eye,
  Users
} from "lucide-react";
import { AppShell, GhostButton, TableShell, Td, Th } from "../components/crm/AppShell";
import { Avatar, Chip, Panel, StatCard, initialsOf } from "../components/crm/ui-bits";
import {
  Field,
  FormModal,
  Input,
  SearchField,
  formValues
} from "../components/crm/form";
import { currency } from "../lib/crm-data";
import { crud, useSalaries, useMySalary } from "../lib/crm-store";
import { useAuth } from "../lib/auth";

function SalaryModal({ open, profile, onClose }) {
  if (!profile) return null;
  const { user, salary, target } = profile;

  const submit = async (fd) => {
    const body = formValues(fd);
    await crud.salaries.update(user.id, {
      basic_salary: Number(body.basic_salary) || 0,
      allowances: Number(body.allowances) || 0,
      deductions: Number(body.deductions) || 0,
      target_amount: Number(body.target_amount) || 0,
      incentive_percent: Number(body.incentive_percent) || 0,
      bonus: Number(body.bonus) || 0
    });
  };

  return (
    <FormModal
      open={open}
      wide
      title={`Set Salary & Target \u2014 ${user.name}`}
      description="Admin configuration for base compensation, monthly targets and IT performance bonus."
      submitLabel="Save Compensation"
      onClose={onClose}
      onSubmit={submit}
    >
      <div className="space-y-4">
        <div className="rounded-xl border border-primary/20 bg-primary-soft/30 p-3.5 text-xs text-primary-foreground flex items-center gap-2.5">
          <ShieldCheck className="size-4 shrink-0 text-primary" />
          <span>
            Changes take effect immediately. Salespersons will see their updated base salary and targets in real time.
          </span>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2 border-b border-border pb-2">
            <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Base Salary Structure (₹ / month)</h4>
          </div>

          <Field label="Basic Salary (₹)" required>
            <Input
              type="number"
              name="basic_salary"
              defaultValue={salary.basicSalary}
              required
              min="0"
              step="1000"
            />
          </Field>

          <Field label="Allowances (₹)">
            <Input
              type="number"
              name="allowances"
              defaultValue={salary.allowances}
              min="0"
              step="500"
              placeholder="HRA, Travel, Medical, etc."
            />
          </Field>

          <Field label="Deductions (₹)">
            <Input
              type="number"
              name="deductions"
              defaultValue={salary.deductions}
              min="0"
              step="500"
              placeholder="PF, Tax, TDS, etc."
            />
          </Field>

          <Field label="Fixed Guaranteed Bonus (₹)">
            <Input
              type="number"
              name="bonus"
              defaultValue={salary.fixedBonus}
              min="0"
              step="1000"
              placeholder="0 if performance only"
            />
          </Field>

          <div className="sm:col-span-2 border-b border-border pb-2 pt-2">
            <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Monthly Target & IT Performance Bonus</h4>
          </div>

          <Field label="Monthly Target (₹)" required>
            <Input
              type="number"
              name="target_amount"
              defaultValue={target.targetAmount}
              required
              min="0"
              step="10000"
              placeholder="e.g. 500000"
            />
          </Field>

          <Field label="Performance Bonus (% on achieving 100%+)" required>
            <Input
              type="number"
              name="incentive_percent"
              defaultValue={target.incentivePercent}
              required
              min="0"
              max="50"
              step="0.5"
              placeholder="e.g. 5 or 8"
            />
          </Field>
        </div>

        <div className="rounded-xl border border-border bg-muted/30 p-3 text-xs text-muted-foreground space-y-1">
          <p className="font-semibold text-foreground">IT Standard Commission & Bonus Policy:</p>
          <p>• 100% \u2013 120% target achieved: 100% of declared bonus % added directly to salary.</p>
          <p>• &gt; 120% overachievement: Accelerator tier (+2.5% premium bonus rate applied to surplus sales).</p>
          <p>• &lt; 80% completion: Baseline target threshold not reached; no performance bonus paid.</p>
        </div>
      </div>
    </FormModal>
  );
}

export default function Compensation() {
  const { user } = useAuth();
  const isAdmin = String(user?.role ?? "").toUpperCase() === "ADMIN";

  const { data: adminProfiles, loading: adminLoading } = useSalaries();
  const { data: myProfile, loading: myLoading } = useMySalary();

  const [query, setQuery] = useState("");
  const [editProfile, setEditProfile] = useState(null);

  // Filtered rows for Admin
  const filteredProfiles = useMemo(() => {
    if (!Array.isArray(adminProfiles)) return [];
    const q = query.trim().toLowerCase();
    if (!q) return adminProfiles;
    return adminProfiles.filter((p) =>
      [p.user.name, p.user.email, p.user.role].join(" ").toLowerCase().includes(q)
    );
  }, [adminProfiles, query]);

  // Aggregate stats for Admin
  const stats = useMemo(() => {
    if (!Array.isArray(adminProfiles) || adminProfiles.length === 0) {
      return {
        totalPayroll: 0,
        totalTarget: 0,
        totalAchieved: 0,
        avgCompletion: 0,
        totalBonus: 0
      };
    }
    let totalPayroll = 0;
    let totalTarget = 0;
    let totalAchieved = 0;
    let totalBonus = 0;

    adminProfiles.forEach((p) => {
      totalPayroll += p.totalProjectedPayout || 0;
      totalTarget += p.target?.targetAmount || 0;
      totalAchieved += p.target?.achievedSales || 0;
      totalBonus += p.target?.earnedBonus || 0;
    });

    const avgCompletion = totalTarget > 0 ? Math.round((totalAchieved / totalTarget) * 100) : 0;
    return { totalPayroll, totalTarget, totalAchieved, avgCompletion, totalBonus };
  }, [adminProfiles]);

  if (!isAdmin) {
    // SALESPERSON VIEW: Clean, read-only personal dashboard
    const p = myProfile;
    const completion = p?.target?.completionRate || 0;
    const isTargetAchieved = completion >= 100;

    return (
      <AppShell
        title="My Salary & Target"
        subtitle="Transparent view of your monthly base compensation, live sales target, and earned bonus."
      >
        {myLoading ? (
          <div className="py-12 text-center text-sm text-muted-foreground">Loading your compensation details\u2026</div>
        ) : !p ? (
          <div className="py-12 text-center text-sm text-muted-foreground">No salary profile found. Please contact your administrator.</div>
        ) : (
          <div className="space-y-6">
            {/* KPI STATS */}
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <StatCard
                label="Base Net Salary"
                value={currency(p.salary.netBaseSalary)}
                hint={`Basic ₹${p.salary.basicSalary.toLocaleString()} + Allowances`}
              />
              <StatCard
                label="Monthly Sales Target"
                value={currency(p.target.targetAmount)}
                hint={`Month: ${new Date().toLocaleString("en-IN", { month: "long" })}`}
              />
              <StatCard
                label="Achieved Sales"
                value={currency(p.target.achievedSales)}
                delta={`${completion}%`}
                trend={completion >= 100 ? "up" : completion >= 80 ? "up" : "down"}
                hint={p.target.status}
              />
              <StatCard
                label="Total Projected Payout"
                value={currency(p.totalProjectedPayout)}
                delta={p.target.earnedBonus > 0 ? `+${currency(p.target.earnedBonus)} bonus` : "Base only"}
                trend="up"
                hint="Net Salary + Performance Bonus"
              />
            </div>

            {/* TARGET PROGRESS CARD */}
            <Panel
              title="Target Achievement & IT Performance Bonus Tracker"
              description={`Progress for ${new Date().toLocaleString("en-IN", { month: "long", year: "numeric" })}`}
            >
              <div className="space-y-5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-2xl font-bold font-display">{completion}%</span>
                      <Chip
                        tone={isTargetAchieved ? "success" : completion >= 80 ? "warning" : "default"}
                        dot
                      >
                        {p.target.status}
                      </Chip>
                      {p.target.tier === "ACCELERATOR" && (
                        <Chip tone="success" className="font-semibold bg-emerald-500/10 text-emerald-600">
                          <Zap className="size-3 mr-1 inline" /> 2.5% Accelerator Active!
                        </Chip>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Closed {currency(p.target.achievedSales)} of {currency(p.target.targetAmount)} target
                    </p>
                  </div>

                  <div className="text-right sm:text-right">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Earned Bonus</p>
                    <p className="text-2xl font-bold font-display text-emerald-600">
                      +{currency(p.target.earnedBonus)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {p.target.incentivePercent}% standard rate on achieved
                    </p>
                  </div>
                </div>

                {/* VISUAL PROGRESS BAR */}
                <div className="space-y-1.5">
                  <div className="h-4 w-full overflow-hidden rounded-full bg-muted/60">
                    <div
                      className={`h-full transition-all duration-500 rounded-full ${
                        isTargetAchieved
                          ? "bg-gradient-to-r from-emerald-500 to-teal-400"
                          : completion >= 80
                          ? "bg-gradient-to-r from-amber-500 to-orange-400"
                          : "bg-gradient-to-r from-primary to-sky-400"
                      }`}
                      style={{ width: `${Math.min(completion, 100)}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-[11px] text-muted-foreground font-medium">
                    <span>₹0</span>
                    <span>50%</span>
                    <span>100% Target (₹{(p.target.targetAmount / 1e5).toFixed(1)}L)</span>
                    <span className="text-emerald-600 font-semibold">120%+ Accelerator</span>
                  </div>
                </div>

                {/* BONUS DETAILS BANNER */}
                <div className="rounded-xl border border-border bg-muted/20 p-4 grid gap-3 sm:grid-cols-3">
                  <div>
                    <span className="text-xs text-muted-foreground">Target Incentive Rate</span>
                    <p className="text-sm font-bold text-foreground mt-0.5">{p.target.incentivePercent}%</p>
                  </div>
                  <div>
                    <span className="text-xs text-muted-foreground">Bonus Eligibility</span>
                    <p className="text-sm font-bold text-foreground mt-0.5">
                      {isTargetAchieved ? "100% Eligible (Added to Salary)" : completion >= 80 ? "50% Partial Tier" : "Need \u226580% to qualify"}
                    </p>
                  </div>
                  <div>
                    <span className="text-xs text-muted-foreground">Bonus Amount Added</span>
                    <p className="text-sm font-bold text-emerald-600 mt-0.5">
                      {currency(p.target.earnedBonus)}
                    </p>
                  </div>
                </div>
              </div>
            </Panel>

            {/* BREAKDOWN PANEL */}
            <div className="grid gap-6 sm:grid-cols-2">
              <Panel title="Monthly Salary Breakdown" description="Read-only structure defined by administrator">
                <dl className="divide-y divide-border text-sm">
                  <div className="flex justify-between py-2.5">
                    <dt className="text-muted-foreground">Basic Salary</dt>
                    <dd className="font-semibold">{currency(p.salary.basicSalary)}</dd>
                  </div>
                  <div className="flex justify-between py-2.5">
                    <dt className="text-muted-foreground">Allowances (HRA, Travel, Special)</dt>
                    <dd className="font-semibold text-emerald-600">+{currency(p.salary.allowances)}</dd>
                  </div>
                  <div className="flex justify-between py-2.5">
                    <dt className="text-muted-foreground">Deductions (PF, Tax, Professional)</dt>
                    <dd className="font-semibold text-rose-500">-{currency(p.salary.deductions)}</dd>
                  </div>
                  <div className="flex justify-between py-2.5 font-bold border-t-2 border-border text-base">
                    <dt className="text-foreground">Net Base Salary</dt>
                    <dd className="text-primary">{currency(p.salary.netBaseSalary)}</dd>
                  </div>
                </dl>
              </Panel>

              <Panel title="IT Bonus & Incentive Policy" description="How your sales bonus is calculated">
                <ul className="space-y-3 text-xs text-muted-foreground">
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="size-4 shrink-0 text-emerald-500 mt-0.5" />
                    <span>
                      <strong className="text-foreground">100% Target Met:</strong> Your declared bonus rate ({p.target.incentivePercent}%) is unlocked and added directly to your monthly payout.
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Zap className="size-4 shrink-0 text-amber-500 mt-0.5" />
                    <span>
                      <strong className="text-foreground">120%+ Accelerator Tier:</strong> For every rupee closed beyond 120% of your target, an extra 2.5% accelerator bonus is added.
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <AlertCircle className="size-4 shrink-0 text-muted-foreground mt-0.5" />
                    <span>
                      <strong className="text-foreground">Security & Integrity:</strong> Salary and bonus allocations are strictly managed and locked by administration.
                    </span>
                  </li>
                </ul>
              </Panel>
            </div>
          </div>
        )}
      </AppShell>
    );
  }

  // ADMIN VIEW: Comprehensive management table & modify controls
  return (
    <AppShell
      title="Compensation & Sales Targets"
      subtitle={`${filteredProfiles.length} active salespersons \u00b7 Declare salaries, assign monthly targets and configure IT performance bonus.`}
      actions={
        <GhostButton onClick={() => setQuery("")}>Clear filter</GhostButton>
      }
    >
      {/* STAT CARDS */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Total Monthly Payroll"
          value={currency(stats.totalPayroll)}
          hint="Net base salaries + bonuses"
        />
        <StatCard
          label="Total Team Target"
          value={currency(stats.totalTarget)}
          hint="Sum of monthly targets"
        />
        <StatCard
          label="Total Sales Achieved"
          value={currency(stats.totalAchieved)}
          delta={`${stats.avgCompletion}% avg`}
          trend={stats.avgCompletion >= 100 ? "up" : "down"}
          hint="Across all sales reps"
        />
        <StatCard
          label="Total Bonuses Unlocked"
          value={currency(stats.totalBonus)}
          trend="up"
          hint="Earned from target completion"
        />
      </div>

      <SearchField
        value={query}
        onChange={setQuery}
        placeholder="Search salesperson by name or email\u2026"
        className="max-w-sm"
      />

      {/* ADMIN SALESPERSON TABLE */}
      <TableShell>
        <thead>
          <tr>
            <Th>Sales Person</Th>
            <Th>Base Salary (₹)</Th>
            <Th>Monthly Target</Th>
            <Th>Achieved Sales</Th>
            <Th>Progress & Status</Th>
            <Th>Bonus % & Earned</Th>
            <Th>Projected Payout</Th>
            <Th>Action</Th>
          </tr>
        </thead>
        <tbody>
          {adminLoading ? (
            <tr>
              <td colSpan={8} className="py-8 text-center text-sm text-muted-foreground">
                Loading salary & target profiles\u2026
              </td>
            </tr>
          ) : filteredProfiles.length === 0 ? (
            <tr>
              <td colSpan={8} className="py-8 text-center text-sm text-muted-foreground">
                No sales persons found
              </td>
            </tr>
          ) : (
            filteredProfiles.map((p) => {
              const comp = p.target.completionRate || 0;
              const isDone = comp >= 100;
              return (
                <tr key={p.user.id} className="hover:bg-muted/40 transition-colors">
                  <Td>
                    <div className="flex items-center gap-3">
                      <Avatar initials={initialsOf(p.user.name)} className="size-9 font-semibold text-xs" />
                      <div>
                        <p className="font-semibold text-foreground">{p.user.name}</p>
                        <p className="text-xs text-muted-foreground">{p.user.email}</p>
                      </div>
                    </div>
                  </Td>

                  <Td>
                    <div>
                      <p className="font-semibold text-foreground">{currency(p.salary.netBaseSalary)}</p>
                      <p className="text-[11px] text-muted-foreground">
                        Basic: ₹{p.salary.basicSalary.toLocaleString()} +{currency(p.salary.allowances)}
                      </p>
                    </div>
                  </Td>

                  <Td>
                    <p className="font-semibold text-foreground">{currency(p.target.targetAmount)}</p>
                    <p className="text-[11px] text-muted-foreground">Month {p.target.month}/{p.target.year}</p>
                  </Td>

                  <Td>
                    <p className="font-semibold text-emerald-600">{currency(p.target.achievedSales)}</p>
                    <p className="text-[11px] text-muted-foreground">Closed deals</p>
                  </Td>

                  <Td>
                    <div className="w-36 space-y-1">
                      <div className="flex justify-between items-center text-xs">
                        <span className="font-bold">{comp}%</span>
                        <span className="text-[10px] text-muted-foreground">{p.target.status}</span>
                      </div>
                      <div className="h-2 w-full overflow-hidden rounded-full bg-muted/60">
                        <div
                          className={`h-full rounded-full transition-all duration-300 ${
                            isDone ? "bg-emerald-500" : comp >= 80 ? "bg-amber-500" : "bg-primary"
                          }`}
                          style={{ width: `${Math.min(comp, 100)}%` }}
                        />
                      </div>
                    </div>
                  </Td>

                  <Td>
                    <div>
                      <p className="font-semibold text-emerald-600">
                        +{currency(p.target.earnedBonus)}
                      </p>
                      <p className="text-[11px] text-muted-foreground">
                        Rate: {p.target.incentivePercent}%
                        {p.target.acceleratorAmount > 0 && " + Accel"}
                      </p>
                    </div>
                  </Td>

                  <Td>
                    <p className="font-bold text-foreground text-sm">
                      {currency(p.totalProjectedPayout)}
                    </p>
                  </Td>

                  <Td>
                    <button
                      onClick={() => setEditProfile(p)}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-2.5 py-1 text-xs font-semibold text-foreground hover:bg-muted transition-colors shadow-sm"
                    >
                      <Edit className="size-3.5" /> Modify
                    </button>
                  </Td>
                </tr>
              );
            })
          )}
        </tbody>
      </TableShell>

      {/* EDIT SALARY & TARGET MODAL */}
      <SalaryModal
        open={Boolean(editProfile)}
        profile={editProfile}
        onClose={() => setEditProfile(null)}
      />
    </AppShell>
  );
}
