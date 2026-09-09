import { useMemo, useState } from "react";
import { Download, Plus } from "lucide-react";
import { AppShell, GhostButton, TableShell, Td, Th } from "../components/crm/AppShell";
import { StatCard } from "../components/crm/ui-bits";
import {
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
import { crud, useLookups, useSales } from "../lib/crm-store";
import { downloadInvoicePdf, shareInvoicePdf } from "../lib/quotation";

const PAY_STATUS = ["PENDING", "PARTIAL", "PAID", "CANCELLED"];
const PAY_METHOD = ["CASH", "CARD", "UPI", "BANK_TRANSFER", "CHEQUE"];
const pills = ["All", "Pending", "Partial", "Paid", "Cancelled"];

const csvEscape = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;

function SaleForm({ open, mode, sale, lookups, onClose }) {
  const raw = sale?.raw ?? {};
  const { customerRows, dealRows, users } = lookups;

  const submit = async (fd) => {
    const body = formValues(fd);
    ["customer_id", "deal_id", "assigned_to"].forEach((k) => {
      if (body[k]) body[k] = Number(body[k]);
    });
    ["sale_amount", "discount", "tax"].forEach((k) => {
      if (body[k]) body[k] = Number(body[k]);
    });
    if (mode === "edit") await crud.sales.update(raw.id ?? sale.id, body);
    else {
      if (!body.customer_id) throw new Error("Pick the customer this sale belongs to");
      await crud.sales.create(body);
    }
  };

  return (
    <FormModal
      key={`${mode}-${sale?.id ?? "new"}-${open}`}
      open={open}
      wide
      title={mode === "edit" ? "Edit sale" : "Record sale"}
      description="Invoices are raised against a converted customer."
      submitLabel={mode === "edit" ? "Save changes" : "Record sale"}
      onClose={onClose}
      onSubmit={submit}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        {mode === "edit" ? null : (
          <>
            <Field label="Customer" required>
              <Select name="customer_id" required defaultValue="">
                <option value="">Select customer</option>
                {customerRows.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.customer_code ?? `Customer ${c.id}`}
                    {c.deal_title ? ` · ${c.deal_title}` : ""}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Deal">
              <Select name="deal_id" defaultValue="">
                <option value="">None</option>
                {dealRows.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.title}
                  </option>
                ))}
              </Select>
            </Field>
          </>
        )}
        <Field label="Product / service" required className="sm:col-span-2">
          <Input name="product_service" defaultValue={raw.product_service ?? ""} required />
        </Field>
        <Field label="Sale amount (₹)" required>
          <Input
            type="number"
            min="0"
            name="sale_amount"
            required
            defaultValue={raw.sale_amount ?? ""}
          />
        </Field>
        <Field label="Discount (₹)">
          <Input type="number" min="0" name="discount" defaultValue={raw.discount ?? ""} />
        </Field>
        <Field label="Tax (₹)">
          <Input type="number" min="0" name="tax" defaultValue={raw.tax ?? ""} />
        </Field>
        <Field label="Sale date">
          <Input type="date" name="sale_date" defaultValue={toDateInput(raw.sale_date) || toDateInput(new Date().toISOString())} />
        </Field>
        <Field label="Payment status">
          <Select name="payment_status" defaultValue={raw.payment_status ?? "PENDING"}>
            {PAY_STATUS.map((s) => (
              <option key={s} value={s}>
                {s.charAt(0) + s.slice(1).toLowerCase()}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Payment method">
          <Select name="payment_method" defaultValue={raw.payment_method ?? "UPI"}>
            {PAY_METHOD.map((m) => (
              <option key={m} value={m}>
                {m.replace(/_/g, " ")}
              </option>
            ))}
          </Select>
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
          <Textarea name="notes" defaultValue={raw.notes ?? ""} />
        </Field>
      </div>
    </FormModal>
  );
}

export default function Sales() {
  const { data: salesRows, loading } = useSales();
  const lookups = useLookups();
  const [form, setForm] = useState(null);
  const [pill, setPill] = useState(pills[0]);
  const [query, setQuery] = useState("");

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return salesRows.filter((r) => {
      const matchQ = !q || [r.id, r.customer, r.owner].join(" ").toLowerCase().includes(q);
      return matchQ && (pill === "All" || r.status === pill);
    });
  }, [salesRows, query, pill]);

  const booked = salesRows.reduce((s, r) => s + r.amount, 0);
  const outstanding = salesRows.filter((r) => r.status !== "Paid").reduce((s, r) => s + r.amount, 0);

  const exportCsv = () => {
    const header = ["Invoice", "Customer", "Amount", "Date", "Assigned to", "Status"];
    const body = rows.map((r) =>
      [r.id, r.customer, r.amount, r.date, r.owner, r.status].map(csvEscape).join(",")
    );
    const blob = new Blob([[header.join(","), ...body].join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "sales.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <AppShell
      title="Sales"
      subtitle={`${salesRows.length} invoices · collection status`}
      actions={
        <>
          <GhostButton onClick={exportCsv}>
            <Download className="size-4" /> Statement
          </GhostButton>
          <button
            onClick={() => setForm({ mode: "create" })}
            className="brand-surface inline-flex h-10 items-center gap-2 rounded-xl px-4 text-sm font-semibold text-primary-foreground"
          >
            <Plus className="size-4" /> Record sale
          </button>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Booked" value={currency(booked)} hint={`${salesRows.length} invoices`} />
        <StatCard
          label="Outstanding"
          value={currency(outstanding)}
          hint={`${salesRows.filter((r) => r.status !== "Paid").length} unpaid`}
        />
        <StatCard
          label="Collected"
          value={currency(booked - outstanding)}
          hint={`${salesRows.filter((r) => r.status === "Paid").length} paid`}
        />
        <StatCard
          label="Avg invoice"
          value={currency(salesRows.length ? Math.round(booked / salesRows.length) : 0)}
        />
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <FilterPills options={pills} value={pill} onChange={setPill} />
        <SearchField
          value={query}
          onChange={setQuery}
          placeholder="Search invoices…"
          className="ml-auto w-full sm:w-72"
        />
      </div>

      <TableShell>
        <thead>
          <tr>
            <Th>Invoice</Th>
            <Th>Customer</Th>
            <Th className="text-right">Amount</Th>
            <Th>Date</Th>
            <Th>Assigned to</Th>
            <Th>Status</Th>
            <Th />
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <EmptyRow colSpan={7} message={loading ? "Loading sales…" : "No invoices in this view"} />
          ) : (
            rows.map((r) => (
              <tr key={r.id} className="transition-colors hover:bg-muted/50">
                <Td className="numeric font-semibold">{r.id}</Td>
                <Td>{r.customer}</Td>
                <Td className="numeric text-right font-bold">{currency(r.amount)}</Td>
                <Td className="numeric text-sm text-muted-foreground">{r.date}</Td>
                <Td className="text-sm">{r.owner}</Td>
                <Td>
                  <Select
                    className="h-8 w-[130px] text-xs font-semibold"
                    value={String(r.raw?.payment_status ?? "PENDING").toUpperCase()}
                    onChange={(e) =>
                      crud.sales.update(r.raw.id, { payment_status: e.target.value })
                    }
                  >
                    {PAY_STATUS.map((s) => (
                      <option key={s} value={s}>
                        {s.charAt(0) + s.slice(1).toLowerCase()}
                      </option>
                    ))}
                  </Select>
                </Td>
                <Td className="text-right">
                  <RowMenu
                    items={[
                      {
                        label: "Download Invoice PDF",
                        onSelect: () => downloadInvoicePdf(r)
                      },
                      {
                        label: "Share Invoice",
                        onSelect: () => shareInvoicePdf(r)
                      },
                      { label: "Edit sale", onSelect: () => setForm({ mode: "edit", sale: r }) },
                      {
                        label: "Mark paid",
                        onSelect: () => crud.sales.update(r.raw.id, { payment_status: "PAID" })
                      }
                    ]}
                  />
                </Td>
              </tr>
            ))
          )}
        </tbody>
      </TableShell>

      <SaleForm
        open={Boolean(form)}
        mode={form?.mode}
        sale={form?.sale}
        lookups={lookups}
        onClose={() => setForm(null)}
      />
    </AppShell>
  );
}
