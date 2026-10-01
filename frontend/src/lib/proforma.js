import { renderDocument, sharePdf, money, fmtLong, QIRO_COMPANY } from "./docLayout.js";

/* Proforma Invoice — same layout as the Tax Invoice (see docLayout.js). */

export const PROFORMA_BANK = {
  bankName: "IDFC FIRST BANK",
  accountName: "QIRO TECH INNOVATION PRIVATE LIMITED",
  accountNumber: "86690868447",
  ifsc: "IDFB0043491"
};

/** PI-YYYY-NNNN, derived from the quotation number so it stays stable per quotation. */
export function proformaNumber(q) {
  const raw = q?.raw ?? q ?? {};
  if (raw.proforma_number) return raw.proforma_number;
  const year = new Date(raw.created_at || Date.now()).getFullYear();
  const seq = String(raw.quotation_number || raw.id || "1").replace(/\D/g, "").slice(-4).padStart(4, "0");
  return `PI-${year}-${seq}`;
}

export function buildProformaPdf(quotation, options = {}) {
  const raw = quotation?.raw ?? quotation ?? {};
  const client = raw.client_details ?? {};
  const items = Array.isArray(raw.items) ? raw.items : [];
  const pricing = raw.pricing_breakdown ?? {};

  const clientCompany = client.company && client.company !== "—" ? client.company : "";
  const clientName = clientCompany || client.name || raw.customer_name || "Valued Client";
  const clientContact = clientCompany ? client.name || raw.customer_name || "" : "";
  const clientCity = client.city || "Pune, Maharashtra";

  const piNo = options.proformaNumber || proformaNumber(quotation);
  const piDate = options.date ? new Date(options.date) : new Date();
  const project =
    raw.product_service ||
    (raw.quotation_type ? raw.quotation_type.replace(" Quotation", "") + " Services" : "Digital Marketing Services");
  const paymentTitle = options.paymentTitle || "100% Monthly Payment";
  const paymentNote = options.paymentNote || "As per agreed digital marketing service cycle";

  // ---- amounts ----
  const subtotal = Number(pricing.subtotal ?? raw.subtotal ?? raw.total_amount ?? 0);
  const discount = Number(pricing.discount ?? raw.discount ?? 0);
  const gstMode = String(pricing.gst_mode || raw.gst_mode || "EXCLUSIVE").toUpperCase();
  const gstRate = gstMode === "NONE" ? 0 : Number(pricing.tax_rate ?? 18);
  const taxable = Math.max(subtotal - discount, 0);
  const gstAmt =
    pricing.tax_amount != null && gstMode !== "NONE"
      ? Number(pricing.tax_amount)
      : gstMode === "INCLUSIVE"
        ? taxable - taxable / (1 + gstRate / 100)
        : (taxable * gstRate) / 100;
  const grand =
    pricing.grand_total != null ? Number(pricing.grand_total) : gstMode === "INCLUSIVE" ? taxable : taxable + gstAmt;

  const lineItems = items.length
    ? items
    : [
        {
          description: raw.product_service || "Digital Marketing",
          technology: "Adobe Tools & Canva",
          deliverables: "Static Posts (12 Per Month)\nReels (4 Per Month)",
          quantity: 1,
          unit_price: subtotal,
          total: subtotal
        }
      ];

  const totals = [{ label: "Sub Total", value: money(subtotal) }];
  if (discount > 0) totals.push({ label: "Discount", value: `- ${money(discount)}` });
  totals.push({
    label: gstMode === "NONE" ? "GST" : `GST (${gstRate}%)${gstMode === "INCLUSIVE" ? " incl." : ""}`,
    value: gstMode === "NONE" ? "NA" : money(gstAmt)
  });

  return renderDocument({
    title: "PROFORMA INVOICE",
    meta: [
      ["Proforma No", piNo],
      ["Date", fmtLong(piDate)],
      ["Project", project],
      ["Terms", paymentTitle]
    ],
    billTo: { name: clientName, lines: [clientContact, clientCity] },
    shipTo: { name: clientName, lines: [clientCity] },
    items: lineItems.map((it) => {
      const qty = Number(it.quantity || 1);
      const amount = Number(it.total ?? it.unit_price ?? 0);
      const sub = [it.technology, it.deliverables]
        .filter((v) => v && v !== "—")
        .join("\n")
        .split("\n")
        .map((l) => l.replace(/^\s*\d+\)\s*/, "").trim())
        .filter(Boolean);
      return { description: it.description, sub, qty, rate: Number(it.unit_price ?? amount / qty), amount };
    }),
    totals,
    total: { label: "Grand Total", value: money(grand) },
    due: { label: "Balance Due", value: `INR ${money(grand)}` },
    notes: [],
    terms: { title: "Terms & Conditions", lines: [`Payment Schedule: ${paymentTitle}`, paymentNote] },
    bank: [
      ["Bank Name", PROFORMA_BANK.bankName],
      ["Account Name", PROFORMA_BANK.accountName],
      ["Account Number", PROFORMA_BANK.accountNumber],
      ["IFSC Code", PROFORMA_BANK.ifsc]
    ],
    footerText: `Qiro Tech Innovation Pvt. Ltd.`
  });
}

export const proformaFileName = (q) => `Proforma-${proformaNumber(q)}.pdf`;

export function downloadProformaPdf(quotation, options = {}) {
  buildProformaPdf(quotation, options).save(proformaFileName(quotation));
}

export async function shareProformaPdf(quotation, options = {}) {
  return sharePdf(
    buildProformaPdf(quotation, options),
    proformaFileName(quotation),
    "Proforma Invoice",
    `Proforma ${proformaNumber(quotation)} from Qiro Tech`
  );
}
