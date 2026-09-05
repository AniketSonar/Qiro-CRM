import { useMemo, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  ArrowLeft,
  Plus,
  Phone,
  Mail,
  MessageCircle,
  CalendarCheck2,
  Building2,
  Globe,
  User2,
  Paperclip,
  Share2,
  FileDown,
  Trash2,
  Pencil
} from "lucide-react";
import { AppShell, GhostButton } from "../components/crm/AppShell";
import {
  Avatar,
  Chip,
  Panel,
  initialsOf,
  leadTemperature,
  leadTemperatureTone,
  statusTone
} from "../components/crm/ui-bits";
import {
  Field,
  FormModal,
  Input,
  Select,
  Textarea,
  formValues,
  toDateInput,
  toLocalInput
} from "../components/crm/form";
import { currency } from "../lib/crm-data";
import {
  addAttachment,
  downloadAttachment,
  humanSize,
  listAttachments,
  removeAttachment,
  shareAttachment
} from "../lib/quotation";
import {
  crud,
  dateTimeLabel,
  titleCase,
  useLeadDeals,
  useLeadFollowUps,
  useLeadRecord,
  useLookups
} from "../lib/crm-store";

const LEAD_STATUSES = [
  "NEW",
  "CONTACTED",
  "QUALIFIED",
  "PROPOSAL",
  "NEGOTIATION",
  "CONVERTED",
  "LOST"
];

const DEAL_STAGES = [
  "QUALIFIED",
  "PROPOSAL",
  "DEMO",
  "NEGOTIATION",
  "CLOSED_WON",
  "CLOSED_LOST"
];

const FOLLOW_UP_TYPES = ["CALL", "EMAIL", "WHATSAPP", "OTHER"];
const MEETING_TYPES = ["MEETING", "DEMO"];

const typeIcon = {
  CALL: Phone,
  EMAIL: Mail,
  WHATSAPP: MessageCircle,
  MEETING: CalendarCheck2,
  DEMO: CalendarCheck2
};

const fuTone = (status) =>
  ({ COMPLETED: "success", CANCELLED: "muted", PENDING: "info" }[String(status).toUpperCase()] ??
  statusTone(titleCase(status)));

/* ---------- forms ---------- */

