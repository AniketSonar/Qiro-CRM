import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { CalendarDays, ChevronLeft, ChevronRight, Plus, Trash2 } from "lucide-react";
import { AppShell, GhostButton } from "../components/crm/AppShell";
import { Chip, Panel, statusTone } from "../components/crm/ui-bits";
import { Field, Input, Select, Textarea } from "../components/crm/form";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth";

const monthLabel = (date) => date.toLocaleDateString("en-IN", { month: "long", year: "numeric" });
const dateKey = (value) => String(value ?? "").slice(0, 10);
const dateLabel = (value) => {
  const key = dateKey(value);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(key)) return "Invalid date";
  const [year, month, day] = key.split("-").map(Number);
  return new Date(year, month - 1, day).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
};
const iso = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

function CalendarGrid({ date, events }) {
  const first = new Date(date.getFullYear(), date.getMonth(), 1);
  const start = new Date(first);
  start.setDate(first.getDate() - first.getDay());
  return <div className="overflow-hidden rounded-xl border border-border">
    <div className="grid grid-cols-7 border-b border-border bg-muted/40 text-center text-[11px] font-bold uppercase tracking-[0.12em] text-muted-foreground">
      {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => <div key={day} className="px-2 py-3">{day}</div>)}
    </div>
    <div className="grid grid-cols-7">
      {Array.from({ length: 42 }, (_, index) => {
        const day = new Date(start);
        day.setDate(start.getDate() + index);
        const dayEvents = events.filter((event) => event.start <= iso(day) && event.end >= iso(day));
        const inMonth = day.getMonth() === date.getMonth();
        const isToday = iso(day) === iso(new Date());
        return <div key={iso(day)} className={`group relative min-h-24 border-b border-r border-border p-2 ${inMonth ? "bg-card" : "bg-muted/20"} ${isToday ? "bg-emerald-50/80 ring-2 ring-inset ring-emerald-500" : ""}`}>
          <p className={`text-xs font-bold ${isToday ? "text-emerald-700" : inMonth ? "text-foreground" : "text-muted-foreground/50"}`}>{day.getDate()}{isToday ? <span className="ml-1 inline-block size-1.5 rounded-full bg-emerald-500 align-middle" /> : null}</p>
          <div className="mt-2 space-y-1">
            {dayEvents.slice(0, 2).map((event) => <div key={`${event.type}-${event.id}`} className={`truncate rounded-md px-1.5 py-1 text-[10px] font-bold ${event.type === "holiday" ? "bg-warning/20 text-warning-foreground" : event.leaveType === "UNPAID" ? "bg-destructive/10 text-destructive" : "bg-primary-soft text-primary"}`} title={event.label}>{event.label}</div>)}
            {dayEvents.length > 2 ? <div className="text-[10px] font-bold text-muted-foreground">+{dayEvents.length - 2} more</div> : null}
          </div>
          {dayEvents.length > 0 ? <div className="pointer-events-auto absolute left-2 top-full z-30 hidden max-h-64 w-56 overscroll-contain overflow-y-auto rounded-lg border border-border bg-card text-left shadow-lg group-hover:block">
            <div className="flex items-center justify-between gap-2 border-b border-border bg-muted/60 px-3 py-2">
              <p className="text-xs font-extrabold text-foreground">Calendar details</p>
              <span className="text-[11px] font-semibold text-muted-foreground">{dateLabel(iso(day))}</span>
            </div>
            <div className="space-y-2 px-3 py-2">
              {dayEvents.map((event) => <div key={`detail-${event.type}-${event.id}`} className="overflow-hidden rounded-md border border-border">
                <div className={`flex items-center gap-1.5 px-2 py-1.5 text-xs font-bold ${event.type === "holiday" ? "bg-warning/15 text-warning-foreground" : event.leaveType === "UNPAID" ? "bg-destructive/10 text-destructive" : "bg-primary-soft text-primary"}`}>
                  <span className="size-1.5 shrink-0 rounded-full bg-current" />
                  <span className="min-w-0 truncate">{event.type === "leave" ? event.personName : event.label}</span>
                </div>
                <div className="px-2 py-2 text-[11px]">
                  {event.type === "leave" ? <div className="flex items-center justify-between gap-2 border-t border-border pt-2"><span className="text-muted-foreground">{event.days === 0.5 ? "Half day" : `${event.leaveType === "PAID" ? "Paid" : "Unpaid"} leave`}</span><Chip tone={statusTone(event.status)}>{event.status}</Chip></div> : <p className="border-t border-border pt-2 text-muted-foreground">{event.description || "Company holiday"}</p>}
                  {event.type === "leave" && event.reason ? <p className="mt-1 truncate text-muted-foreground" title={event.reason}>{event.reason}</p> : null}
                </div>
              </div>)}
            </div>
          </div> : null}
        </div>;
      })}
    </div>
  </div>;
}

