import { useMemo, useState } from "react";
import { Building2, Globe, Mail, Phone, Plus, User2 } from "lucide-react";
import { AppShell, GhostButton, TableShell, Td, Th } from "../components/crm/AppShell";
import { StatCard } from "../components/crm/ui-bits";
import {
  EmptyRow,
  Field,
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
import { crud, useCustomers, useLookups } from "../lib/crm-store";

const STATUSES = ["ACTIVE", "INACTIVE"];
const TYPES = ["INDIVIDUAL", "BUSINESS"];

function ConvertForm({ open, wonDeals, onClose }) {
  return (
    <FormModal
      key={`convert-${open}`}
      open={open}
      title="Add customer"
      description="Customers are created by converting a won deal."
      submitLabel="Convert deal"
      onClose={onClose}
      onSubmit={async (fd) => {
        const dealId = fd.get("deal_id");
        if (!dealId) throw new Error("Pick a won deal to convert");
        const body = formValues(fd);
        delete body.deal_id;
        await crud.customers.convert(Number(dealId), body);
      }}
    >
      <div className="space-y-4">
        <Field label="Won deal" required>
          <Select name="deal_id" required defaultValue="">
            <option value="">Select a won deal</option>
            {wonDeals.map((d) => (
              <option key={d.id} value={d.id}>
                {d.title} · {currency(Number(d.amount ?? 0))}
              </option>
            ))}
          </Select>
        </Field>
        {wonDeals.length === 0 ? (
          <p className="rounded-xl border border-border bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
            No won deals yet. Move a deal to “Closed won” on the Deals page first.
          </p>
        ) : null}
        <Field label="Customer type">
          <Select name="customer_type" defaultValue="BUSINESS">
            {TYPES.map((t) => (
              <option key={t} value={t}>
                {t.charAt(0) + t.slice(1).toLowerCase()}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Notes">
          <Textarea name="notes" />
        </Field>
      </div>
    </FormModal>
  );
}

function CustomerForm({ open, customer, onClose }) {
  const raw = customer?.raw ?? {};
  return (
    <FormModal
      key={`cust-${customer?.id}-${open}`}
      open={open}
      title="Edit customer"
      description={customer ? customer.company : ""}
      submitLabel="Save changes"
      onClose={onClose}
      onSubmit={async (fd) => crud.customers.update(customer.id, formValues(fd))}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Customer type">
          <Select name="customer_type" defaultValue={raw.customer_type ?? "BUSINESS"}>
            {TYPES.map((t) => (
              <option key={t} value={t}>
                {t.charAt(0) + t.slice(1).toLowerCase()}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Status">
          <Select name="status" defaultValue={raw.status ?? "ACTIVE"}>
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {s.charAt(0) + s.slice(1).toLowerCase()}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Industry / segment">
          <Input name="industry" defaultValue={raw.industry ?? ""} />
        </Field>
        <Field label="Notes" className="sm:col-span-2">
          <Textarea name="notes" defaultValue={raw.notes ?? ""} />
        </Field>
      </div>
    </FormModal>
  );
}

function InlineCustomerInfo({ customer }) {
  const raw = customer.raw ?? {};
  const fields = [
    { label: "Email", value: raw.lead_email || raw.email || "—", icon: Mail },
    { label: "Phone", value: raw.lead_phone || raw.phone || "—", icon: Phone },
    { label: "Company", value: raw.company || customer.company || "—", icon: Building2 },
    { label: "Industry", value: raw.customer_type || customer.industry || "—", icon: Globe },
    { label: "Assigned to", value: raw.assigned_user || customer.owner || "Unassigned", icon: User2 },
    { label: "Customer since", value: customer.since, icon: Building2 }
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
      {raw.notes ? <p className="mt-4 border-t border-border pt-3 text-sm text-muted-foreground">{raw.notes}</p> : null}
    </div>
  );
}

export default function Customers() {
  const { data: customers, loading } = useCustomers();
  const { dealRows, users } = useLookups();
  const [convert, setConvert] = useState(false);
  const [edit, setEdit] = useState(null);
  const [expandedCustomer, setExpandedCustomer] = useState(null);
  const [query, setQuery] = useState("");

  const wonDeals = dealRows.filter((d) => d.stage === "CLOSED_WON");

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return customers;
    return customers.filter((c) =>
      [c.company, c.contact, c.industry, c.owner].join(" ").toLowerCase().includes(q)
    );
  }, [customers, query]);

  const sel = useSelection(rows.map((c) => c.id));
  const assignable = (users ?? []).filter((u) =>
    ["SALES_PERSON", "SALES_MANAGER", "ADMIN"].includes(String(u.role).toUpperCase())
  );
  const bulkAssign = async (userId) => {
    for (const id of sel.selected) await crud.customers.update(id, { assigned_to: userId });
  };

  const lifetime = customers.reduce((s, c) => s + c.lifetime, 0);

  return (
    <AppShell
      title="Convert customers"
      subtitle={`Step 4 · ${customers.length} accounts won`}
      actions={
        <>
          <GhostButton onClick={() => setQuery("")}>Clear search</GhostButton>
          <button
            onClick={() => setConvert(true)}
            className="brand-surface inline-flex h-10 items-center gap-2 rounded-xl px-4 text-sm font-semibold text-primary-foreground"
          >
            <Plus className="size-4" /> Add customer
          </button>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Active accounts" value={String(customers.length)} hint="converted deals" />
        <StatCard label="Lifetime value" value={currency(lifetime)} hint="all accounts" />
        <StatCard
          label="Avg account value"
          value={currency(customers.length ? Math.round(lifetime / customers.length) : 0)}
        />
        <StatCard label="Won deals ready" value={String(wonDeals.length)} hint="available to convert" />
      </div>

      <SearchField value={query} onChange={setQuery} placeholder="Search accounts…" className="max-w-sm" />

      <BulkBar
        count={sel.selected.length}
        users={assignable}
        noun="account"
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
            <Th>Account</Th>
            <Th>Primary contact</Th>
            <Th>Type</Th>
            <Th>Customer since</Th>
            <Th className="text-right">Lifetime value</Th>
            <Th>Assigned to</Th>
            <Th />
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <EmptyRow colSpan={8} message={loading ? "Loading customers…" : "No customers yet"} />
          ) : (
            rows.map((c) => (
              <>
              <tr
                key={c.id}
                tabIndex={0}
                onClick={() => setExpandedCustomer((current) => (current === c.id ? null : c.id))}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    setExpandedCustomer((current) => (current === c.id ? null : c.id));
                  }
                }}
                className="cursor-pointer transition-colors hover:bg-muted/50"
              >
                <SelectTd checked={sel.isSelected(c.id)} onChange={() => sel.toggle(c.id)} />
                <Td>
                  <div className="flex items-center gap-3">
                    <span className="grid size-9 place-items-center rounded-xl bg-accent text-accent-foreground">
                      <Building2 className="size-4" />
                    </span>
                    <div>
                      <p className="font-semibold">{c.company}</p>
                      <p className="text-xs text-muted-foreground">ACC-{c.id}</p>
                    </div>
                  </div>
                </Td>
                <Td className="text-sm">{c.contact}</Td>
                <Td className="text-muted-foreground">{c.industry}</Td>
                <Td className="numeric text-sm">{c.since}</Td>
                <Td className="numeric text-right font-bold">{currency(c.lifetime)}</Td>
                <Td className="text-sm">{c.owner}</Td>
                <Td className="text-right">
                  <div onClick={(event) => event.stopPropagation()}>
                    <RowMenu
                      items={[
                        { label: "Edit account", onSelect: () => setEdit(c) },
                        {
                          label: "Mark inactive",
                          onSelect: () => crud.customers.update(c.id, { status: "INACTIVE" })
                        }
                      ]}
                    />
                  </div>
                </Td>
              </tr>
              {expandedCustomer === c.id ? (
                <tr key={`${c.id}-customer-info`}>
                  <td colSpan={8} className="p-0">
                    <InlineCustomerInfo customer={c} />
                  </td>
                </tr>
              ) : null}
              </>
            ))
          )}
        </tbody>
      </TableShell>

      <ConvertForm open={convert} wonDeals={wonDeals} onClose={() => setConvert(false)} />
      <CustomerForm open={Boolean(edit)} customer={edit} onClose={() => setEdit(null)} />
    </AppShell>
  );
}
