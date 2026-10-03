import { useMemo, useState } from "react";
import { Download, FileCheck, FileText, Share2, Trash2, Wallet } from "lucide-react";
import { AppShell, GhostButton, TableShell, Td, Th } from "../components/crm/AppShell";
import { Chip, StatCard } from "../components/crm/ui-bits";
import {
  EmptyRow,
  Field,
  FilterPills,
  FormModal,
  Input,
  SearchField,
  Select,
  toDateInput
} from "../components/crm/form";
import { currency } from "../lib/crm-data";
import { crud, useQuotations, useSales } from "../lib/crm-store";
import { buildDynamicQuotationPdf, downloadInvoicePdf, shareInvoicePdf } from "../lib/quotation";
import { downloadProformaPdf } from "../lib/proforma";
import ProformaModal from "../components/crm/ProformaModal";

const PAY_METHOD = ["CASH", "CARD", "UPI", "BANK_TRANSFER", "CHEQUE", "OTHER"];
const pills = ["All", "Unpaid", "Partially paid", "Fully paid"];

const statusOf = (raw) => {
  const s = String(raw?.payment_status ?? "UNPAID").toUpperCase();
  if (s === "PAID") return "Fully paid";
  if (s === "PARTIAL") return "Partially paid";
  if (s === "REFUNDED" || s === "CANCELLED") return "Refunded";
  return "Unpaid";
};

const statusTone = { "Fully paid": "success", "Partially paid": "warning", Unpaid: "muted", Refunded: "muted" };

const csvEscape = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
const fmtDate = (iso) =>
  iso ? new Date(iso).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "—";
const clientOf = (q) =>
  q.customer_name ||
  q.client_details?.name ||
  [q.lead_first_name, q.lead_last_name].filter(Boolean).join(" ") ||
  q.lead_company ||
  "Customer";

/* ---------- create invoice from an accepted quotation ---------- */

function CreateInvoiceModal({ quotation, onClose, onDone }) {
  const total = Number(quotation?.total_amount || 0);
  const [status, setStatus] = useState("UNPAID");
  const [paid, setPaid] = useState("");

  const paidNum = status === "PAID" ? total : status === "UNPAID" ? 0 : Number(paid) || 0;
  const remaining = Math.max(total - paidNum, 0);

  const submit = async (fd) => {
    if (status === "PARTIAL" && (paidNum <= 0 || paidNum >= total)) {
      throw new Error("For a partial payment enter an amount above 0 and below the total");
    }
    await crud.sales.convertQuotation(quotation.id, {
      payment_status: status,
      amount_paid: paidNum,
      payment_method: fd.get("payment_method") || undefined,
      sale_date: fd.get("sale_date") || undefined
    });
    onDone(`Invoice created from quotation #${quotation.quotation_number}. The quotation has been removed.`);
  };

  return (
    <FormModal
      key={quotation?.id ?? "none"}
      open={Boolean(quotation)}
      title="Create invoice"
      description={quotation ? `From accepted quotation #${quotation.quotation_number}. The quotation is deleted once the invoice is made.` : ""}
      submitLabel="Create invoice"
      onClose={onClose}
      onSubmit={submit}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Payment received">
          <Select value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="UNPAID">Nothing yet (unpaid)</option>
            <option value="PARTIAL">Partially paid</option>
            <option value="PAID">Fully paid</option>
          </Select>
        </Field>
        {status === "PARTIAL" ? (
          <Field label="Amount paid (₹)" required>
            <Input type="number" min="1" step="0.01" value={paid} onChange={(e) => setPaid(e.target.value)} required />
          </Field>
        ) : <div />}
        <Field label="Payment method">
          <Select name="payment_method" defaultValue="UPI">
            {PAY_METHOD.map((m) => <option key={m} value={m}>{m.replace(/_/g, " ")}</option>)}
          </Select>
        </Field>
        <Field label="Invoice date">
          <Input type="date" name="sale_date" defaultValue={toDateInput(new Date().toISOString())} />
        </Field>
        <div className="rounded-lg border border-border bg-muted/10 p-3 text-xs sm:col-span-2 space-y-1">
          <div className="flex justify-between text-muted-foreground"><span>Invoice total (as quoted):</span><span>{currency(total)}</span></div>
          <div className="flex justify-between text-emerald-600"><span>Paid:</span><span>{currency(paidNum)}</span></div>
          <div className="flex justify-between border-t border-border pt-1 font-semibold text-foreground"><span>Remaining:</span><span>{currency(remaining)}</span></div>
        </div>
      </div>
    </FormModal>
  );
}