export default function Calendar() {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const isAdmin = String(user?.role ?? "").toUpperCase() === "ADMIN";
  const [date, setDate] = useState(new Date());
  const [holidays, setHolidays] = useState([]);
  const [leaves, setLeaves] = useState([]);
  const [open, setOpen] = useState(false);
  const [requestOpen, setRequestOpen] = useState(searchParams.get("request") === "1");
  const [requestForm, setRequestForm] = useState({ startDate: "", endDate: "", leaveType: "PAID", days: 1, duration: "1", reason: "" });
  const [form, setForm] = useState({ holidayDate: "", name: "", description: "" });
  const [error, setError] = useState(null);

  const load = () => api.get("/calendar").then((response) => {
    setHolidays(response?.data?.holidays ?? []);
    setLeaves(response?.data?.leaves ?? []);
  });
  useEffect(() => { load().catch((requestError) => setError(requestError.message)); }, []);

  const submitLeave = async (event) => {
    event.preventDefault();
    try {
      await api.post(`/salaries/${user.id}/leaves`, { ...requestForm, days: Number(requestForm.duration === "custom" ? requestForm.days : requestForm.duration) });
      setRequestForm({ startDate: "", endDate: "", leaveType: "PAID", days: 1, duration: "1", reason: "" });
      setRequestOpen(false);
      setError(null);
      await load();
    } catch (requestError) {
      setError(requestError.message);
    }
  };

  const events = useMemo(() => [
    ...holidays.map((holiday) => ({ id: holiday.id, type: "holiday", start: dateKey(holiday.holiday_date), end: dateKey(holiday.holiday_date), description: holiday.description, label: holiday.name })),
    ...leaves.map((leave) => ({ id: leave.id, type: "leave", start: dateKey(leave.start_date), end: dateKey(leave.end_date), leaveType: leave.leave_type, status: leave.status, days: leave.days, reason: leave.reason, personName: leave.user_name || "Your leave", label: `${leave.leave_type === "PAID" ? "Paid" : "Unpaid"} leave${isAdmin && leave.user_name ? ` · ${leave.user_name}` : ""} · ${leave.status}` }))
  ], [holidays, leaves, isAdmin]);

  const submitHoliday = async (event) => {
    event.preventDefault();
    try {
      await api.post("/calendar/holidays", form);
      setForm({ holidayDate: "", name: "", description: "" });
      setOpen(false);
      await load();
    } catch (requestError) {
      setError(requestError.message);
    }
  };

  const removeHoliday = async (id) => {
    await api.del(`/calendar/holidays/${id}`);
    await load();
  };

  const updateLeaveStatus = async (leaveId, status) => {
    try {
      await api.patch(`/salaries/leaves/${leaveId}/status`, { status });
      setError(null);
      await load();
    } catch (requestError) {
      setError(requestError.message);
    }
  };

  const removeLeave = async (leaveId) => {
    try {
      await api.del(`/salaries/leaves/${leaveId}`);
      setError(null);
      await load();
    } catch (requestError) {
      setError(requestError.message);
    }
  };

  return <AppShell title="Calendar" subtitle={isAdmin ? "Company holidays and leave for all salespeople" : "Company holidays and your leave"} actions={<>
    <GhostButton onClick={() => setDate(new Date(date.getFullYear(), date.getMonth() - 1, 1))}><ChevronLeft className="size-4" /> Previous</GhostButton>
    <GhostButton onClick={() => setDate(new Date())}>Today</GhostButton>
    <GhostButton onClick={() => setDate(new Date(date.getFullYear(), date.getMonth() + 1, 1))}>Next <ChevronRight className="size-4" /></GhostButton>
    {!isAdmin ? <button type="button" onClick={() => setRequestOpen((value) => !value)} className="brand-surface inline-flex h-10 items-center gap-2 rounded-xl px-4 text-sm font-semibold text-primary-foreground"><Plus className="size-4" /> Request leave</button> : null}
    {isAdmin ? <button type="button" onClick={() => setOpen((value) => !value)} className="brand-surface inline-flex h-10 items-center gap-2 rounded-xl px-4 text-sm font-semibold text-primary-foreground"><Plus className="size-4" /> Add holiday</button> : null}
  </>}>
    {error ? <p className="mb-4 text-sm font-semibold text-destructive">{error}</p> : null}
    {!isAdmin && requestOpen ? <Panel title="Request leave" description="Approved paid leave counts toward attendance. Approved unpaid leave reduces salary.">
      <form onSubmit={submitLeave} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5 lg:items-end">
        <Field label="Start date" required><Input type="date" required value={requestForm.startDate} onChange={(event) => setRequestForm({ ...requestForm, startDate: event.target.value })} /></Field>
        <Field label="End date" required><Input type="date" required value={requestForm.endDate} onChange={(event) => setRequestForm({ ...requestForm, endDate: event.target.value })} /></Field>
        <Field label="Leave type" required><select className="h-10 rounded-xl border border-border bg-card px-3 text-sm" value={requestForm.leaveType} onChange={(event) => setRequestForm({ ...requestForm, leaveType: event.target.value })}><option value="PAID">Paid leave</option><option value="UNPAID">Unpaid leave</option></select></Field>
        <Field label="Duration" required><Select value={requestForm.duration} onChange={(event) => setRequestForm({ ...requestForm, duration: event.target.value })}><option value="0.5">Half day</option><option value="1">Full day</option><option value="2">2 days</option><option value="3">3 days</option><option value="custom">Custom</option></Select></Field>
        {requestForm.duration === "custom" ? <Field label="Days" required><Input type="number" min="0.5" step="0.5" required value={requestForm.days} onChange={(event) => setRequestForm({ ...requestForm, days: event.target.value })} /></Field> : null}
        <Field label="Reason" className="sm:col-span-2 lg:col-span-5"><Textarea value={requestForm.reason} onChange={(event) => setRequestForm({ ...requestForm, reason: event.target.value })} /></Field>
        <button type="submit" className="brand-surface inline-flex h-10 items-center justify-center rounded-xl px-4 text-sm font-semibold text-primary-foreground">Submit request</button>
      </form>
    </Panel> : null}
    {isAdmin && open ? <Panel title="Add company holiday" description="This holiday will appear on every salesperson calendar.">
      <form onSubmit={submitHoliday} className="grid gap-4 sm:grid-cols-3 sm:items-end">
        <Field label="Date" required><Input type="date" required value={form.holidayDate} onChange={(event) => setForm({ ...form, holidayDate: event.target.value })} /></Field>
        <Field label="Holiday name" required><Input required value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="Republic Day" /></Field>
        <Field label="Description"><Textarea value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} /></Field>
        <button type="submit" className="brand-surface inline-flex h-10 items-center justify-center rounded-xl px-4 text-sm font-semibold text-primary-foreground">Save holiday</button>
      </form>
    </Panel> : null}
    <Panel title={monthLabel(date)} description="Holidays and leave are shown on their applicable dates.">
      <CalendarGrid date={date} events={events} />
      <div className="mt-4 flex flex-wrap gap-3 text-xs font-semibold text-muted-foreground"><span className="inline-flex items-center gap-1.5"><i className="size-2 rounded-full bg-warning" /> Company holiday</span><span className="inline-flex items-center gap-1.5"><i className="size-2 rounded-full bg-primary" /> Paid leave</span><span className="inline-flex items-center gap-1.5"><i className="size-2 rounded-full bg-destructive" /> Unpaid leave</span></div>
    </Panel>
    <Panel title={isAdmin ? "Holiday list" : "Company holidays"} description={isAdmin ? "Manage the holidays shared with salespeople." : "Shared company holidays."}>
      {holidays.length === 0 ? <p className="text-sm text-muted-foreground">No company holidays have been added.</p> : <ul className="divide-y divide-border">{holidays.map((holiday) => <li key={holiday.id} className="flex items-center gap-3 py-3"><CalendarDays className="size-4 text-warning" /><span className="flex-1"><b>{holiday.name}</b><span className="ml-2 text-sm text-muted-foreground">{dateLabel(holiday.holiday_date)}</span>{holiday.description ? <span className="block text-xs text-muted-foreground">{holiday.description}</span> : null}</span>{isAdmin ? <button type="button" onClick={() => removeHoliday(holiday.id)} className="text-muted-foreground hover:text-destructive" aria-label={`Delete ${holiday.name}`}><Trash2 className="size-4" /></button> : null}</li>)}</ul>}
    </Panel>
    {!isAdmin ? <Panel title="My leave requests" description="Pending requests can be deleted before admin review.">
      {leaves.length === 0 ? <p className="text-sm text-muted-foreground">No leave requests yet.</p> : <ul className="divide-y divide-border">{leaves.map((leave) => <li key={leave.id} className="flex flex-wrap items-center gap-3 py-3"><div className="min-w-0 flex-1"><p className="text-sm font-bold">{leave.leave_type === "PAID" ? "Paid" : "Unpaid"} leave · {leave.days} days</p><p className="text-xs text-muted-foreground">{dateLabel(leave.start_date)} - {dateLabel(leave.end_date)}{leave.reason ? ` · ${leave.reason}` : ""}</p></div><Chip tone={statusTone(leave.status)} dot>{leave.status}</Chip>{leave.status === "PENDING" ? <button type="button" onClick={() => removeLeave(leave.id)} className="text-muted-foreground hover:text-destructive" aria-label="Delete leave request"><Trash2 className="size-4" /></button> : <span className="text-xs text-muted-foreground">Locked</span>}</li>)}</ul>}
    </Panel> : null}
    {isAdmin ? <Panel title="Salesperson leave" description="Approve or reject leave for active and inactive salespeople.">
      {leaves.length === 0 ? <p className="text-sm text-muted-foreground">No leave records.</p> : <ul className="divide-y divide-border">{leaves.map((leave) => <li key={leave.id} className="flex flex-wrap items-center gap-3 py-3">
        <div className="min-w-0 flex-1"><p className="text-sm font-bold">{leave.user_name} <span className="font-normal text-muted-foreground">· {leave.leave_type === "PAID" ? "Paid" : "Unpaid"} · {leave.days} days</span></p><p className="text-xs text-muted-foreground">{dateLabel(leave.start_date)} - {dateLabel(leave.end_date)}{leave.reason ? ` · ${leave.reason}` : ""}</p></div>
        <Chip tone={statusTone(leave.status)} dot>{leave.status}</Chip>
        {leave.status === "PENDING" ? <span className="inline-flex gap-3"><button type="button" className="text-xs font-bold text-primary hover:underline" onClick={() => updateLeaveStatus(leave.id, "APPROVED")}>Approve</button><button type="button" className="text-xs font-bold text-destructive hover:underline" onClick={() => updateLeaveStatus(leave.id, "REJECTED")}>Reject</button></span> : <span className="text-xs text-muted-foreground">Reviewed</span>}
      </li>)}</ul>}
    </Panel> : null}
  </AppShell>;
}
