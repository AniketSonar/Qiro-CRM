import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Filter, Download, Plus, Share2 } from "lucide-react";
import { AppShell, GhostButton, TableShell, Td, Th } from "../components/crm/AppShell";
import { MetaAdsModal } from "../components/crm/MetaAdsModal";
import {
  Avatar,
  Chip,
  initialsOf,
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
  formValues
} from "../components/crm/form";
import { currency } from "../lib/crm-data";
import { BulkBar, SelectTd, SelectTh, useSelection } from "../components/crm/bulk";
import { crud, useLeads, useLookups } from "../lib/crm-store";
import { useAuth } from "../lib/auth";

const STATUSES = [
  "NEW",
  "CONTACTED",
  "QUALIFIED",
  "PROPOSAL",
  "NEGOTIATION",
  "CONVERTED",
  "LOST"
];

const filters = ["All leads", "Unassigned", "New", "Qualified", "Deal done", "Lost"];

const csvEscape = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;

export function LeadForm({ open, mode, lead, users, sources, defaultStatus, currentUser, onClose }) {
  const raw = lead?.raw ?? {};
  const initialStatus = raw.status ?? defaultStatus ?? "NEW";
  const initialOwner =
    raw.assigned_to ??
    (mode === "create" && String(currentUser?.role).toUpperCase() === "SALES_PERSON"
      ? currentUser.id
      : "");

  const submit = async (fd) => {
    const body = formValues(fd);
    if (body.amount) body.amount = Number(body.amount);
    if (body.source_id) body.source_id = Number(body.source_id);
    if (body.assigned_to) body.assigned_to = Number(body.assigned_to);
    if (mode === "edit") await crud.leads.update(lead.id, body);
    else await crud.leads.create(body);
  };

  return (
    <FormModal
      key={`${mode}-${lead?.id ?? "new"}-${open}`}
      open={open}
      wide
      title={mode === "edit" ? "Edit lead" : "New lead"}
      description="Capture the person, their company and who owns the follow-up."
      submitLabel={mode === "edit" ? "Save changes" : "Create lead"}
      onClose={onClose}
      onSubmit={submit}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="First name" required>
          <Input name="first_name" defaultValue={raw.first_name ?? ""} required autoFocus />
        </Field>
        <Field label="Last name">
          <Input name="last_name" defaultValue={raw.last_name ?? ""} />
        </Field>
        <Field label="Email">
          <Input type="email" name="email" defaultValue={raw.email ?? ""} />
        </Field>
        <Field label="Phone">
          <Input name="phone" defaultValue={raw.phone ?? ""} />
        </Field>
        <Field label="WhatsApp">
          <Input name="whatsapp" defaultValue={raw.whatsapp ?? ""} />
        </Field>
        <Field label="Company">
          <Input name="company" defaultValue={raw.company ?? ""} />
        </Field>
        <Field label="Amount (₹)" hint="Expected opportunity value">
          <Input
            name="amount"
            type="number"
            min="0"
            step="0.01"
            defaultValue={raw.amount ?? ""}
            placeholder="0"
          />
        </Field>
        <Field label="Website">
          <Input name="website" defaultValue={raw.website ?? ""} />
        </Field>
        <Field label="Source">
          <Select name="source_id" defaultValue={raw.source_id ?? ""}>
            <option value="">Not set</option>
            {sources.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name ?? s.source_name ?? `Source ${s.id}`}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Status">
          <Select name="status" defaultValue={initialStatus}>
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {s.replace(/_/g, " ")}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Assign to" hint="Sales manager or sales person">
          <Select name="assigned_to" defaultValue={initialOwner}>
            <option value="">Unassigned</option>
            {users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name} · {u.role}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Notes" className="sm:col-span-2">
          <Textarea name="notes" defaultValue={raw.notes ?? ""} placeholder="Context, budget, next step…" />
        </Field>
      </div>
    </FormModal>
  );
}

