import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, Calculator, Plus, Save } from "lucide-react";
import { AppShell, GhostButton, TableShell, Td, Th } from "../components/crm/AppShell";
import { Avatar, Chip, Panel, initialsOf, statusTone } from "../components/crm/ui-bits";
import { Field, Input, Select } from "../components/crm/form";
import { api } from "../lib/api";
import { useUsers } from "../lib/crm-store";

const COMPONENT_FIELDS = [
  ["basicSalary", "Basic salary"],
  ["allowances", "Allowances"],
  ["deductions", "Deductions"],
  ["bonus", "Bonus"],
  ["incentive", "Incentives"]
];
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const STATUS_FLOW = ["Pending", "Processed", "Paid"];

const money = (value) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(value || 0);

const defaultProfile = {
  basicSalary: 50000,
  allowances: 8000,
  deductions: 2500,
  bonus: 0,
  incentive: 0,
  workingDays: 26,
  presentDays: 26,
  paidLeave: 0
  ,targetAmount: 500000
  ,targetPeriod: "MONTHLY"
  ,targetMonth: new Date().getMonth()
  ,targetYear: new Date().getFullYear()
  ,targetWeekStart: ""
};

const normalizeProfile = (profile) => ({
  basicSalary: Number(profile?.basic_salary ?? defaultProfile.basicSalary),
  allowances: Number(profile?.allowances ?? defaultProfile.allowances),
  deductions: Number(profile?.deductions ?? defaultProfile.deductions),
  bonus: Number(profile?.bonus ?? defaultProfile.bonus),
  incentive: Number(profile?.incentive ?? defaultProfile.incentive),
  workingDays: Number(profile?.working_days ?? defaultProfile.workingDays),
  presentDays: Number(profile?.present_days ?? defaultProfile.presentDays),
  paidLeave: Number(profile?.paid_leave ?? defaultProfile.paidLeave),
  targetAmount: Number(profile?.target_amount ?? defaultProfile.targetAmount),
  targetPeriod: String(profile?.target_period ?? defaultProfile.targetPeriod),
  targetMonth: Number(profile?.target_month ?? defaultProfile.targetMonth),
  targetYear: Number(profile?.target_year ?? defaultProfile.targetYear),
  targetWeekStart: profile?.target_week_start?.slice?.(0, 10) ?? defaultProfile.targetWeekStart
});

const normalizeRecord = (record) => ({
  id: record.id,
  month: MONTHS[Number(record.month)] ?? record.month,
  year: Number(record.year),
  netSalary: Number(record.net_salary),
  achievedSales: Number(record.achieved_sales),
  targetBonus: Number(record.target_bonus),
  status: record.status
});

const calculateNet = (profile, targetBonus = 0) => {
  const attendanceDays = Number(profile.presentDays || 0) + Number(profile.paidLeave || 0);
  const attendanceFactor = Math.min(1, attendanceDays / Math.max(1, Number(profile.workingDays || 1)));
  const gross = Number(profile.basicSalary || 0) + Number(profile.allowances || 0) + Number(profile.bonus || 0) + Number(profile.incentive || 0) + targetBonus;
  return Math.max(0, gross * attendanceFactor - Number(profile.deductions || 0));
};

