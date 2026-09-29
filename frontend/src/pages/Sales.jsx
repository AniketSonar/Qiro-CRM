import { useEffect, useMemo, useState } from "react";
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

const PAY_STATUS = ["UNPAID", "PARTIAL", "PAID", "REFUNDED"];
const PAY_METHOD = ["CASH", "CARD", "UPI", "BANK_TRANSFER", "CHEQUE", "OTHER"];
const pills = ["All", "Unpaid", "Partial", "Paid", "Refunded"];

const csvEscape = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;

export function SaleForm({ open, mode, sale, lookups, onClose }) {
  const raw = sale?.raw ?? {};
  const { customerRows, dealRows, users } = lookups;

  const [saleAmount, setSaleAmount] = useState(raw.sale_amount ?? "");
  const [discount, setDiscount] = useState(raw.discount ?? "");
  const [amountPaid, setAmountPaid] = useState(raw.amount_paid ?? 0);
  const [gstMode, setGstMode] = useState(raw.gst_mode || "EXCLUSIVE");
  const [gstRate, setGstRate] = useState(raw.gst_rate ?? 18);

  useEffect(() => {
    setSaleAmount(raw.sale_amount ?? "");
    setDiscount(raw.discount ?? "");
    setAmountPaid(raw.amount_paid ?? 0);
    setGstMode(raw.gst_mode || "EXCLUSIVE");
    setGstRate(raw.gst_rate ?? 18);
  }, [raw.id, raw.sale_amount, raw.discount, raw.amount_paid, raw.gst_mode, raw.gst_rate]);

  // Live GST preview — mirrors the backend's computeGstBreakdown logic so
  // the user sees the same numbers that will be saved.
  const preview = useMemo(() => {
    const amt = Number(saleAmount) || 0;
    const disc = Math.max(0, Number(discount) || 0);
    const rate = Number(gstRate) || 0;
    const preTax = Math.max(0, amt - disc);

    let taxable = preTax;
    let taxAmt = 0;
    let grand = preTax;

    if (gstMode === "NONE") {
      taxable = preTax;
      taxAmt = 0;
      grand = preTax;
    } else if (gstMode === "INCLUSIVE") {
      grand = preTax;
      taxable = rate > 0 ? grand / (1 + rate / 100) : grand;
      taxAmt = grand - taxable;
      grand = Math.round(grand);
    } else {
      taxable = preTax;
      taxAmt = (preTax * rate) / 100;
      grand = Math.round(taxable + taxAmt);
    }

    return {
      cgst: taxAmt / 2,
      sgst: taxAmt / 2,
      grand
    };
  }, [saleAmount, discount, gstMode, gstRate]);

  const submit = async (fd) => {
    const body = formValues(fd);
    ["customer_id", "deal_id", "assigned_to"].forEach((k) => {
      if (body[k]) body[k] = Number(body[k]);
    });
    ["sale_amount", "discount", "gst_rate", "amount_paid"].forEach((k) => {
      if (body[k]) body[k] = Number(body[k]);
    });
    body.gst_mode = gstMode;
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
            value={saleAmount}
            onChange={(e) => setSaleAmount(e.target.value)}
          />
        </Field>
        <Field label="Discount (₹)">
          <Input
            type="number"
            min="0"
            name="discount"
            value={discount}
            onChange={(e) => setDiscount(e.target.value)}
          />
        </Field>
        <Field label="GST">
          <Select name="gst_mode_display" value={gstMode} onChange={(e) => setGstMode(e.target.value)}>
            <option value="NONE">No GST</option>
            <option value="EXCLUSIVE">GST Exclusive</option>
            <option value="INCLUSIVE">GST Inclusive</option>
          </Select>
        </Field>
        {gstMode !== "NONE" && (
          <Field label="GST Rate (%)">
            <Input
              type="number"
              min="0"
              max="28"
              name="gst_rate"
              value={gstRate}
              onChange={(e) => setGstRate(e.target.value)}
            />
          </Field>
        )}
        {gstMode !== "NONE" ? (
          <div className="sm:col-span-2 rounded-lg border border-border bg-muted/10 p-3 text-xs space-y-1">
            <div className="flex justify-between text-muted-foreground">
              <span>CGST @{Number(gstRate) / 2 || 0}%:</span>
              <span>{currency(preview.cgst)}</span>
            </div>
            <div className="flex justify-between text-muted-foreground">
              <span>SGST @{Number(gstRate) / 2 || 0}%:</span>
              <span>{currency(preview.sgst)}</span>
            </div>
            <div className="flex justify-between font-semibold text-foreground border-t border-border pt-1">
              <span>Final amount:</span>
              <span>{currency(preview.grand)}</span>
            </div>
          </div>
        ) : (
          <div className="sm:col-span-2 rounded-lg border border-border bg-muted/10 p-3 text-xs">
            <div className="flex justify-between font-semibold text-foreground">
              <span>Final amount (no GST):</span>
              <span>{currency(preview.grand)}</span>
            </div>
          </div>
        )}
        <Field label="Sale date">
          <Input type="date" name="sale_date" defaultValue={toDateInput(raw.sale_date) || toDateInput(new Date().toISOString())} />
        </Field>
        <Field label="Payment status">
          <Select name="payment_status" defaultValue={raw.payment_status === "PENDING" ? "UNPAID" : raw.payment_status ?? "UNPAID"}>
            {PAY_STATUS.map((s) => (
              <option key={s} value={s}>
                {s.charAt(0) + s.slice(1).toLowerCase()}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Amount paid (₹)">
          <Input
            type="number"
            min="0"
            step="0.01"
            name="amount_paid"
            value={amountPaid}
            onChange={(e) => setAmountPaid(e.target.value)}
          />
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
  const outstanding = salesRows.reduce((s, r) => s + r.balanceDue, 0);

  const exportCsv = () => {
    const header = ["Invoice", "Customer", "Amount", "Paid", "Due", "Date", "Assigned to", "Status"];
    const body = rows.map((r) =>
      [r.id, r.customer, r.amount, r.amountPaid, r.balanceDue, r.date, r.owner, r.status].map(csvEscape).join(",")
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
          hint={`${salesRows.filter((r) => r.balanceDue > 0).length} with balance`}
        />
        <StatCard
          label="Collected"
          value={currency(salesRows.reduce((s, r) => s + r.amountPaid, 0))}
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
            <Th className="text-right">Paid / Due</Th>
            <Th>Date</Th>
            <Th>Assigned to</Th>
            <Th>Status</Th>
            <Th />
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <EmptyRow colSpan={8} message={loading ? "Loading sales…" : "No invoices in this view"} />
          ) : (
            rows.map((r) => (
              <tr key={r.id} className="transition-colors hover:bg-muted/50">
                <Td className="numeric font-semibold">{r.id}</Td>
                <Td>{r.customer}</Td>
                <Td className="numeric text-right font-bold">{currency(r.amount)}</Td>
                <Td className="numeric text-right text-xs">
                  <span className="text-emerald-600">{currency(r.amountPaid)}</span>
                  <span className="text-muted-foreground"> / {currency(r.balanceDue)}</span>
                </Td>
                <Td className="numeric text-sm text-muted-foreground">{r.date}</Td>
                <Td className="text-sm">{r.owner}</Td>
                <Td>
                  <Select
                    className="h-8 w-[130px] text-xs font-semibold"
                    value={
                      r.raw?.payment_status === "PENDING"
                        ? "UNPAID"
                        : r.raw?.payment_status === "CANCELLED"
                          ? "REFUNDED"
                          : String(r.raw?.payment_status ?? "UNPAID").toUpperCase()
                    }
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
                      ...(r.balanceDue > 0
                        ? [
                            {
                              label: "Download Balance Invoice",
                              onSelect: () => downloadInvoicePdf(r, null, { balanceOnly: true })
                            },
                            {
                              label: "Share Balance Invoice",
                              onSelect: () => shareInvoicePdf(r, null, { balanceOnly: true })
                            }
                          ]
                        : []),
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
