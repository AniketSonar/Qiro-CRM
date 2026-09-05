import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { AlertTriangle, Bell, X } from "lucide-react";
import { useFollowUps } from "../../lib/crm-store";

const SNOOZE_KEY = "qiro.overdue.snoozedUntil";
const SNOOZE_MS = 30 * 60 * 1000;

/** Live reminder for overdue follow-ups: banner + one browser notification. */
export function OverdueReminder() {
  const { data: followUps } = useFollowUps();
  const [dismissed, setDismissed] = useState(() => {
    const until = Number(localStorage.getItem(SNOOZE_KEY) ?? 0);
    return Date.now() < until;
  });

  const overdue = useMemo(
    () => followUps.filter((f) => f.status === "Overdue"),
    [followUps]
  );

  useEffect(() => {
    if (overdue.length === 0) return;
    if (typeof Notification === "undefined" || Notification.permission !== "granted") return;
    const stamp = `qiro.overdue.notified.${new Date().toDateString()}.${overdue.length}`;
    if (sessionStorage.getItem(stamp)) return;
    sessionStorage.setItem(stamp, "1");
    new Notification("Overdue follow-ups", {
      body: `${overdue.length} follow-up${overdue.length > 1 ? "s" : ""} need attention.`
    });
  }, [overdue.length]);

  if (overdue.length === 0 || dismissed) return null;

  const snooze = () => {
    localStorage.setItem(SNOOZE_KEY, String(Date.now() + SNOOZE_MS));
    setDismissed(true);
  };

  const enableAlerts = () => {
    if (typeof Notification !== "undefined" && Notification.permission === "default") {
      Notification.requestPermission();
    }
  };

  return (
    <div className="panel flex flex-wrap items-center gap-3 border-destructive/30 bg-destructive/5 px-4 py-3">
      <span className="grid size-8 place-items-center rounded-xl bg-destructive/15 text-destructive">
        <AlertTriangle className="size-4" />
      </span>
      <div className="min-w-0">
        <p className="text-sm font-bold">
          {overdue.length} overdue follow-up{overdue.length > 1 ? "s" : ""}
        </p>
        <p className="truncate text-xs text-muted-foreground">
          Oldest: {overdue[0].lead} · {overdue[0].channel} · {overdue[0].due}
        </p>
      </div>
      <div className="ml-auto flex items-center gap-2">
        <Link
          to="/agenda"
          className="brand-surface inline-flex h-9 items-center rounded-xl px-3 text-xs font-bold text-primary-foreground"
        >
          Review agenda
        </Link>
        <button
          type="button"
          onClick={enableAlerts}
          className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-border bg-card px-3 text-xs font-bold text-muted-foreground hover:text-foreground"
        >
          <Bell className="size-3.5" /> Alerts
        </button>
        <button
          type="button"
          onClick={snooze}
          aria-label="Snooze reminder"
          className="grid size-9 place-items-center rounded-xl border border-border bg-card text-muted-foreground hover:text-foreground"
        >
          <X className="size-4" />
        </button>
      </div>
    </div>
  );
}