function SalaryComponents({ profile, targetBonus, onSave }) {
  const [values, setValues] = useState(profile);
  useEffect(() => setValues(profile), [profile]);

  const update = (name, value) => setValues((current) => ({ ...current, [name]: value }));
  const netSalary = calculateNet(values, targetBonus);

  return (
    <Panel
      title="Salary components"
      description="Set the monthly components used for payroll calculation."
      action={<span className="inline-flex items-center gap-2 text-sm font-bold text-primary"><Calculator className="size-4" /> {money(netSalary)} net</span>}
    >
      <form
        onSubmit={(event) => {
          event.preventDefault();
          onSave(Object.fromEntries(Object.entries(values).map(([key, value]) => [key, Number(value) || 0])));
        }}
        className="space-y-5"
      >
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {COMPONENT_FIELDS.map(([name, label]) => (
            <Field key={name} label={`${label} (₹)`}>
              <Input type="number" min="0" step="100" value={values[name]} onChange={(event) => update(name, event.target.value)} />
            </Field>
          ))}
        </div>
        <p className="text-sm text-muted-foreground">Target bonus included: <span className="font-bold text-foreground">{money(targetBonus)}</span></p>
        <div className="border-t border-border pt-5">
          <p className="mb-3 text-sm font-bold">Attendance for current month</p>
          <div className="grid gap-4 sm:grid-cols-3">
              {[["workingDays", "Working days"], ["presentDays", "Present days"]].map(([name, label]) => (
              <Field key={name} label={label}>
                <Input type="number" min="0" step="1" value={values[name]} onChange={(event) => update(name, event.target.value)} />
              </Field>
            ))}
              <Field label="Approved paid leave"><Input value={profile.paidLeave} readOnly /></Field>
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-muted/50 px-4 py-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.12em] text-muted-foreground">Calculated net salary</p>
            <p className="mt-1 text-xl font-extrabold">{money(netSalary)}</p>
          </div>
          <button type="submit" className="brand-surface inline-flex h-10 items-center gap-2 rounded-xl px-4 text-sm font-semibold text-primary-foreground">
            <Save className="size-4" /> Save components
          </button>
        </div>
      </form>
    </Panel>
  );
}

function MonthlyRecords({ records, profile, onCreate, onStatus }) {
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ month: MONTHS[new Date().getMonth()], year: new Date().getFullYear(), status: "Pending" });

  const addRecord = (event) => {
    event.preventDefault();
    onCreate({ month: MONTHS.indexOf(form.month), year: Number(form.year), status: form.status });
    setShowForm(false);
  };

  return (
    <Panel
      title="Monthly salary records"
      description="Track payroll from calculation through payment."
      action={<GhostButton onClick={() => setShowForm((open) => !open)}><Plus className="size-4" /> Add month</GhostButton>}
    >
      {showForm ? (
        <form onSubmit={addRecord} className="mb-5 grid gap-4 rounded-xl border border-border bg-muted/30 p-4 sm:grid-cols-4 sm:items-end">
          <Field label="Month"><Select value={form.month} onChange={(event) => setForm({ ...form, month: event.target.value })}>{MONTHS.map((month) => <option key={month}>{month}</option>)}</Select></Field>
          <Field label="Year"><Input type="number" min="2020" value={form.year} onChange={(event) => setForm({ ...form, year: event.target.value })} /></Field>
          <Field label="Status"><Select value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value })}>{STATUS_FLOW.map((status) => <option key={status}>{status}</option>)}</Select></Field>
          <button type="submit" className="brand-surface inline-flex h-10 items-center justify-center gap-2 rounded-xl px-4 text-sm font-semibold text-primary-foreground">Create record</button>
        </form>
      ) : null}
      <TableShell>
        <thead><tr><Th>Period</Th><Th>Net salary</Th><Th>Attendance</Th><Th>Status</Th><Th /></tr></thead>
        <tbody>
          {records.length === 0 ? <tr><Td colSpan={5} className="py-8 text-center text-muted-foreground">No monthly records yet.</Td></tr> : records.map((record) => {
            const nextStatus = STATUS_FLOW[Math.min(STATUS_FLOW.indexOf(record.status) + 1, STATUS_FLOW.length - 1)];
            return <tr key={record.id}>
              <Td className="font-semibold">{record.month} {record.year}</Td>
              <Td>{money(record.netSalary)}</Td>
              <Td className="text-muted-foreground">{record.achievedSales ? money(record.achievedSales) : `${profile.presentDays + profile.paidLeave}/${profile.workingDays} days`}</Td>
              <Td><Chip tone={statusTone(record.status)} dot>{record.status}</Chip></Td>
              <Td className="text-right">{record.status !== "Paid" ? <button type="button" className="text-xs font-bold text-primary hover:underline" onClick={() => onStatus(record.id, nextStatus)}>Mark {nextStatus}</button> : <span className="text-xs text-muted-foreground">Complete</span>}</Td>
            </tr>;
          })}
        </tbody>
      </TableShell>
    </Panel>
  );
}

