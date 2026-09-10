import { useMemo } from "react";
import { Link } from "react-router-dom";
import { AlertTriangle, CalendarClock, CheckCircle2, ExternalLink, Plus } from "lucide-react";
import { AppShell } from "../components/crm/AppShell";
import { Chip, Panel, StatCard } from "../components/crm/ui-bits";
import { crud, useFollowUps, useLookups } from "../lib/crm-store";
import { FollowUpForm } from "./FollowUps";
import { useState } from "react";

const MEETING_TYPES = ["MEETING", "DEMO"];

const when = (iso) =>
  iso
    ? new Date(iso).toLocaleString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit"
      })
    : "—";

function ScheduleRow({ row, overdue }) {
  const raw = row.raw ?? {};
  const isMeeting = MEETING_TYPES.includes(String(raw.follow_up_type).toUpperCase());
  return (
    <li
      className={`rounded-xl border px-4 py-3 ${
        overdue ? "border-destructive/30 bg-destructive/5" : "border-border bg-muted/40"
      }`}
    >
      <div className="flex flex-wrap items-center gap-2">
        <span
          className={`grid size-7 shrink-0 place-items-center rounded-lg ${
            overdue ? "bg-destructive/15 text-destructive" : "bg-primary-soft text-accent-foreground"
          }`}
        >
          {overdue ? <AlertTriangle className="size-3.5" /> : <CalendarClock className="size-3.5" />}
        </span>
        <p className="font-display text-sm font-extrabold">{row.lead}</p>
        <Chip tone={isMeeting ? "success" : "info"} dot>
          {isMeeting ? "Meeting" : "Follow-up"}
        </Chip>
        <Chip tone={overdue ? "danger" : "info"}>{row.status}</Chip>
        {raw.lead_id ? (
          <Link
            to={`/leads/${raw.lead_id}`}
            className="ml-auto text-muted-foreground transition-colors hover:text-primary"
            aria-label="Open lead"
          >
            <ExternalLink className="size-4" />
          </Link>
        ) : null}
      </div>
      <p className="mt-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {String(raw.follow_up_type ?? row.channel)} · {when(raw.scheduled_at)}
      </p>
      {row.note && row.note !== "No notes yet" ? (
        <p className="mt-1 text-sm text-muted-foreground">{row.note}</p>
      ) : null}
      <div className="mt-2.5 flex items-center gap-2">
        <button
          type="button"
          onClick={() => crud.followUps.complete(raw.id, { outcome: "Completed from agenda" })}
          className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-border bg-card px-3 text-xs font-bold text-foreground hover:bg-muted"
        >
          <CheckCircle2 className="size-3.5" /> Mark complete
        </button>
        <button
          type="button"
          onClick={() => crud.followUps.cancel(raw.id)}
          className="inline-flex h-8 items-center rounded-lg border border-border bg-card px-3 text-xs font-bold text-muted-foreground hover:text-destructive"
        >
          Cancel
        </button>
      </div>
    </li>
  );
}

export default function Agenda() {
  const { data: followUps, loading } = useFollowUps();
  const lookups = useLookups();
  const [formOpen, setFormOpen] = useState(false);

  const { overdue, upcoming, today, done } = useMemo(() => {
    const openRows = followUps.filter((f) => !["Done", "Cancelled"].includes(f.status));
    const byTime = (a, b) =>
      new Date(a.raw?.scheduled_at ?? 0).getTime() - new Date(b.raw?.scheduled_at ?? 0).getTime();
    return {
      overdue: openRows.filter((f) => f.status === "Overdue").sort(byTime),
      today: openRows.filter((f) => f.status === "Today").sort(byTime),
      upcoming: openRows.filter((f) => f.status === "Upcoming").sort(byTime),
      done: followUps.filter((f) => f.status === "Done").length
    };
  }, [followUps]);

  return (
    <AppShell
      title="Agenda"
      subtitle={new Date().toLocaleDateString("en-IN", {
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric"
      })}
      actions={
        <button
          type="button"
          onClick={() => setFormOpen(true)}
          className="brand-surface inline-flex h-10 items-center gap-2 rounded-xl px-4 text-sm font-semibold text-primary-foreground"
        >
          <Plus className="size-4" /> Add to agenda
        </button>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Overdue"
          value={String(overdue.length)}
          hint="needs a touch right now"
          trend={overdue.length > 0 ? "down" : "up"}
        />
        <StatCard label="Due today" value={String(today.length)} hint="scheduled for today" />
        <StatCard label="Upcoming" value={String(upcoming.length)} hint="future schedules" />
        <StatCard label="Completed" value={String(done)} hint="all logged outcomes" />
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <Panel
          title="Overdue"
          description="Past their scheduled time"
          action={<AlertTriangle className="size-4 text-destructive" />}
        >
          {overdue.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {loading ? "Loading schedules…" : "Nothing overdue — nicely done."}
            </p>
          ) : (
            <ul className="space-y-3">
              {overdue.map((row) => (
                <ScheduleRow key={row.id} row={row} overdue />
              ))}
            </ul>
          )}
        </Panel>

        <Panel
          title="Today"
          description="Scheduled for today"
          action={<CalendarClock className="size-4 text-primary" />}
        >
          {today.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {loading ? "Loading schedules…" : "Nothing left on today's list."}
            </p>
          ) : (
            <ul className="space-y-3">
              {today.map((row) => (
                <ScheduleRow key={row.id} row={row} />
              ))}
            </ul>
          )}
        </Panel>

        <Panel
          title="Upcoming"
          description="Next scheduled follow-ups and meetings"
          action={<CalendarClock className="size-4 text-primary" />}
        >
          {upcoming.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {loading ? "Loading schedules…" : "Nothing scheduled ahead yet."}
            </p>
          ) : (
            <ul className="space-y-3">
              {upcoming.map((row) => (
                <ScheduleRow key={row.id} row={row} />
              ))}
            </ul>
          )}
        </Panel>
      </div>

      <FollowUpForm
        open={formOpen}
        mode="create"
        lookups={lookups}
        onClose={() => setFormOpen(false)}
      />
    </AppShell>
  );
}