/* ---------- record a payment against an invoice ---------- */

function PaymentModal({ invoice, onClose, onDone }) {
  const total = Number(invoice?.amount || 0);
  const alreadyPaid = Number(invoice?.amountPaid || 0);
  const due = Math.max(total - alreadyPaid, 0);
  const [amount, setAmount] = useState(due ? String(due) : "");

  const nowPaid = Number(amount) || 0;
  const newPaid = Math.min(alreadyPaid + nowPaid, total);
  const remaining = Math.max(total - newPaid, 0);

  const submit = async (fd) => {
    if (nowPaid <= 0) throw new Error("Enter the amount received");
    if (alreadyPaid + nowPaid > total + 0.005) throw new Error(`Amount exceeds the remaining balance of ${currency(due)}`);
    await crud.sales.update(invoice.raw.id, {
      payment_status: remaining <= 0 ? "PAID" : "PARTIAL",
      amount_paid: newPaid,
      payment_method: fd.get("payment_method") || undefined
    });
    onDone(remaining <= 0 ? `Invoice ${invoice.id} is now fully paid.` : `Payment recorded. ${currency(remaining)} still remaining on ${invoice.id}.`);
  };

  return (
    <FormModal
      key={invoice?.raw?.id ?? "none"}
      open={Boolean(invoice)}
      title="Record payment"
      description={invoice ? `${invoice.id} · ${invoice.customer}` : ""}
      submitLabel="Save payment"
      onClose={onClose}
      onSubmit={submit}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Amount received now (₹)" required>
          <Input type="number" min="0.01" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} required />
        </Field>
        <Field label="Payment method">
          <Select name="payment_method" defaultValue={invoice?.raw?.payment_method ?? "UPI"}>
            {PAY_METHOD.map((m) => <option key={m} value={m}>{m.replace(/_/g, " ")}</option>)}
          </Select>
        </Field>
        <div className="rounded-lg border border-border bg-muted/10 p-3 text-xs sm:col-span-2 space-y-1">
          <div className="flex justify-between text-muted-foreground"><span>Invoice total:</span><span>{currency(total)}</span></div>
          <div className="flex justify-between text-muted-foreground"><span>Paid so far:</span><span>{currency(alreadyPaid)}</span></div>
          <div className="flex justify-between text-emerald-600"><span>After this payment, paid:</span><span>{currency(newPaid)}</span></div>
          <div className="flex justify-between border-t border-border pt-1 font-semibold text-foreground"><span>Remaining:</span><span>{currency(remaining)}</span></div>
        </div>
      </div>
    </FormModal>
  );
}

/* ---------- page ---------- */