export default function SalaryManagement() {
  const { id } = useParams();
  const { data: users, loading } = useUsers();
  const user = users.find((row) => String(row.id) === String(id));
  const [profile, setProfile] = useState(defaultProfile);
  const [records, setRecords] = useState([]);
  const [salaryLoading, setSalaryLoading] = useState(true);
  const [salaryError, setSalaryError] = useState(null);
  const [targetSales, setTargetSales] = useState(0);
  const [targetBonus, setTargetBonus] = useState(0);
  const [targetPeriodInput, setTargetPeriodInput] = useState(defaultProfile.targetPeriod);

  useEffect(() => {
    let alive = true;
    setSalaryLoading(true);
    api.get(`/salaries/${id}`)
      .then((response) => {
        if (!alive) return;
        setProfile(normalizeProfile(response?.data));
        setRecords((response?.data?.records ?? []).map(normalizeRecord));
        setTargetSales(Number(response?.data?.achievedSales || 0));
        setTargetBonus(Number(response?.data?.targetBonus || 0));
        setTargetPeriodInput(String(response?.data?.targetPeriod ?? response?.data?.profile?.target_period ?? defaultProfile.targetPeriod));
        setSalaryError(null);
      })
      .catch((error) => alive && setSalaryError(error))
      .finally(() => alive && setSalaryLoading(false));
    return () => { alive = false; };
  }, [id]);

  const saveProfile = async (next) => {
    const response = await api.put(`/salaries/${id}/profile`, next);
    setProfile(normalizeProfile(response?.data?.profile));
    const salary = await api.get(`/salaries/${id}`);
    setRecords((salary?.data?.records ?? []).map(normalizeRecord));
  };

  useEffect(() => {
    api.get(`/salaries/${id}`)
      .then((response) => {
        setTargetSales(Number(response?.data?.achievedSales || 0));
        setTargetBonus(Number(response?.data?.targetBonus || 0));
      })
      .catch(() => {});
  }, [id, profile.targetAmount, profile.targetPeriod, profile.targetMonth, profile.targetYear, profile.targetWeekStart]);

  const targetAmount = Number(profile.targetAmount || 0);
  const targetAchieved = targetAmount > 0 && targetSales >= targetAmount;
  const displayTargetBonus = targetAchieved ? targetBonus : 0;

  const subtitle = useMemo(() => user ? `${user.role} · ${user.email}` : loading ? "Loading employee record…" : "Employee not found", [loading, user]);
  if (!user) return <AppShell title="Salary management" subtitle={subtitle}><Panel><p className="text-sm text-muted-foreground">{loading ? "Loading employee…" : "This employee could not be loaded."}</p><Link to="/users" className="mt-4 inline-flex text-sm font-semibold text-primary">Back to users</Link></Panel></AppShell>;
  if (salaryLoading) return <AppShell title="Salary management" subtitle={subtitle}><Panel><p className="text-sm text-muted-foreground">Loading salary data…</p></Panel></AppShell>;
  if (salaryError) return <AppShell title="Salary management" subtitle={subtitle}><Panel><p className="text-sm text-destructive">{salaryError.message}</p></Panel></AppShell>;

  return <AppShell title="Salary management" subtitle={subtitle} actions={<Link to="/users"><GhostButton><ArrowLeft className="size-4" /> All users</GhostButton></Link>}>
    <div className="flex flex-wrap items-center gap-4 border-b border-border pb-5">
      <Avatar initials={initialsOf(user.name)} className="size-14 text-base" />
      <div><h2 className="text-xl font-extrabold">{user.name}</h2><p className="text-sm text-muted-foreground">Manage compensation, attendance and payroll history</p></div>
    </div>
    <Panel title="Sales target and bonus" description="Assign a weekly or monthly target. Achieving it earns an automatic 2% bonus on the target amount.">
      <form onSubmit={(event) => { event.preventDefault(); const body = Object.fromEntries(new FormData(event.currentTarget)); saveProfile({ ...profile, targetAmount: Number(body.targetAmount) || 0, targetPeriod: body.targetPeriod, targetMonth: Number(body.targetMonth), targetYear: Number(body.targetYear) || new Date().getFullYear(), targetWeekStart: body.targetWeekStart || "" }); }} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5 lg:items-end">
        <Field label="Target amount (₹)"><Input name="targetAmount" type="number" min="0" step="1000" defaultValue={profile.targetAmount} /></Field>
        <Field label="Target period"><Select name="targetPeriod" value={targetPeriodInput} onChange={(event) => setTargetPeriodInput(event.target.value)}><option value="MONTHLY">Monthly</option><option value="WEEKLY">Weekly</option></Select></Field>
        {targetPeriodInput === "WEEKLY" ? <Field label="Week starts"><Input name="targetWeekStart" type="date" defaultValue={profile.targetWeekStart} required /></Field> : <Field label="Target month"><Select name="targetMonth" defaultValue={profile.targetMonth}>{MONTHS.map((month, index) => <option key={month} value={index}>{month}</option>)}</Select></Field>}
        <Field label="Target year"><Input name="targetYear" type="number" min="2020" defaultValue={profile.targetYear} /></Field>
        <button type="submit" className="brand-surface inline-flex h-10 items-center justify-center gap-2 rounded-xl px-4 text-sm font-semibold text-primary-foreground"><Save className="size-4" /> Save target</button>
      </form>
      <div className="mt-5 grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl bg-muted/50 p-4"><p className="text-xs font-bold uppercase tracking-[0.12em] text-muted-foreground">Achieved</p><p className="mt-1 text-xl font-extrabold">{money(targetSales)}</p></div>
        <div className="rounded-xl bg-muted/50 p-4"><p className="text-xs font-bold uppercase tracking-[0.12em] text-muted-foreground">Remaining</p><p className="mt-1 text-xl font-extrabold">{targetAmount ? money(Math.max(0, targetAmount - targetSales)) : "—"}</p></div>
        <div className="rounded-xl bg-muted/50 p-4"><p className="text-xs font-bold uppercase tracking-[0.12em] text-muted-foreground">Achievement</p><p className="mt-1 text-xl font-extrabold">{targetAmount ? `${Math.round((targetSales / targetAmount) * 100)}%` : "—"}</p></div>
        <div className="rounded-xl bg-muted/50 p-4"><p className="text-xs font-bold uppercase tracking-[0.12em] text-muted-foreground">Status</p><p className={`mt-1 text-xl font-extrabold ${targetAchieved ? "text-primary" : "text-muted-foreground"}`}>{targetAchieved ? "Achieved" : targetSales > 0 ? "In progress" : "Not started"}</p></div>
        <div className="rounded-xl bg-muted/50 p-4"><p className="text-xs font-bold uppercase tracking-[0.12em] text-muted-foreground">2% bonus</p><p className="mt-1 text-xl font-extrabold text-primary">{targetAchieved ? money(displayTargetBonus) : "Not earned"}</p></div>
      </div>
    </Panel>
    <SalaryComponents profile={profile} targetBonus={displayTargetBonus} onSave={saveProfile} />
    <MonthlyRecords records={records} profile={profile} onCreate={async (body) => { const response = await api.post(`/salaries/${id}/records`, body); setRecords((current) => [normalizeRecord(response.data.record), ...current.filter((record) => record.id !== response.data.record.id)]); }} onStatus={async (recordId, status) => { const response = await api.patch(`/salaries/records/${recordId}/status`, { status }); setRecords((current) => current.map((record) => record.id === recordId ? normalizeRecord(response.data.record) : record)); }} />
  </AppShell>;
}
