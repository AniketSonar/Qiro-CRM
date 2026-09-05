import { useMemo, useState } from "react";
import { Building2, CalendarCheck2, Globe, Mail, Phone, Plus, User2 } from "lucide-react";
import { AppShell, GhostButton, TableShell, Td, Th } from "../components/crm/AppShell";
import {
  Chip,
  StatCard,
  leadTemperature,
  leadTemperatureTone,
  stageTone
} from "../components/crm/ui-bits";
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
  toDateInput
} from "../components/crm/form";
import { currency } from "../lib/crm-data";
import { BulkBar, SelectTd, SelectTh, useSelection } from "../components/crm/bulk";
import { crud, personLabel, useDeals, useLeads, useLookups, titleCase } from "../lib/crm-store";

const STAGES = ["QUALIFIED", "PROPOSAL", "DEMO", "NEGOTIATION", "CLOSED_WON", "CLOSED_LOST"];

const pills = ["All deals", "Open", "Deal done", "Lost"];

function DealForm({ open, mode, deal, lookups, onClose }) {
  const raw = deal?.raw ?? {};
  const { leadRows, contactRows, users } = lookups;

  const submit = async (fd) => {
    const body = formValues(fd);
    if (!body.lead_id && !body.contact_id) throw new Error("Link the deal to a lead or a contact");
    ["lead_id", "contact_id", "assigned_to"].forEach((k) => {
      if (body[k]) body[k] = Number(body[k]);
    });
    if (body.amount) body.amount = Number(body.amount);
    if (mode === "edit") await crud.deals.update(raw.id ?? deal.id, body);
    else await crud.deals.create(body);
  };

  return (
    <FormModal
      key={`${mode}-${deal?.id ?? "new"}-${open}`}
      open={open}
      wide
      title={mode === "edit" ? "Edit deal" : "New deal"}
      description="A deal must be linked to a lead or a contact."
      submitLabel={mode === "edit" ? "Save changes" : "Create deal"}
      onClose={onClose}
      onSubmit={submit}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Linked lead">
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
        <Field label="Linked contact">
          <Select name="contact_id" defaultValue={raw.contact_id ?? ""}>
            <option value="">None</option>
            {contactRows.map((c) => (
              <option key={c.id} value={c.id}>
                {personLabel(c)}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Amount (₹)" required>
          <Input type="number" min="0" step="1" name="amount" required defaultValue={raw.amount ?? ""} />
        </Field>
        <Field label="Stage">
          <Select name="stage" defaultValue={raw.stage ?? "QUALIFIED"}>
            {STAGES.map((s) => (
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
        <Field label="Description" className="sm:col-span-2">
          <Textarea name="description" defaultValue={raw.description ?? ""} />
        </Field>
      </div>
    </FormModal>
  );
}

function InlineLeadInfo({ deal, lead }) {
  const raw = lead ?? deal.raw;
  const fields = [
    { label: "Email", value: raw?.email || "—", icon: Mail },
    { label: "Phone", value: raw?.phone || "—", icon: Phone },
    { label: "Company", value: raw?.company || "—", icon: Building2 },
    { label: "Amount", value: currency(raw?.amount ?? deal.value), icon: Building2 },
    { label: "Source", value: raw?.source || "Direct", icon: Globe },
    { label: "Assigned to", value: raw?.assigned_user || deal.owner || "Unassigned", icon: User2 },
    { label: "Stage", value: titleCase(raw?.status) || deal.stage, icon: CalendarCheck2 }
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
      {raw?.notes ? <p className="mt-4 border-t border-border pt-3 text-sm text-muted-foreground">{raw.notes}</p> : null}
    </div>
  );
}

export default function Deals() {
  const { data: deals, loading } = useDeals();
  const { data: leads } = useLeads();
  const lookups = useLookups();
  const [form, setForm] = useState(null);
  const [remove, setRemove] = useState(null);
  const [convert, setConvert] = useState(null);
  const [expandedDeal, setExpandedDeal] = useState(null);
  const [pill, setPill] = useState(pills[0]);
  const [query, setQuery] = useState("");

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return deals.filter((d) => {
      const matchQ = !q || [d.title, d.customer, d.owner].join(" ").toLowerCase().includes(q);
      const matchPill =
        pill === "All deals" ||
        (pill === "Deal done" && d.stage === "Deal done") ||
        (pill === "Lost" && d.stage === "Lost") ||
        (pill === "Open" && d.stage !== "Deal done" && d.stage !== "Lost");
      return matchQ && matchPill;
    });
  }, [deals, query, pill]);

  const sel = useSelection(rows.map((d) => d.raw.id));
  const assignable = (lookups.users ?? []).filter((u) =>
    ["SALES_PERSON", "SALES_MANAGER", "ADMIN"].includes(String(u.role).toUpperCase())
  );
  const bulkAssign = async (userId) => {
    for (const id of sel.selected) await crud.deals.update(id, { assigned_to: userId });
  };

  const open = deals.filter((d) => d.stage !== "Deal done" && d.stage !== "Lost");
  const total = open.reduce((s, d) => s + d.value, 0);
  const weighted = open.reduce((s, d) => s + (d.value * d.probability) / 100, 0);
  const won = deals.filter((d) => d.stage === "Deal done");

  return (
    <AppShell
      title="Develop deals"
      subtitle={`Step 3 · ${open.length} opportunities in play`}
      actions={
        <>
          <GhostButton onClick={() => setPill("Deal done")}>Deal done</GhostButton>
          <button
            onClick={() => setForm({ mode: "create" })}
            className="brand-surface inline-flex h-10 items-center gap-2 rounded-xl px-4 text-sm font-semibold text-primary-foreground"
          >
            <Plus className="size-4" /> New deal
          </button>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Open deal value" value={currency(total)} hint={`${open.length} active deals`} />
        <StatCard
          label="Weighted forecast"
          value={currency(Math.round(weighted))}
          hint="probability adjusted"
        />
        <StatCard
          label="Avg deal size"
          value={currency(open.length ? Math.round(total / open.length) : 0)}
          hint="open deals"
        />
        <StatCard
          label="Closed deal done"
          value={currency(won.reduce((s, d) => s + d.value, 0))}
          hint={`${won.length} deals completed`}
        />
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <FilterPills options={pills} value={pill} onChange={setPill} />
        <SearchField
          value={query}
          onChange={setQuery}
          placeholder="Search deals…"
          className="ml-auto w-full sm:w-72"
        />
      </div>

      <BulkBar
        count={sel.selected.length}
        users={assignable}
        noun="deal"
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
            <Th>Deal</Th>
            <Th>Stage</Th>
            <Th className="text-right">Value</Th>
            <Th>Probability</Th>
            <Th>Expected close</Th>
            <Th>Assigned to</Th>
            <Th />
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <EmptyRow colSpan={8} message={loading ? "Loading deals…" : "No deals match this view"} />
          ) : (
            rows.map((d) => (
              <>
              <tr
                key={d.id}
                tabIndex={0}
                onClick={() => setExpandedDeal((current) => (current === d.id ? null : d.id))}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    setExpandedDeal((current) => (current === d.id ? null : d.id));
                  }
                }}
                className="cursor-pointer transition-colors hover:bg-muted/50"
              >
                <SelectTd
                  checked={sel.isSelected(d.raw.id)}
                  onChange={() => sel.toggle(d.raw.id)}
                />
                <Td>
                  <p className="font-semibold">{d.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {d.id} · {d.customer}
                  </p>
                </Td>
                <Td>
                  <div className="flex flex-wrap items-center gap-2">
                    <Chip tone={stageTone(d.stage)} dot>
                      {d.stage}
                    </Chip>
                  </div>
                </Td>
                <Td className="numeric text-right font-bold">{currency(d.value)}</Td>
                <Td>
                  <Chip
                    tone={leadTemperatureTone(leadTemperature({ status: d.raw?.stage ?? d.stage }))}
                    dot
                  >
                    {leadTemperature({ status: d.raw?.stage ?? d.stage })}
                  </Chip>
                </Td>
                <Td className="numeric text-sm">{d.close}</Td>
                <Td className="text-sm">{d.owner}</Td>
                <Td className="text-right">
                  <div onClick={(event) => event.stopPropagation()}>
                    <RowMenu
                      items={[
                        { label: "Edit deal", onSelect: () => setForm({ mode: "edit", deal: d }) },
                        d.stage === "Deal done"
                          ? { label: "Convert to customer", onSelect: () => setConvert(d) }
                          : null,
                        { label: "Delete deal", danger: true, onSelect: () => setRemove(d) }
                      ]}
                    />
                  </div>
                </Td>
              </tr>
              {expandedDeal === d.id ? (
                <tr key={`${d.id}-lead-info`}>
                  <td colSpan={8} className="p-0">
                    {d.raw?.lead_id ? (
                      <InlineLeadInfo
                        deal={d}
                        lead={leads.find((lead) => String(lead.id) === String(d.raw.lead_id))}
                      />
                    ) : (
                      <div className="border-t border-border bg-muted/30 px-5 py-5 text-sm text-muted-foreground">
                        This deal is linked to a contact, not a lead.
                      </div>
                    )}
                  </td>
                </tr>
              ) : null}
              </>
            ))
          )}
        </tbody>
      </TableShell>

      <DealForm
        open={Boolean(form)}
        mode={form?.mode}
        deal={form?.deal}
        lookups={lookups}
        onClose={() => setForm(null)}
      />
      <ConfirmModal
        open={Boolean(remove)}
        title="Delete deal"
        message={remove ? `Delete “${remove.title}”? This cannot be undone.` : ""}
        onClose={() => setRemove(null)}
        onConfirm={() => crud.deals.remove(remove.raw.id)}
      />
      <ConfirmModal
        open={Boolean(convert)}
        title="Convert to customer"
        confirmLabel="Convert"
        message={
          convert
            ? `Create a customer account from “${convert.title}”. Won deals only.`
            : ""
        }
        onClose={() => setConvert(null)}
        onConfirm={() => crud.customers.convert(convert.raw.id)}
      />
    </AppShell>
  );
}
