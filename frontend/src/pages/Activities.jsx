import { useMemo, useState } from "react";
import {
  Phone,
  Mail,
  CalendarCheck2,
  StickyNote,
  GitBranch,
  Plus,
  MessageCircle,
  Activity as ActivityIcon
} from "lucide-react";
import { AppShell, GhostButton } from "../components/crm/AppShell";
import { Chip, Panel } from "../components/crm/ui-bits";
import {
  ConfirmModal,
  Field,
  FilterPills,
  FormModal,
  Input,
  RowMenu,
  SearchField,
  Select,
  Textarea,
  formValues,
  toLocalInput
} from "../components/crm/form";
import { crud, personLabel, useActivities, useLookups } from "../lib/crm-store";

const TYPES = ["CALL", "EMAIL", "WHATSAPP", "MEETING", "NOTE", "VISIT", "OTHER"];
const pills = ["All", ...TYPES.map((t) => t.charAt(0) + t.slice(1).toLowerCase())];

const icons = {
  Call: Phone,
  Email: Mail,
  Meeting: CalendarCheck2,
  Note: StickyNote,
  Whatsapp: MessageCircle,
  Sms: MessageCircle,
  Visit: CalendarCheck2,
  "Stage change": GitBranch
};

const tones = {
  Call: "primary",
  Email: "info",
  Meeting: "success",
  Note: "muted",
  Whatsapp: "success",
  Visit: "warning",
  "Stage change": "warning"
};

