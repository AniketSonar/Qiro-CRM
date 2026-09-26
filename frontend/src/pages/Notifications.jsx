import { useState } from "react";
import { Bell, CheckCheck, Loader2 } from "lucide-react";
import { AppShell, GhostButton } from "../components/crm/AppShell";
import { Chip, Panel } from "../components/crm/ui-bits";
import { FilterPills, RowMenu } from "../components/crm/form";
import { crud, useNotifications } from "../lib/crm-store";

const pills = ["All", "Unread", "Read"];

export default function Notifications() {
  const { data: notifications, loading } = useNotifications();
  const [pill, setPill] = useState("All");
  const [busy, setBusy] = useState(false);

  const unread = notifications.filter((n) => n.unread).length;
  const rows = notifications.filter((n) =>
    pill === "All" ? true : pill === "Unread" ? n.unread : !n.unread
  );

  const markAll = async () => {
    setBusy(true);
    try {
      await crud.notifications.markAllRead();
    } finally {
      setBusy(false);
    }
  };

  return (
    <AppShell
      title="Notifications"
      subtitle={`${unread} unread of ${notifications.length} updates`}
      actions={
        <GhostButton onClick={markAll} disabled={busy || unread === 0}>
          {busy ? <Loader2 className="size-4 animate-spin" /> : <CheckCheck className="size-4" />} Mark all
          read
        </GhostButton>
      }
    >
      <FilterPills options={pills} value={pill} onChange={setPill} />

      <Panel bodyClassName="p-0">
        {rows.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted-foreground">
            {loading ? "Loading notifications…" : "Nothing here right now."}
          </p>
        ) : (
          <ul className="divide-y divide-border">
            {rows.map((n) => (
              <li
                key={n.id}
                className={`flex gap-4 px-5 py-4 transition-colors hover:bg-muted/50 ${
                  n.unread ? "bg-primary-soft/40" : ""
                }`}
              >
                <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-accent text-accent-foreground">
                  <Bell className="size-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-bold">{n.title}</p>
                    {n.unread ? <Chip tone="primary">New</Chip> : null}
                    <span className="ml-auto text-[11px] text-muted-foreground">{n.when}</span>
                    <RowMenu
                      items={[
                        n.unread
                          ? { label: "Mark as read", onSelect: () => crud.notifications.markRead(n.id) }
                          : null,
                        { label: "Delete", danger: true, onSelect: () => crud.notifications.remove(n.id) }
                      ]}
                    />
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">{n.body}</p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </AppShell>
  );
}