function LeadInfoForm({ open, lead, sources, onClose }) {
  return (
    <FormModal
      key={`lead-info-${lead?.id}-${open}`}
      open={open}
      wide
      title="Edit lead information"
      description="Update the lead details and opportunity value."
      submitLabel="Save changes"
      onClose={onClose}
      onSubmit={async (fd) => {
        const body = formValues(fd);
        if (body.amount) body.amount = Number(body.amount);
        if (body.source_id) body.source_id = Number(body.source_id);
        await crud.leads.update(lead.id, body);
      }}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="First name" required>
          <Input name="first_name" required defaultValue={lead?.first_name ?? ""} />
        </Field>
        <Field label="Last name">
          <Input name="last_name" defaultValue={lead?.last_name ?? ""} />
        </Field>
        <Field label="Email">
          <Input type="email" name="email" defaultValue={lead?.email ?? ""} />
        </Field>
        <Field label="Phone">
          <Input name="phone" defaultValue={lead?.phone ?? ""} />
        </Field>
        <Field label="Company">
          <Input name="company" defaultValue={lead?.company ?? ""} />
        </Field>
        <Field label="Amount (₹)">
          <Input type="number" min="0" step="0.01" name="amount" defaultValue={lead?.amount ?? ""} />
        </Field>
        <Field label="Source">
          <Select name="source_id" defaultValue={lead?.source_id ?? ""}>
            <option value="">Not set</option>
            {sources.map((source) => (
              <option key={source.id} value={source.id}>
                {source.name ?? source.source_name ?? `Source ${source.id}`}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Notes" className="sm:col-span-2">
          <Textarea name="notes" defaultValue={lead?.notes ?? ""} />
        </Field>
      </div>
    </FormModal>
  );
}

function TouchForm({ open, leadId, kind, row, users, onClose }) {
  const raw = row ?? {};
  const meeting = kind === "meeting";
  const types = meeting ? MEETING_TYPES : FOLLOW_UP_TYPES;

  return (
    <FormModal
      key={`${kind}-${raw.id ?? "new"}-${open}`}
      open={open}
      wide
      title={
        raw.id
          ? meeting
            ? "Reschedule meeting"
            : "Reschedule follow-up"
          : meeting
            ? "Schedule meeting"
            : "Schedule follow-up"
      }
      description={
        meeting ? "Book a meeting or demo with this lead." : "Plan the next touch with this lead."
      }
      submitLabel={raw.id ? "Save changes" : "Schedule"}
      onClose={onClose}
      onSubmit={async (fd) => {
        const body = formValues(fd);
        body.lead_id = Number(leadId);
        if (body.assigned_to) body.assigned_to = Number(body.assigned_to);
        if (body.scheduled_at) body.scheduled_at = new Date(body.scheduled_at).toISOString();
        if (raw.id) await crud.followUps.update(raw.id, body);
        else await crud.followUps.create(body);
      }}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Type" required>
          <Select name="follow_up_type" defaultValue={raw.follow_up_type ?? types[0]}>
            {types.map((t) => (
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
          <Textarea
            name="notes"
            defaultValue={raw.notes ?? ""}
            placeholder={meeting ? "Agenda, location or meeting link…" : "Purpose of this touch…"}
          />
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
      description={row ? `${row.follow_up_type} — ${dateTimeLabel(row.scheduled_at)}` : ""}
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

function DealForm({ open, leadId, deal, users, onClose }) {
  const raw = deal ?? {};
  return (
    <FormModal
      key={`deal-${raw.id ?? "new"}-${open}`}
      open={open}
      wide
      title={raw.id ? "Edit quotation / deal" : "New quotation / deal"}
      description="Quote the value and expected close for this lead."
      submitLabel={raw.id ? "Save changes" : "Create"}
      onClose={onClose}
      onSubmit={async (fd) => {
        const body = formValues(fd);
        if (body.amount) body.amount = Number(body.amount);
        if (body.assigned_to) body.assigned_to = Number(body.assigned_to);
        if (raw.id) await crud.deals.update(raw.id, body);
        else await crud.deals.create({ ...body, lead_id: Number(leadId) });
      }}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Title" required className="sm:col-span-2">
          <Input name="title" required autoFocus defaultValue={raw.title ?? ""} />
        </Field>
        <Field label="Amount (₹)" required>
          <Input type="number" min="0" step="1" name="amount" required defaultValue={raw.amount ?? ""} />
        </Field>
        <Field label="Stage">
          <Select name="stage" defaultValue={raw.stage ?? "QUALIFIED"}>
            {DEAL_STAGES.filter((s) => s !== "CLOSED_LOST").map((s) => (
              <option key={s} value={s}>
                {s.replace(/_/g, " ")}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Expected close">
          <Input
            type="date"
            name="expected_close_date"
            defaultValue={toDateInput(raw.expected_close_date)}
          />
        </Field>
        {raw.id ? null : (
          <Field label="Assigned to">
            <Select name="assigned_to" defaultValue="">
              <option value="">Me</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name} · {u.role}
                </option>
              ))}
            </Select>
          </Field>
        )}
        <Field label="Description" className="sm:col-span-2">
          <Textarea name="description" defaultValue={raw.description ?? ""} />
        </Field>
      </div>
    </FormModal>
  );
}

function LostForm({ open, deal, onClose }) {
  return (
    <FormModal
      key={`lost-${deal?.id}-${open}`}
      open={open}
      title="Close deal as lost"
      description="A reason is required before a deal can be marked lost."
      submitLabel="Mark lost"
      onClose={onClose}
      onSubmit={async (fd) => {
        const reason = String(fd.get("lost_reason") ?? "").trim();
        if (!reason) throw new Error("Add a reason");
        await crud.deals.setStage(deal.id, "CLOSED_LOST", { lost_reason: reason });
      }}
    >
      <Field label="Reason" required>
        <Textarea name="lost_reason" required placeholder="Budget, competitor, no response…" />
      </Field>
    </FormModal>
  );
}

/* ---------- section shell ---------- */

function Section({ title, description, action, children }) {
  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-lg font-extrabold">{title}</h2>
          {description ? <p className="text-sm text-muted-foreground">{description}</p> : null}
        </div>
        {action}
      </div>
      <div className="space-y-3">{children}</div>
    </section>
  );
}

function AddButton({ children, onClick }) {
  return (
    <button
      onClick={onClick}
      className="brand-surface inline-flex h-10 items-center gap-2 rounded-xl px-4 text-sm font-semibold text-primary-foreground"
    >
      <Plus className="size-4" /> {children}
    </button>
  );
}

function TouchCard({ row, onComplete, onCancel, onEdit }) {
  const Icon = typeIcon[String(row.follow_up_type).toUpperCase()] ?? Phone;
  const open = !["COMPLETED", "CANCELLED"].includes(String(row.status).toUpperCase());
  return (
    <div className="panel p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="flex items-center gap-2 font-display text-base font-extrabold">
            <span className="grid size-7 place-items-center rounded-lg bg-accent text-accent-foreground">
              <Icon className="size-3.5" />
            </span>
            {row.follow_up_type} — {dateTimeLabel(row.scheduled_at)}
          </p>
          <p className="mt-1.5 flex items-center gap-2 text-sm text-muted-foreground">
            Assigned to {row.assigned_user ?? "—"}
            <Chip tone={fuTone(row.status)} dot>
              {String(row.status).toUpperCase()}
            </Chip>
          </p>
          {row.notes ? <p className="mt-2 text-sm">{row.notes}</p> : null}
          {row.outcome ? (
            <p className="mt-1 text-sm text-muted-foreground">
              <span className="font-semibold text-foreground">Outcome:</span> {row.outcome}
            </p>
          ) : null}
        </div>
        {open ? (
          <div className="flex items-center gap-2">
            <GhostButton onClick={() => onEdit(row)}>Reschedule</GhostButton>
            <GhostButton onClick={() => onComplete(row)}>Mark Complete</GhostButton>
            <button
              onClick={() => onCancel(row)}
              className="inline-flex h-10 items-center rounded-xl border border-destructive/40 px-4 text-sm font-semibold text-destructive transition-colors hover:bg-destructive/10"
            >
              Cancel
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}


function DocumentCard({ deal, documentType, onEdit, onStage }) {
  const fileInput = useRef(null);
  const [files, setFiles] = useState(() => listAttachments(deal.id, documentType));
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const isQuotation = documentType === "quotation";
  const title = isQuotation ? "Quotation" : "Invoice";

  const pick = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setError(null);
    try {
      setFiles(await addAttachment(deal.id, file, documentType));
    } catch (err) {
      setError(err.message);
    }
  };

  const share = async () => {
    if (!files[0]) {
      setError(`Attach the ${title.toLowerCase()} PDF first`);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await shareAttachment(files[0], title);
    } catch (err) {
      setError(err?.message ?? "Could not build the PDF");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="panel p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-display text-base font-extrabold">
            {deal.title} — {currency(Number(deal.amount ?? 0))}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            Assigned to {deal.assigned_user ?? "—"} · Probability {deal.probability ?? 0}% · Expected
            close{" "}
            {deal.expected_close_date
              ? new Date(deal.expected_close_date).toLocaleDateString("en-IN", {
                  day: "2-digit",
                  month: "short",
                  year: "numeric"
                })
              : "—"}
          </p>
          {deal.description ? <p className="mt-2 text-sm">{deal.description}</p> : null}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <GhostButton onClick={() => onEdit(deal)}>Edit</GhostButton>
          <Select
            className="w-[180px] font-semibold"
            value={deal.stage ?? "QUALIFIED"}
            onChange={(e) => onStage(deal, e.target.value)}
          >
            {DEAL_STAGES.map((s) => (
              <option key={s} value={s}>
                {s.replace(/_/g, " ")}
              </option>
            ))}
          </Select>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-border pt-4">
        <button
          type="button"
          onClick={share}
          disabled={busy}
          className="brand-surface inline-flex h-10 items-center gap-2 rounded-xl px-4 text-sm font-semibold text-primary-foreground disabled:opacity-60"
        >
          <Share2 className="size-4" /> {busy ? "Sharing…" : `Share ${title.toLowerCase()} PDF`}
        </button>
        <GhostButton onClick={() => fileInput.current?.click()}>
          <Paperclip className="size-4" /> Attach file
        </GhostButton>
        <input ref={fileInput} type="file" className="hidden" onChange={pick} />
        <span className="text-xs text-muted-foreground">
          Select the {title.toLowerCase()} PDF from your device
        </span>
      </div>

      {error ? (
        <p className="mt-3 text-sm font-semibold text-destructive">{error}</p>
      ) : null}

      {files.length > 0 ? (
        <ul className="mt-3 space-y-2">
          {files.map((att) => (
            <li
              key={att.id}
              className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-muted/40 px-3 py-2"
            >
              <Paperclip className="size-4 shrink-0 text-muted-foreground" />
              <span className="min-w-0 flex-1 truncate text-sm font-semibold">{att.name}</span>
              <span className="text-xs text-muted-foreground">{humanSize(att.size)}</span>
              <button
                type="button"
                onClick={() => downloadAttachment(att)}
                className="grid size-8 place-items-center rounded-lg border border-border bg-card text-muted-foreground hover:text-foreground"
                aria-label="Download attachment"
              >
                <FileDown className="size-4" />
              </button>
              <button
                type="button"
                onClick={() => setFiles(removeAttachment(deal.id, att.id, documentType))}
                className="grid size-8 place-items-center rounded-lg border border-border bg-card text-muted-foreground hover:text-destructive"
                aria-label="Remove attachment"
              >
                <Trash2 className="size-4" />
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

/* ---------- page ---------- */

export default function LeadDetail() {
  const { id } = useParams();
  const { data: lead, loading, error } = useLeadRecord(id);
  const { data: touches } = useLeadFollowUps(id);
  const { data: deals } = useLeadDeals(id);
  const { users, outcomes, sources } = useLookups();

  const [touchForm, setTouchForm] = useState(null); // { kind, row }
  const [complete, setComplete] = useState(null);
  const [dealForm, setDealForm] = useState(null);
  const [lost, setLost] = useState(null);
  const [leadInfoOpen, setLeadInfoOpen] = useState(false);

  const assignable = users.filter((u) =>
    ["SALES_PERSON", "SALES_MANAGER", "ADMIN"].includes(String(u.role).toUpperCase())
  );

  const { followUps, meetings } = useMemo(() => {
    const isMeeting = (t) => MEETING_TYPES.includes(String(t).toUpperCase());
    const sorted = [...touches].sort(
      (a, b) => new Date(b.scheduled_at).getTime() - new Date(a.scheduled_at).getTime()
    );
    return {
      followUps: sorted.filter((t) => !isMeeting(t.follow_up_type)),
      meetings: sorted.filter((t) => isMeeting(t.follow_up_type))
    };
  }, [touches]);

  const name =
    [lead?.first_name, lead?.last_name].filter(Boolean).join(" ") || lead?.email || `Lead ${id}`;

  if (!lead) {
    return (
      <AppShell title="Lead" subtitle={loading ? "Loading…" : "Not available"}>
        <Panel>
          <p className="text-sm text-muted-foreground">
            {loading ? "Loading lead…" : error?.message ?? "This lead could not be loaded."}
          </p>
          <Link to="/leads" className="mt-4 inline-flex text-sm font-semibold text-primary">
            Back to leads
          </Link>
        </Panel>
      </AppShell>
    );
  }

  return (
    <AppShell
      title={name}
      subtitle={`${lead.company || "No company"} · ${lead.source || "Direct"} · Assigned to ${lead.assigned_user || "Unassigned"}`}
      actions={
        <>
          <Link to="/leads">
            <GhostButton>
              <ArrowLeft className="size-4" /> All leads
            </GhostButton>
          </Link>
          <Select
            className="w-[170px] font-semibold"
            value={lead.status ?? "NEW"}
            onChange={(e) => crud.leads.setStatus(lead.id, e.target.value)}
          >
            {LEAD_STATUSES.map((s) => (
              <option key={s} value={s}>
                {s.replace(/_/g, " ")}
              </option>
            ))}
          </Select>
        </>
      }
    >
      <Panel
        title="Lead information"
        description="Contact details and current stage"
        action={
          <GhostButton onClick={() => setLeadInfoOpen(true)}>
            <Pencil className="size-4" /> Edit
          </GhostButton>
        }
      >
        <div className="flex flex-wrap items-start gap-6">
          <Avatar initials={initialsOf(name)} className="size-14 text-base" />
          <dl className="grid flex-1 gap-x-8 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">
            {[
              { label: "Email", value: lead.email || "—", icon: Mail },
              { label: "Phone", value: lead.phone || "—", icon: Phone },
              { label: "Company", value: lead.company || "—", icon: Building2 },
              { label: "Amount", value: currency(lead.amount ?? 0), icon: Building2 },
              { label: "Source", value: lead.source || "Direct", icon: Globe },
              { label: "Assigned to", value: lead.assigned_user || "Unassigned", icon: User2 },
              {
                label: "Stage",
                value: titleCase(lead.status),
                icon: CalendarCheck2
              },
              {
                label: "Probability",
                value: (
                  <Chip tone={leadTemperatureTone(leadTemperature(lead))} dot>
                    {leadTemperature(lead)}
                  </Chip>
                ),
                icon: CalendarCheck2
              }
            ].map((f) => (
              <div key={f.label}>
                <dt className="text-[11px] font-bold uppercase tracking-[0.12em] text-muted-foreground">
                  {f.label}
                </dt>
                <dd className="mt-1 flex items-center gap-2 text-sm font-semibold">
                  <f.icon className="size-3.5 text-muted-foreground" /> {f.value}
                </dd>
              </div>
            ))}
          </dl>
        </div>
        {lead.notes ? (
          <p className="mt-5 border-t border-border pt-4 text-sm text-muted-foreground">
            {lead.notes}
          </p>
        ) : null}
      </Panel>

      <LeadInfoForm
        open={leadInfoOpen}
        lead={lead}
        sources={sources}
        onClose={() => setLeadInfoOpen(false)}
      />

      <Section
        title="Follow-ups"
        description={`${followUps.length} logged`}
        action={<AddButton onClick={() => setTouchForm({ kind: "follow-up" })}>Schedule Follow-up</AddButton>}
      >
        {followUps.length === 0 ? (
          <Panel>
            <p className="text-sm text-muted-foreground">No follow-ups yet for this lead.</p>
          </Panel>
        ) : (
          followUps.map((row) => (
            <TouchCard
              key={row.id}
              row={row}
              onEdit={(r) => setTouchForm({ kind: "follow-up", row: r })}
              onComplete={setComplete}
              onCancel={(r) => crud.followUps.cancel(r.id)}
            />
          ))
        )}
      </Section>

      <Section
        title="Meetings"
        description={`${meetings.length} scheduled`}
        action={<AddButton onClick={() => setTouchForm({ kind: "meeting" })}>Schedule Meeting</AddButton>}
      >
        {meetings.length === 0 ? (
          <Panel>
            <p className="text-sm text-muted-foreground">No meetings or demos booked yet.</p>
          </Panel>
        ) : (
          meetings.map((row) => (
            <TouchCard
              key={row.id}
              row={row}
              onEdit={(r) => setTouchForm({ kind: "meeting", row: r })}
              onComplete={setComplete}
              onCancel={(r) => crud.followUps.cancel(r.id)}
            />
          ))
        )}
      </Section>

      <Section
        title="Quotation / Deal"
        description={`${deals.length} linked`}
        action={<AddButton onClick={() => setDealForm({})}>New Quotation / Deal</AddButton>}
      >
        {deals.length === 0 ? (
          <Panel>
            <p className="text-sm text-muted-foreground">
              No quotation raised yet. Create one when the lead is qualified.
            </p>
          </Panel>
        ) : (
          deals.map((d) => (
            <DocumentCard
              key={d.id}
              deal={d}
              documentType="quotation"
              onEdit={setDealForm}
              onStage={(deal, next) => {
                if (next === "CLOSED_LOST") setLost(deal);
                else crud.deals.setStage(deal.id, next);
              }}
            />
          ))
        )}
      </Section>

      <Section
        title="Invoice"
        description="Attach and share the invoice PDF for each deal"
      >
        {deals.length === 0 ? (
          <Panel>
            <p className="text-sm text-muted-foreground">Create a quotation / deal before attaching an invoice.</p>
          </Panel>
        ) : (
          deals.map((d) => (
            <DocumentCard
              key={`invoice-${d.id}`}
              deal={d}
              documentType="invoice"
              onEdit={setDealForm}
              onStage={(deal, next) => {
                if (next === "CLOSED_LOST") setLost(deal);
                else crud.deals.setStage(deal.id, next);
              }}
            />
          ))
        )}
      </Section>

      <TouchForm
        open={Boolean(touchForm)}
        leadId={id}
        kind={touchForm?.kind}
        row={touchForm?.row}
        users={assignable}
        onClose={() => setTouchForm(null)}
      />
      <CompleteForm
        open={Boolean(complete)}
        row={complete}
        outcomes={outcomes}
        onClose={() => setComplete(null)}
      />
      <DealForm
        open={Boolean(dealForm)}
        leadId={id}
        deal={dealForm?.id ? dealForm : null}
        users={assignable}
        onClose={() => setDealForm(null)}
      />
      <LostForm open={Boolean(lost)} deal={lost} onClose={() => setLost(null)} />
    </AppShell>
  );
}
