import { useMemo, useState } from "react";
import { Building2, Phone, Mail, CalendarCheck2, Globe, MessageCircle, Plus, User2 } from "lucide-react";
import { AppShell, GhostButton, TableShell, Td, Th } from "../components/crm/AppShell";
import { Chip, StatCard, statusTone } from "../components/crm/ui-bits";
import {
  ConfirmModal,
  EmptyRow,
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
import { BulkBar, SelectTd, SelectTh, useSelection } from "../components/crm/bulk";
import { crud, personLabel, useFollowUps, useLookups } from "../lib/crm-store";

const TYPES = ["CALL", "EMAIL", "WHATSAPP", "MEETING", "DEMO", "OTHER"];
const pills = ["All", "Overdue", "Today", "Upcoming", "Done", "Cancelled"];

const channelIcon = {
  Call: Phone,
  Email: Mail,
  Meeting: CalendarCheck2,
  Demo: CalendarCheck2,
  Whatsapp: MessageCircle,
  WhatsApp: MessageCircle,
  Sms: MessageCircle,
  Visit: CalendarCheck2
};

export function FollowUpForm({ open, mode, row, lookups, onClose }) {
  const raw = row?.raw ?? {};
  const { leadRows, users } = lookups;

  const submit = async (fd) => {
    const body = formValues(fd);
    if (!body.lead_id) throw new Error("Pick a lead");
    ["lead_id", "assigned_to"].forEach((k) => {
      if (body[k]) body[k] = Number(body[k]);
    });
    if (body.scheduled_at) body.scheduled_at = new Date(body.scheduled_at).toISOString();
    if (mode === "edit") await crud.followUps.update(row.id, body);
    else await crud.followUps.create(body);
  };

  return (
    <FormModal
      key={`${mode}-${row?.id ?? "new"}-${open}`}
      open={open}
      wide
      title={mode === "edit" ? "Edit follow-up" : "Schedule follow-up"}
      description="Set the channel, the time and who owns it."
      submitLabel={mode === "edit" ? "Save changes" : "Schedule"}
      onClose={onClose}
      onSubmit={submit}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Lead">
          <Select name="lead_id" defaultValue={raw.lead_id ?? ""}>
            <option value="">Select a lead</option>
            {leadRows.map((l) => (
              <option key={l.id} value={l.id}>
                {personLabel(l)}
                {l.company ? ` · ${l.company}` : ""}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Channel" required>
          <Select name="follow_up_type" defaultValue={raw.follow_up_type ?? "CALL"}>
            {TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="When" required>
          <Input
            type="datetime-local"
            name="scheduled_at"
            required
            defaultValue={toLocalInput(raw.scheduled_at) || toLocalInput(new Date().toISOString())}
          />
        </Field>
        <Field label="Assigned to">
          <Select name="assigned_to" defaultValue={raw.assigned_to ?? ""}>
            <option value="">Me</option>
            {users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name} · {u.role}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Notes" className="sm:col-span-2">
          <Textarea name="notes" defaultValue={raw.notes ?? ""} placeholder="Purpose of this touch…" />
        </Field>
      </div>
    </FormModal>
  );
}

function CompleteForm({ open, row, outcomes, onClose }) {
  return (
    <FormModal
      key={`done-${row?.id}-${open}`}
      open={open}
      title="Log outcome"
      description={row ? `${row.channel} with ${row.lead}` : ""}
      submitLabel="Mark complete"
      onClose={onClose}
      onSubmit={async (fd) => {
        const body = formValues(fd);
        if (body.outcome_id) body.outcome_id = Number(body.outcome_id);
        await crud.followUps.complete(row.id, body);
      }}
    >
      <div className="space-y-4">
        {outcomes.length > 0 ? (
          <Field label="Outcome">
            <Select name="outcome_id" defaultValue="">
              <option value="">Not set</option>
              {outcomes.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name ?? o.outcome ?? `Outcome ${o.id}`}
                </option>
              ))}
            </Select>
          </Field>
        ) : null}
        <Field label="What happened?">
          <Textarea name="outcome" placeholder="Interested, call back next week…" />
        </Field>
        <Field label="Notes">
          <Textarea name="notes" />
        </Field>
      </div>
    </FormModal>
  );
}

function InlineFollowUpInfo({ row, lead }) {
  const raw = lead ?? row.raw ?? {};
  const fields = [
    { label: "Email", value: raw.email || "—", icon: Mail },
    { label: "Phone", value: raw.phone || "—", icon: Phone },
    { label: "Company", value: raw.company || "—", icon: Building2 },
    { label: "Source", value: raw.source || "Direct", icon: Globe },
    { label: "Assigned to", value: row.owner, icon: User2 },
    { label: "Status", value: row.status, icon: CalendarCheck2 }
  ];

  return (
    <div className="border-t border-border bg-muted/30 px-5 py-4 sm:px-6">
      <dl className="grid gap-x-8 gap-y-4 sm:grid-cols-2 lg:grid-cols-4">
        {fields.map((field) => (
          <div key={field.label}>
            <dt className="text-[11px] font-bold uppercase tracking-[0.12em] text-muted-foreground">
              {field.label}
            </dt>
            <dd className="mt-1 flex items-center gap-2 text-sm font-semibold">
              <field.icon className="size-3.5 shrink-0 text-muted-foreground" /> {field.value}
            </dd>
          </div>
        ))}
      </dl>
      <div className="mt-4 grid gap-2 border-t border-border pt-3 text-sm sm:grid-cols-2">
        <p><span className="font-semibold">Outcome:</span> {row.outcome}</p>
        <p><span className="font-semibold">Due:</span> {row.due}</p>
        <p><span className="font-semibold">Notes:</span> {row.note}</p>
      </div>
    </div>
  );
}

export default function FollowUps() {
  const { data: followUps, loading } = useFollowUps();
  const lookups = useLookups();
  const [form, setForm] = useState(null);
  const [done, setDone] = useState(null);
  const [cancel, setCancel] = useState(null);
  const [expandedFollowUp, setExpandedFollowUp] = useState(null);
  const [pill, setPill] = useState(pills[0]);
  const [query, setQuery] = useState("");

  const count = (s) => followUps.filter((f) => f.status === s).length;

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return followUps.filter((f) => {
      const matchQ = !q || [f.lead, f.note, f.owner, f.channel].join(" ").toLowerCase().includes(q);
      return matchQ && (pill === "All" || f.status === pill);
    });
  }, [followUps, query, pill]);

  const sel = useSelection(rows.map((f) => f.id));
  const assignable = (lookups.users ?? []).filter((u) =>
    ["SALES_PERSON", "SALES_MANAGER", "ADMIN"].includes(String(u.role).toUpperCase())
  );
  const leadForFollowUp = (followUp) =>
    lookups.leadRows.find((lead) => String(lead.id) === String(followUp.leadId ?? followUp.raw?.lead_id));
  const bulkAssign = async (userId) => {
    for (const id of sel.selected) await crud.followUps.update(id, { assigned_to: userId });
  };

  return (
    <AppShell
      title="Follow up"
      subtitle={`Step 2 · ${count("Overdue")} overdue of ${followUps.length} scheduled`}
      actions={
        <>
          <GhostButton onClick={() => setPill("Overdue")}>Show overdue</GhostButton>
          <button
            onClick={() => setForm({ mode: "create" })}
            className="brand-surface inline-flex h-10 items-center gap-2 rounded-xl px-4 text-sm font-semibold text-primary-foreground"
          >
            <Plus className="size-4" /> Schedule follow-up
          </button>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Overdue" value={String(count("Overdue"))} hint="clear these first" />
        <StatCard label="Due today" value={String(count("Today"))} hint="today's touches" />
        <StatCard label="Upcoming" value={String(count("Upcoming"))} hint="scheduled ahead" />
        <StatCard label="Completed" value={String(count("Done"))} hint="logged outcomes" />
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <FilterPills options={pills} value={pill} onChange={setPill} />
        <SearchField
          value={query}
          onChange={setQuery}
          placeholder="Search follow-ups…"
          className="ml-auto w-full sm:w-72"
        />
      </div>

      <BulkBar
        count={sel.selected.length}
        users={assignable}
        noun="follow-up"
        onAssign={bulkAssign}
        onClear={sel.clear}
      />

      <TableShell>
        <thead>
          <tr>
            <SelectTh
              checked={sel.allChecked}
              indeterminate={sel.someChecked}
              onChange={sel.toggleAll}
            />
            <Th>Lead</Th>
            <Th>Channel</Th>
            <Th>Purpose</Th>
            <Th>Due</Th>
            <Th>Assigned to</Th>
            <Th>Status</Th>
            <Th />
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <EmptyRow colSpan={8} message={loading ? "Loading follow-ups…" : "Nothing in this view"} />
          ) : (
            rows.map((f) => {
              const Icon = channelIcon[f.channel] ?? Phone;
              const closed = f.status === "Done" || f.status === "Cancelled";
              return (
                <>
                <tr
                  key={f.id}
                  tabIndex={0}
                  onClick={() => setExpandedFollowUp((current) => (current === f.id ? null : f.id))}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      setExpandedFollowUp((current) => (current === f.id ? null : f.id));
                    }
                  }}
                  className="cursor-pointer transition-colors hover:bg-muted/50"
                >
                  <SelectTd checked={sel.isSelected(f.id)} onChange={() => sel.toggle(f.id)} />
                  <Td>
                    <p className="font-semibold">{f.lead}</p>
                    <p className="text-xs text-muted-foreground">{f.company}</p>
                  </Td>
                  <Td>
                    <span className="inline-flex items-center gap-2 text-sm">
                      <span className="grid size-7 place-items-center rounded-lg bg-accent text-accent-foreground">
                        <Icon className="size-3.5" />
                      </span>
                      {f.channel}
                    </span>
                  </Td>
                  <Td className="text-muted-foreground">{f.note}</Td>
                  <Td className="numeric text-sm">{f.due}</Td>
                  <Td className="text-sm">{f.owner}</Td>
                  <Td>
                    <Chip tone={statusTone(f.status)} dot>
                      {f.status}
                    </Chip>
                  </Td>
                  <Td>
                    <div
                      className="flex items-center justify-end gap-1"
                      onClick={(event) => event.stopPropagation()}
                    >
                      <RowMenu
                        items={[
                          { label: "Edit / reschedule", onSelect: () => setForm({ mode: "edit", row: f }) },
                          closed ? null : { label: "Log outcome", onSelect: () => setDone(f) },
                          closed ? null : { label: "Cancel", danger: true, onSelect: () => setCancel(f) }
                        ]}
                      />
                    </div>
                  </Td>
                </tr>
                {expandedFollowUp === f.id ? (
                  <tr key={`${f.id}-follow-up-info`}>
                    <td colSpan={8} className="p-0">
                      <InlineFollowUpInfo row={f} lead={leadForFollowUp(f)} />
                    </td>
                  </tr>
                ) : null}
                </>
              );
            })
          )}
        </tbody>
      </TableShell>

      <FollowUpForm
        open={Boolean(form)}
        mode={form?.mode}
        row={form?.row}
        lookups={lookups}
        onClose={() => setForm(null)}
      />
      <CompleteForm
        open={Boolean(done)}
        row={done}
        outcomes={lookups.outcomes}
        onClose={() => setDone(null)}
      />
      <ConfirmModal
        open={Boolean(cancel)}
        title="Cancel follow-up"
        confirmLabel="Cancel follow-up"
        message={cancel ? `Cancel the ${cancel.channel.toLowerCase()} with ${cancel.lead}?` : ""}
        onClose={() => setCancel(null)}
        onConfirm={() => crud.followUps.cancel(cancel.id)}
      />
    </AppShell>
  );
}