function ActivityForm({ open, mode, row, lookups, onClose }) {
  const raw = row?.raw ?? {};
  const { leadRows, contactRows } = lookups;

  const submit = async (fd) => {
    const body = formValues(fd);
    if (!body.lead_id && !body.contact_id) throw new Error("Pick a lead or a contact");
    ["lead_id", "contact_id"].forEach((k) => {
      if (body[k]) body[k] = Number(body[k]);
    });
    if (body.activity_at) body.activity_at = new Date(body.activity_at).toISOString();
    if (mode === "edit") await crud.activities.update(row.id, body);
    else await crud.activities.create(body);
  };

  return (
    <FormModal
      key={`${mode}-${row?.id ?? "new"}-${open}`}
      open={open}
      wide
      title={mode === "edit" ? "Edit activity" : "Log activity"}
      description="Record a call, email, meeting or note against a lead or contact."
      submitLabel={mode === "edit" ? "Save changes" : "Log activity"}
      onClose={onClose}
      onSubmit={submit}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Type" required>
          <Select name="activity_type" defaultValue={raw.activity_type ?? "CALL"}>
            {TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="When">
          <Input
            type="datetime-local"
            name="activity_at"
            defaultValue={toLocalInput(raw.activity_at) || toLocalInput(new Date().toISOString())}
          />
        </Field>
        <Field label="Lead">
          <Select name="lead_id" defaultValue={raw.lead_id ?? ""}>
            <option value="">None</option>
            {leadRows.map((l) => (
              <option key={l.id} value={l.id}>
                {personLabel(l)}
                {l.company ? ` · ${l.company}` : ""}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Contact">
          <Select name="contact_id" defaultValue={raw.contact_id ?? ""}>
            <option value="">None</option>
            {contactRows.map((c) => (
              <option key={c.id} value={c.id}>
                {personLabel(c)}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Subject" className="sm:col-span-2">
          <Input name="subject" defaultValue={raw.subject ?? ""} />
        </Field>
        <Field label="Description" className="sm:col-span-2">
          <Textarea name="description" defaultValue={raw.description ?? ""} />
        </Field>
      </div>
    </FormModal>
  );
}

export default function Activities() {
  const { data: activities, loading } = useActivities();
  const lookups = useLookups();
  const [form, setForm] = useState(null);
  const [remove, setRemove] = useState(null);
  const [pill, setPill] = useState("All");
  const [query, setQuery] = useState("");

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return activities.filter((a) => {
      const matchQ = !q || [a.subject, a.detail, a.actor, a.type].join(" ").toLowerCase().includes(q);
      return matchQ && (pill === "All" || a.type === pill);
    });
  }, [activities, query, pill]);

  const mix = TYPES.map((t) => {
    const label = t.charAt(0) + t.slice(1).toLowerCase();
    return { label, value: activities.filter((a) => a.type === label).length };
  }).filter((r) => r.value > 0);
  const max = Math.max(1, ...mix.map((m) => m.value));

  return (
    <AppShell
      title="Activities"
      subtitle={`${activities.length} logged touches, newest first`}
      actions={
        <>
          <GhostButton onClick={() => { setPill("All"); setQuery(""); }}>Reset filters</GhostButton>
          <button
            onClick={() => setForm({ mode: "create" })}
            className="brand-surface inline-flex h-10 items-center gap-2 rounded-xl px-4 text-sm font-semibold text-primary-foreground"
          >
            <Plus className="size-4" /> Log activity
          </button>
        </>
      }
    >
      <div className="flex flex-wrap items-center gap-3">
        <FilterPills options={pills} value={pill} onChange={setPill} />
        <SearchField
          value={query}
          onChange={setQuery}
          placeholder="Search activities…"
          className="ml-auto w-full sm:w-72"
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.5fr_1fr]">
        <Panel title="Timeline" description={`${rows.length} entries`}>
          {rows.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              {loading ? "Loading activities…" : "Nothing logged in this view yet."}
            </p>
          ) : (
            <ol className="relative space-y-6 pl-6">
              <span className="absolute bottom-2 left-[11px] top-2 w-px bg-border" />
              {rows.map((a) => {
                const Icon = icons[a.type] ?? ActivityIcon;
                return (
                  <li key={a.id} className="relative">
                    <span className="absolute -left-6 top-0 grid size-6 place-items-center rounded-full border border-border bg-card text-primary">
                      <Icon className="size-3" />
                    </span>
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-bold">{a.subject}</p>
                      <Chip tone={tones[a.type] ?? "muted"}>{a.type}</Chip>
                      <span className="ml-auto text-[11px] text-muted-foreground">{a.when}</span>
                      <RowMenu
                        items={[
                          { label: "Edit activity", onSelect: () => setForm({ mode: "edit", row: a }) },
                          { label: "Delete activity", danger: true, onSelect: () => setRemove(a) }
                        ]}
                      />
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">{a.detail}</p>
                    <p className="mt-0.5 text-[11px] text-muted-foreground/80">by {a.actor}</p>
                  </li>
                );
              })}
            </ol>
          )}
        </Panel>

        <div className="space-y-6">
          <Panel title="Activity mix" description="All logged entries">
            {mix.length === 0 ? (
              <p className="text-sm text-muted-foreground">No activities yet.</p>
            ) : (
              <ul className="space-y-3">
                {mix.map((row) => (
                  <li key={row.label}>
                    <div className="flex justify-between text-sm">
                      <span className="font-semibold">{row.label}</span>
                      <span className="numeric text-muted-foreground">{row.value}</span>
                    </div>
                    <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-muted">
                      <div
                        className="brand-surface h-full rounded-full"
                        style={{ width: `${(row.value / max) * 100}%` }}
                      />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          <Panel title="Quick log" description="One click to record a touch">
            <div className="flex flex-wrap gap-2">
              {["CALL", "EMAIL", "MEETING", "NOTE"].map((t) => (
                <button
                  key={t}
                  onClick={() => setForm({ mode: "create" })}
                  className="rounded-xl border border-border bg-card px-3 py-2 text-xs font-semibold text-muted-foreground transition-colors hover:text-foreground"
                >
                  + {t.charAt(0) + t.slice(1).toLowerCase()}
                </button>
              ))}
            </div>
          </Panel>
        </div>
      </div>

      <ActivityForm
        open={Boolean(form)}
        mode={form?.mode}
        row={form?.row}
        lookups={lookups}
        onClose={() => setForm(null)}
      />
      <ConfirmModal
        open={Boolean(remove)}
        title="Delete activity"
        message={remove ? `Remove “${remove.subject}” from the timeline?` : ""}
        onClose={() => setRemove(null)}
        onConfirm={() => crud.activities.remove(remove.id)}
      />
    </AppShell>
  );
}
