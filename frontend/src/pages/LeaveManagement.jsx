import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, CalendarPlus, Trash2 } from "lucide-react";
import { AppShell, GhostButton, TableShell, Td, Th } from "../components/crm/AppShell";
import { Chip, Panel, statusTone } from "../components/crm/ui-bits";
import { Field, Input, Select, Textarea } from "../components/crm/form";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth";

const moneyDays = (value) => `${Number(value || 0)} day${Number(value || 0) === 1 ? "" : "s"}`;
const dateLabel = (value) => {
  const [year, month, day] = String(value ?? "").slice(0, 10).split("-").map(Number);
  return year && month && day ? new Date(year, month - 1, day).toLocaleDateString("en-IN") : "Invalid date";
};

export default function LeaveManagement() {
  const { user } = useAuth();
  const [leaves, setLeaves] = useState([]);
  const [form, setForm] = useState({ startDate: "", endDate: "", leaveType: "PAID", days: 1, duration: "1", reason: "" });
  const [open, setOpen] = useState(false);
  const [error, setError] = useState(null);

  const load = () => api.get(`/salaries/${user.id}/leaves`).then((response) => setLeaves(response?.data?.leaves ?? []));
  useEffect(() => { load().catch((requestError) => setError(requestError.message)); }, [user.id]);

  const submit = async (event) => {
    event.preventDefault();
    try {
      await api.post(`/salaries/${user.id}/leaves`, { ...form, days: Number(form.duration === "custom" ? form.days : form.duration) });
      setForm({ startDate: "", endDate: "", leaveType: "PAID", days: 1, duration: "1", reason: "" });
      setOpen(false);
      setError(null);
      await load();
    } catch (requestError) {
      setError(requestError.message);
    }
  };

  const remove = async (leaveId) => {
    try {
      await api.del(`/salaries/leaves/${leaveId}`);
      await load();
      setError(null);
    } catch (requestError) {
      setError(requestError.message);
    }
  };

  return <AppShell title="Leave requests" subtitle="Submit and track your paid or unpaid leave" actions={<Link to="/profile"><GhostButton><ArrowLeft className="size-4" /> My profile</GhostButton></Link>}>
    <Panel title="Request leave" description="Paid leave is credited as attendance. Approved unpaid leave reduces salary for the period.">
      <button type="button" onClick={() => setOpen((value) => !value)} className="brand-surface inline-flex h-10 items-center gap-2 rounded-xl px-4 text-sm font-semibold text-primary-foreground"><CalendarPlus className="size-4" /> New leave request</button>
      {open ? <form onSubmit={submit} className="mt-5 grid gap-4 rounded-xl border border-border bg-muted/30 p-4 sm:grid-cols-2 lg:grid-cols-5 lg:items-end">
        <Field label="Start date" required><Input type="date" required value={form.startDate} onChange={(event) => setForm({ ...form, startDate: event.target.value })} /></Field>
        <Field label="End date" required><Input type="date" required value={form.endDate} onChange={(event) => setForm({ ...form, endDate: event.target.value })} /></Field>
        <Field label="Leave type" required><Select value={form.leaveType} onChange={(event) => setForm({ ...form, leaveType: event.target.value })}><option value="PAID">Paid leave</option><option value="UNPAID">Unpaid leave</option></Select></Field>
        <Field label="Duration" required><Select value={form.duration} onChange={(event) => setForm({ ...form, duration: event.target.value })}><option value="0.5">Half day</option><option value="1">Full day</option><option value="2">2 days</option><option value="3">3 days</option><option value="custom">Custom</option></Select></Field>
        {form.duration === "custom" ? <Field label="Days" required><Input type="number" min="0.5" step="0.5" required value={form.days} onChange={(event) => setForm({ ...form, days: event.target.value })} /></Field> : null}
        <Field label="Reason" className="sm:col-span-2 lg:col-span-5"><Textarea value={form.reason} onChange={(event) => setForm({ ...form, reason: event.target.value })} placeholder="Reason for leave" /></Field>
        <button type="submit" className="brand-surface inline-flex h-10 items-center justify-center rounded-xl px-4 text-sm font-semibold text-primary-foreground">Submit request</button>
      </form> : null}
      {error ? <p className="mt-3 text-sm font-semibold text-destructive">{error}</p> : null}
    </Panel>
    <Panel title="My leave history" description="Only approved leave affects salary distribution.">
      <TableShell><thead><tr><Th>Dates</Th><Th>Type</Th><Th>Days</Th><Th>Status</Th><Th>Reason</Th><Th /></tr></thead><tbody>
        {leaves.length === 0 ? <tr><Td colSpan={6} className="py-8 text-center text-muted-foreground">No leave requests yet.</Td></tr> : leaves.map((leave) => <tr key={leave.id}><Td>{dateLabel(leave.start_date)} - {dateLabel(leave.end_date)}</Td><Td className="font-semibold">{leave.leave_type === "PAID" ? "Paid" : "Unpaid"}</Td><Td>{moneyDays(leave.days)}</Td><Td><Chip tone={statusTone(leave.status)} dot>{leave.status}</Chip></Td><Td className="text-muted-foreground">{leave.reason || "-"}</Td><Td className="text-right">{leave.status === "PENDING" ? <button type="button" onClick={() => remove(leave.id)} className="text-muted-foreground hover:text-destructive" aria-label="Delete leave request"><Trash2 className="size-4" /></button> : <span className="text-xs text-muted-foreground">Locked</span>}</Td></tr>)}
      </tbody></TableShell>
    </Panel>
  </AppShell>;
}