export default function Invoices() {
  const { data: invoices, loading } = useSales();
  const { data: quotations, loading: qLoading } = useQuotations();
  const [pill, setPill] = useState(pills[0]);
  const [query, setQuery] = useState("");
  const [creating, setCreating] = useState(null);
  const [proforma, setProforma] = useState(null);
  const [paying, setPaying] = useState(null);
  const [feedback, setFeedback] = useState(null);

  const accepted = useMemo(
    () => quotations.filter((q) => String(q.status).toUpperCase() === "ACCEPTED" && !q.is_invoice),
    [quotations]
  );

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return invoices.filter((r) => {
      const matchQ = !q || [r.id, r.customer, r.company, r.owner].join(" ").toLowerCase().includes(q);
      return matchQ && (pill === "All" || statusOf(r.raw) === pill);
    });
  }, [invoices, query, pill]);

  const invoiced = invoices.reduce((s, r) => s + r.amount, 0);
  const collected = invoices.reduce((s, r) => s + r.amountPaid, 0);
  const outstanding = invoices.reduce((s, r) => s + r.balanceDue, 0);
  const awaiting = accepted.reduce((s, q) => s + Number(q.total_amount || 0), 0);

  const flash = (type, message) => setFeedback({ type, message });

  const exportCsv = () => {
    const header = ["Invoice", "Customer", "Total", "Paid", "Remaining", "Date", "Assigned to", "Status"];
    const body = rows.map((r) =>
      [r.id, r.customer, r.amount, r.amountPaid, r.balanceDue, r.date, r.owner, statusOf(r.raw)].map(csvEscape).join(",")
    );
    const blob = new Blob([[header.join(","), ...body].join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "invoices.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  const removeInvoice = async (r) => {
    if (!window.confirm(`Delete invoice ${r.id}? This cannot be undone.`)) return;
    try {
      await crud.sales.remove(r.raw.id);
      flash("success", `Invoice ${r.id} deleted.`);
    } catch (err) {
      flash("error", err.message || "Failed to delete invoice");
    }
  };

  return (
    <AppShell
      title="Invoices"
      subtitle={`${accepted.length} accepted quotation${accepted.length === 1 ? "" : "s"} awaiting invoice · ${invoices.length} invoices`}
      actions={
        <GhostButton onClick={exportCsv}>
          <Download className="size-4" /> Statement
        </GhostButton>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Invoiced" value={currency(invoiced)} hint={`${invoices.length} invoices`} />
        <StatCard label="Collected" value={currency(collected)} hint={`${invoices.filter((r) => statusOf(r.raw) === "Fully paid").length} fully paid`} />
        <StatCard label="Remaining" value={currency(outstanding)} hint={`${invoices.filter((r) => r.balanceDue > 0).length} with balance`} />
        <StatCard label="Awaiting invoice" value={currency(awaiting)} hint={`${accepted.length} accepted quotations`} />
      </div>

      {feedback && (
        <div
          className={`rounded-xl border p-3.5 text-xs font-semibold ${
            feedback.type === "success"
              ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-600"
              : "border-destructive/30 bg-destructive/10 text-destructive"
          }`}
        >
          {feedback.message}
        </div>
      )}

      {/* Accepted quotations */}
      <div className="space-y-2">
        <div>
          <h2 className="font-display text-base font-extrabold">Accepted quotations</h2>
          <p className="text-xs text-muted-foreground">Create an invoice from these. The quotation is deleted once its invoice is made.</p>
        </div>
        <TableShell>
          <thead>
            <tr>
              <Th>Quotation #</Th>
              <Th>Client</Th>
              <Th>Subject</Th>
              <Th className="text-right">Total</Th>
              <Th>Accepted</Th>
              <Th className="text-right">Actions</Th>
            </tr>
          </thead>
          <tbody>
            {accepted.length === 0 ? (
              <EmptyRow colSpan={6} message={qLoading ? "Loading…" : "No accepted quotations. Accept a quotation from the Quotations tab and it will appear here."} />
            ) : (
              accepted.map((q) => (
                <tr key={q.id} className="transition-colors hover:bg-muted/50">
                  <Td className="numeric font-semibold">{q.quotation_number}</Td>
                  <Td>
                    <p className="font-semibold">{clientOf(q)}</p>
                    <p className="text-xs text-muted-foreground">{q.client_details?.company || q.lead_company || "—"}</p>
                  </Td>
                  <Td className="text-sm">{q.subject || q.quotation_type || "Quotation"}</Td>
                  <Td className="numeric text-right font-bold">{currency(Number(q.total_amount || 0))}</Td>
                  <Td className="numeric text-xs text-muted-foreground">{fmtDate(q.accepted_at || q.updated_at)}</Td>
                  <Td className="text-right">
                    <div className="inline-flex items-center gap-1.5">
                      <button
                        title="Download quotation PDF"
                        onClick={() => buildDynamicQuotationPdf(q).save(`Quotation-${q.quotation_number || "Doc"}.pdf`)}
                        className="rounded-lg border border-border bg-card p-1.5 text-foreground transition-colors hover:bg-muted"
                      >
                        <Download className="size-3.5" />
                      </button>
                      <button
                        title="Download proforma invoice"
                        aria-label="Download proforma invoice"
                        onClick={() => setProforma(q)}
                        className="rounded-lg border border-border bg-card p-1.5 text-foreground transition-colors hover:bg-muted"
                      >
                        <FileText className="size-3.5" />
                      </button>
                      <button
                        onClick={() => setCreating(q)}
                        className="brand-surface inline-flex h-8 items-center gap-1.5 rounded-lg px-3 text-xs font-semibold text-primary-foreground"
                      >
                        <FileCheck className="size-3.5" /> Create invoice
                      </button>
                    </div>
                  </Td>
                </tr>
              ))
            )}
          </tbody>
        </TableShell>
      </div>

      {/* Invoices */}
      <div className="space-y-2">
        <h2 className="font-display text-base font-extrabold">Invoices</h2>
        <div className="flex flex-wrap items-center gap-3">
          <FilterPills options={pills} value={pill} onChange={setPill} />
          <SearchField value={query} onChange={setQuery} placeholder="Search invoices…" className="ml-auto w-full sm:w-72" />
        </div>
        <TableShell>
          <thead>
            <tr>
              <Th>Invoice</Th>
              <Th>Customer</Th>
              <Th className="text-right">Total</Th>
              <Th className="text-right">Paid</Th>
              <Th className="text-right">Remaining</Th>
              <Th>Date</Th>
              <Th>Status</Th>
              <Th />
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <EmptyRow colSpan={8} message={loading ? "Loading invoices…" : "No invoices in this view"} />
            ) : (
              rows.map((r) => {
                const st = statusOf(r.raw);
                const open = r.balanceDue > 0 && st !== "Refunded";
                return (
                  <tr key={r.raw?.id ?? r.id} className="transition-colors hover:bg-muted/50">
                    <Td className="numeric font-semibold">{r.id}</Td>
                    <Td>
                      <p className="font-semibold">{r.customer}</p>
                      <p className="text-xs text-muted-foreground">{r.owner}</p>
                    </Td>
                    <Td className="numeric text-right font-bold">{currency(r.amount)}</Td>
                    <Td className="numeric text-right text-emerald-600">{currency(r.amountPaid)}</Td>
                    <Td className={`numeric text-right font-semibold ${open ? "text-destructive" : "text-muted-foreground"}`}>
                      {currency(r.balanceDue)}
                    </Td>
                    <Td className="numeric text-sm text-muted-foreground">{r.date}</Td>
                    <Td><Chip tone={statusTone[st] ?? "muted"} dot>{st}</Chip></Td>
                    <Td className="text-right">
                      <div className="inline-flex items-center gap-1.5">
                        {open && (
                          <button
                            type="button"
                            title="Record payment"
                            aria-label="Record payment"
                            onClick={() => setPaying(r)}
                            className="rounded-lg border border-border bg-card p-1.5 text-foreground transition-colors hover:bg-muted"
                          >
                            <Wallet className="size-3.5" />
                          </button>
                        )}
                        <button
                          type="button"
                          title="Download invoice PDF"
                          aria-label="Download invoice PDF"
                          onClick={() => downloadInvoicePdf(r, r.customer)}
                          className="rounded-lg border border-border bg-card p-1.5 text-foreground transition-colors hover:bg-muted"
                        >
                          <Download className="size-3.5" />
                        </button>
                        <button
                          type="button"
                          title="Share invoice"
                          aria-label="Share invoice"
                          onClick={() => shareInvoicePdf(r, r.customer)}
                          className="rounded-lg border border-border bg-card p-1.5 text-foreground transition-colors hover:bg-muted"
                        >
                          <Share2 className="size-3.5" />
                        </button>
                        {open && (
                          <button
                            type="button"
                            title="Mark fully paid"
                            aria-label="Mark fully paid"
                            onClick={async () => {
                              if (!window.confirm(`Mark invoice ${r.id} as fully paid?`)) return;
                              try {
                                await crud.sales.update(r.raw.id, { payment_status: "PAID", amount_paid: r.amount });
                                flash("success", `Invoice ${r.id} is now fully paid.`);
                              } catch (err) {
                                flash("error", err.message || "Failed to update invoice");
                              }
                            }}
                            className="rounded-lg border border-border bg-card p-1.5 text-foreground transition-colors hover:bg-muted"
                          >
                            <FileCheck className="size-3.5" />
                          </button>
                        )}
                        <button
                          type="button"
                          title="Delete invoice"
                          aria-label="Delete invoice"
                          onClick={() => removeInvoice(r)}
                          className="rounded-lg border border-border bg-card p-1.5 text-destructive transition-colors hover:bg-destructive/10"
                        >
                          <Trash2 className="size-3.5" />
                        </button>
                      </div>
                    </Td>
                  </tr>
                );
              })
            )}
          </tbody>
        </TableShell>
      </div>

      <CreateInvoiceModal
        quotation={creating}
        onClose={() => setCreating(null)}
        onDone={(msg) => flash("success", msg)}
      />
      <ProformaModal
        quotation={proforma}
        onClose={() => setProforma(null)}
        onConfirm={(percent) => {
          downloadProformaPdf(proforma, { percent });
          flash("success", `Proforma (${percent}%) for quotation #${proforma.quotation_number} downloaded.`);
        }}
      />
      <PaymentModal invoice={paying} onClose={() => setPaying(null)} onDone={(msg) => flash("success", msg)} />
    </AppShell>
  );
}