function AssignModal({ open, lead, users, onClose }) {
  return (
    <FormModal
      key={`assign-${lead?.id}-${open}`}
      open={open}
      title="Assign lead"
      description={lead ? `Reassign ${lead.name}` : ""}
      submitLabel="Assign"
      onClose={onClose}
      onSubmit={async (fd) => {
        const id = fd.get("assigned_to");
        if (!id) throw new Error("Pick a teammate");
        await crud.leads.assign(lead.id, Number(id));
      }}
    >
      <Field label="Assigned to" required>
        <Select name="assigned_to" defaultValue={lead?.raw?.assigned_to ?? ""} required>
          <option value="">Select teammate</option>
          {users.map((u) => (
            <option key={u.id} value={u.id}>
              {u.name} · {u.role}
            </option>
          ))}
        </Select>
      </Field>
    </FormModal>
  );
}

export default function Leads() {
  const { data: leads, loading } = useLeads();
  const { users, sources } = useLookups();
  const { user } = useAuth();
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const [query, setQuery] = useState(params.get("q") ?? "");
  const [pill, setPill] = useState(filters[0]);
  const [form, setForm] = useState(null); // {mode, lead}
  const [assign, setAssign] = useState(null);
  const [remove, setRemove] = useState(null);
  const [metaAdsOpen, setMetaAdsOpen] = useState(false);

  useEffect(() => {
    if (params.get("new") === "1") {
      setForm({ mode: "create" });
      setParams({}, { replace: true });
    }
    const q = params.get("q");
    if (q) {
      setQuery(q);
      setParams({}, { replace: true });
    }
  }, [params, setParams]);

  const assignable = users.filter((u) =>
    ["SALES_PERSON", "SALES_MANAGER"].includes(String(u.role).toUpperCase().replace(/\s+/g, "_"))
  );

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return leads.filter((l) => {
      const matchQ =
        !q ||
        [l.name, l.company, l.email, l.phone, l.owner, l.source]
          .join(" ")
          .toLowerCase()
          .includes(q);
      const matchPill =
        pill === "All leads" ||
        (pill === "Unassigned" && l.owner === "Unassigned") ||
        (pill === "New" && l.stage === "New") ||
        (pill === "Qualified" && l.stage === "Qualified") ||
        (pill === "Deal done" && l.stage === "Deal done") ||
        (pill === "Lost" && l.stage === "Lost");
      return matchQ && matchPill;
    });
  }, [leads, query, pill]);

  const sel = useSelection(rows.map((l) => l.id));

  const bulkAssign = async (userId) => {
    for (const id of sel.selected) await crud.leads.assign(id, userId);
  };

  const exportCsv = () => {
    const header = ["Name", "Company", "Email", "Phone", "Stage", "Value", "Source", "Assigned to"];
    const body = rows.map((l) =>
      [l.name, l.company, l.email, l.phone, l.stage, l.value, l.source, l.owner].map(csvEscape).join(",")
    );
    const blob = new Blob([[header.join(","), ...body].join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "leads.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <AppShell
      title="Capture leads"
      subtitle={`${leads.length} leads · ${leads.filter((l) => l.owner === "Unassigned").length} unassigned`}
      actions={
        <>
          <GhostButton onClick={exportCsv}>
            <Download className="size-4" /> Export
          </GhostButton>
          <button
            type="button"
            onClick={() => setMetaAdsOpen(true)}
            className="inline-flex h-10 items-center gap-2 rounded-xl border border-rose-500/30 bg-rose-500/10 px-3.5 text-sm font-semibold text-rose-600 transition-colors hover:bg-rose-500/20 dark:text-rose-400"
          >
            <Share2 className="size-4" /> Meta / Instagram Ads
          </button>
          <button
            onClick={() => setForm({ mode: "create" })}
            className="brand-surface inline-flex h-10 items-center gap-2 rounded-xl px-4 text-sm font-semibold text-primary-foreground"
          >
            <Plus className="size-4" /> New lead
          </button>
        </>
      }
    >
      <div className="flex flex-wrap items-center gap-3">
        <FilterPills options={filters} value={pill} onChange={setPill} />
        <SearchField
          value={query}
          onChange={setQuery}
          placeholder="Search name, company, email…"
          className="ml-auto w-full sm:w-72"
        />
        <GhostButton onClick={() => { setQuery(""); setPill(filters[0]); }}>
          <Filter className="size-4" /> Reset
        </GhostButton>
      </div>

      <BulkBar
        count={sel.selected.length}
        users={assignable}
        noun="lead"
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
            <Th>Stage</Th>
            <Th>Probability</Th>
            <Th className="text-right">Value</Th>
            <Th>Source</Th>
            <Th>Assigned to</Th>
            <Th>Updated</Th>
            <Th />
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <EmptyRow colSpan={9} message={loading ? "Loading leads…" : "No leads match this view"} />
          ) : (
            rows.map((l) => (
              <tr
                key={l.id}
                onClick={() => navigate(`/leads/${l.id}`)}
                className="cursor-pointer transition-colors hover:bg-muted/50"
              >
                <SelectTd checked={sel.isSelected(l.id)} onChange={() => sel.toggle(l.id)} />
                <Td>
                  <div className="flex items-center gap-3">
                    <Avatar initials={initialsOf(l.name)} />
                    <div>
                      <p className="font-semibold text-primary hover:underline">{l.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {l.company} · {l.city}
                      </p>
                    </div>
                  </div>
                </Td>
                <Td>
                  <Chip tone={stageTone(l.stage)} dot>
                    {l.stage}
                  </Chip>
                </Td>
                <Td>
                  <Chip tone={leadTemperatureTone(leadTemperature(l))} dot>
                    {leadTemperature(l)}
                  </Chip>
                </Td>
                <Td className="numeric text-right font-bold">{currency(l.value)}</Td>
                <Td>
                  {/instagram|meta/i.test(l.source) ? (
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-rose-500/10 px-2.5 py-0.5 text-xs font-semibold text-rose-600 dark:text-rose-400 border border-rose-500/20">
                      <span className="size-1.5 rounded-full bg-rose-500" />
                      {l.source}
                    </span>
                  ) : (
                    <span className="text-muted-foreground">{l.source}</span>
                  )}
                </Td>
                <Td onClick={(e) => e.stopPropagation()}>
                  {l.owner === "Unassigned" ? (
                    <button onClick={() => setAssign(l)}>
                      <Chip tone="warning">Unassigned</Chip>
                    </button>
                  ) : (
                    <span className="text-sm">{l.owner}</span>
                  )}
                </Td>
                <Td className="text-xs text-muted-foreground">{l.updated}</Td>
                <Td className="text-right" onClick={(e) => e.stopPropagation()}>
                  <RowMenu
                    items={[
                      { label: "Open lead", onSelect: () => navigate(`/leads/${l.id}`) },
                      { label: "Edit lead", onSelect: () => setForm({ mode: "edit", lead: l }) },
                      { label: "Change assignment", onSelect: () => setAssign(l) },
                      { label: "Delete lead", danger: true, onSelect: () => setRemove(l) }
                    ]}
                  />
                </Td>
              </tr>
            ))
          )}
        </tbody>
      </TableShell>

      <LeadForm
        open={Boolean(form)}
        mode={form?.mode}
        lead={form?.lead}
        users={assignable}
        sources={sources}
        currentUser={user}
        onClose={() => setForm(null)}
      />
      <AssignModal
        open={Boolean(assign)}
        lead={assign}
        users={assignable}
        onClose={() => setAssign(null)}
      />
      <ConfirmModal
        open={Boolean(remove)}
        title="Delete lead"
        message={remove ? `${remove.name} and their history will be removed. This cannot be undone.` : ""}
        onClose={() => setRemove(null)}
        onConfirm={() => crud.leads.remove(remove.id)}
      />
      <MetaAdsModal
        open={metaAdsOpen}
        onClose={() => setMetaAdsOpen(false)}
      />
    </AppShell>
  );
}
