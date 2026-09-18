import { jsPDF } from "jspdf";

/* ------------------------------------------------------------------ */
/* Quotation attachments                                               */
/* Files are kept in browser storage per deal (the Express API has no  */
/* upload endpoint yet). Swap readAttachments/saveAttachment for API   */
/* calls when a /deals/:id/attachments route exists.                   */
/* ------------------------------------------------------------------ */

const KEY = "qiro.document.attachments";

const readAll = () => {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? "{}");
  } catch {
    return {};
  }
};

const writeAll = (all) => localStorage.setItem(KEY, JSON.stringify(all));

export const listAttachments = (dealId, documentType = "quotation") =>
  readAll()[`${documentType}:${String(dealId)}`] ?? [];

export function addAttachment(dealId, file, documentType = "quotation") {
  return new Promise((resolve, reject) => {
    if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
      reject(new Error("Select a PDF file"));
      return;
    }
    if (file.size > 3 * 1024 * 1024) {
      reject(new Error("File is larger than 3 MB"));
      return;
    }
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Could not read that file"));
    reader.onload = () => {
      const all = readAll();
      const key = `${documentType}:${String(dealId)}`;
      const rows = all[key] ?? [];
      rows.unshift({
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        name: file.name,
        size: file.size,
        type: file.type || "application/octet-stream",
        uploadedAt: new Date().toISOString(),
        dataUrl: String(reader.result)
      });
      all[key] = rows;
      writeAll(all);
      resolve(rows);
    };
    reader.readAsDataURL(file);
  });
}

export function removeAttachment(dealId, id, documentType = "quotation") {
  const all = readAll();
  const key = `${documentType}:${String(dealId)}`;
  all[key] = (all[key] ?? []).filter((a) => a.id !== id);
  writeAll(all);
  return all[key];
}

export const humanSize = (bytes) =>
  bytes > 1024 * 1024
    ? `${(bytes / 1024 / 1024).toFixed(1)} MB`
    : `${Math.max(1, Math.round(bytes / 1024))} KB`;

export function downloadAttachment(att) {
  const a = document.createElement("a");
  a.href = att.dataUrl;
  a.download = att.name;
  a.click();
}

export async function shareAttachment(att, title) {
  const response = await fetch(att.dataUrl);
  const blob = await response.blob();
  const file = new File([blob], att.name, { type: "application/pdf" });

  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title });
      return "shared";
    } catch {
      /* fall through to download */
    }
  }

  downloadAttachment(att);
  return "downloaded";
}

/* ------------------------------------------------------------------ */
/* Quotation PDF                                                       */
/* ------------------------------------------------------------------ */

const inr = (n) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 })
    .format(Number(n ?? 0))
    .replace("₹", "Rs. ");

/** Builds a one-page quotation PDF from a live deal + lead record. */
export function buildQuotationPdf({ deal, lead, meeting, preparedBy }) {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const W = doc.internal.pageSize.getWidth();
  const M = 48;
  let y = 64;

  doc.setFillColor(23, 132, 214);
  doc.rect(0, 0, W, 96, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(22);
  doc.text("QIRO CRM", M, 46);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.text("Quotation", M, 68);
  doc.text(
    new Date().toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }),
    W - M,
    68,
    { align: "right" }
  );
  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.text(`#Q-${deal?.id ?? "—"}`, W - M, 46, { align: "right" });

  y = 140;
  doc.setTextColor(30, 41, 59);
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.text("Prepared for", M, y);
  doc.text("Prepared by", W / 2, y);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);

  const name =
    [lead?.first_name, lead?.last_name].filter(Boolean).join(" ") || lead?.email || "Customer";
  const left = [name, lead?.company, lead?.email, lead?.phone].filter(Boolean);
  const right = [preparedBy?.name, preparedBy?.email, "Qiro Tech Pvt Ltd"].filter(Boolean);
  left.forEach((line, i) => doc.text(String(line), M, y + 20 + i * 16));
  right.forEach((line, i) => doc.text(String(line), W / 2, y + 20 + i * 16));

  y = y + 24 + Math.max(left.length, right.length) * 16 + 20;

  if (meeting) {
    doc.setFont("helvetica", "bold");
    doc.text("Following our meeting on", M, y);
    doc.setFont("helvetica", "normal");
    doc.text(
      new Date(meeting.scheduled_at).toLocaleString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit"
      }),
      M + 170,
      y
    );
    y += 28;
  }

  doc.setFillColor(238, 246, 253);
  doc.rect(M, y, W - M * 2, 30, "F");
  doc.setFont("helvetica", "bold");
  doc.text("Item", M + 12, y + 20);
  doc.text("Amount", W - M - 12, y + 20, { align: "right" });
  y += 30;

  doc.setFont("helvetica", "normal");
  const desc = doc.splitTextToSize(
    `${deal?.title ?? "Proposal"}${deal?.description ? ` — ${deal.description}` : ""}`,
    W - M * 2 - 150
  );
  const rowH = Math.max(34, desc.length * 15 + 18);
  doc.setDrawColor(226, 232, 240);
  doc.line(M, y + rowH, W - M, y + rowH);
  desc.forEach((line, i) => doc.text(line, M + 12, y + 22 + i * 15));
  doc.text(inr(deal?.amount), W - M - 12, y + 22, { align: "right" });
  y += rowH + 16;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.text("Total", W - M - 140, y + 6, { align: "right" });
  doc.text(inr(deal?.amount), W - M - 12, y + 6, { align: "right" });
  y += 40;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(100, 116, 139);
  const terms = [
    `Stage: ${String(deal?.stage ?? "").replace(/_/g, " ")}`,
    deal?.expected_close_date
      ? `Valid until: ${new Date(deal.expected_close_date).toLocaleDateString("en-IN")}`
      : "Valid for 30 days from the date of issue",
    "Taxes as applicable. Payment terms: 50% advance, balance on delivery.",
    "Thank you for the opportunity — we look forward to working with you."
  ];
  terms.forEach((line, i) => doc.text(line, M, y + i * 16));

  return doc;
}

export function quotationFileName(deal, lead) {
  const name =
    [lead?.first_name, lead?.last_name].filter(Boolean).join("-") || lead?.company || "customer";
  return `quotation-Q${deal?.id ?? ""}-${String(name).toLowerCase().replace(/\s+/g, "-")}.pdf`;
}

/** Download the PDF, then offer the native share sheet when available. */
export async function shareQuotationPdf(payload) {
  const doc = buildQuotationPdf(payload);
  const fileName = quotationFileName(payload.deal, payload.lead);
  const blob = doc.output("blob");
  const file = new File([blob], fileName, { type: "application/pdf" });

  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({
        files: [file],
        title: "Quotation",
        text: `Quotation for ${payload.deal?.title ?? "your requirement"}`
      });
      return "shared";
    } catch {
      /* fall through to download */
    }
  }
  doc.save(fileName);
  return "downloaded";
}

/* ------------------------------------------------------------------ */
/* Tax Invoice PDF                                                     */
/* ------------------------------------------------------------------ */

export function buildInvoicePdf(sale, customerName = null) {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const W = doc.internal.pageSize.getWidth();
  const M = 48;
  let y = 64;

  const raw = sale?.raw ?? sale ?? {};
  const invoiceNum = raw.invoice_number || sale?.id || `INV-${Date.now()}`;
  const saleDate = raw.sale_date || sale?.date || new Date().toISOString();
  const customer = customerName || sale?.customer || raw.customer_code || "Valued Customer";
  const item = raw.product_service || "Products & Professional Services";
  const saleAmount = Number(raw.sale_amount ?? sale?.amount ?? 0);
  const discount = Number(raw.discount ?? 0);
  const tax = Number(raw.tax ?? 0);
  const finalAmount = Number(raw.final_amount ?? sale?.amount ?? (saleAmount - discount + tax));
  const paymentStatus = String(raw.payment_status ?? sale?.status ?? "PENDING").toUpperCase();
  const paymentMethod = String(raw.payment_method ?? "UPI").replace(/_/g, " ");
  const owner = sale?.owner || "Sales Executive";

  // Header banner
  doc.setFillColor(15, 23, 42); // Slate 900
  doc.rect(0, 0, W, 96, "F");
  
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(22);
  doc.text("QIRO CRM", M, 46);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.text("Official Tax Invoice", M, 68);

  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.text(`#${invoiceNum}`, W - M, 46, { align: "right" });

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text(
    `Date: ${new Date(saleDate).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}`,
    W - M,
    68,
    { align: "right" }
  );

  // Billing details
  y = 135;
  doc.setTextColor(30, 41, 59);
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.text("Billed To (Customer)", M, y);
  doc.text("Billed By (Company)", W / 2, y);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  const left = [
    String(customer),
    raw.deal_title ? `Deal: ${raw.deal_title}` : null,
    "Payment Terms: Standard Commercial Terms"
  ].filter(Boolean);

  const right = [
    "Qiro Technologies Pvt Ltd",
    `Account Manager: ${owner}`,
    "GSTIN: 27AABCQ1234F1Z5",
    "Email: billing@qiro.in"
  ];

  left.forEach((line, i) => doc.text(String(line), M, y + 18 + i * 16));
  right.forEach((line, i) => doc.text(String(line), W / 2, y + 18 + i * 16));

  y = y + 20 + Math.max(left.length, right.length) * 16 + 18;

  // Payment status badge line
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text("Payment Status:", M, y);
  
  if (paymentStatus === "PAID") {
    doc.setTextColor(22, 101, 52); // Green
    doc.text(`PAID (Method: ${paymentMethod})`, M + 95, y);
  } else if (paymentStatus === "PARTIAL") {
    doc.setTextColor(194, 65, 12); // Orange
    doc.text(`PARTIAL PAYMENT (Method: ${paymentMethod})`, M + 95, y);
  } else {
    doc.setTextColor(185, 28, 28); // Red
    doc.text(`PENDING (Payment Method: ${paymentMethod})`, M + 95, y);
  }
  doc.setTextColor(30, 41, 59);

  y += 24;

  // Table header
  doc.setFillColor(241, 245, 249);
  doc.rect(M, y, W - M * 2, 28, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text("Description of Service / Product", M + 12, y + 18);
  doc.text("Amount (INR)", W - M - 12, y + 18, { align: "right" });

  y += 28;

  // Line item
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  const desc = doc.splitTextToSize(String(item), W - M * 2 - 140);
  const rowH = Math.max(32, desc.length * 14 + 16);
  desc.forEach((line, i) => doc.text(line, M + 12, y + 18 + i * 14));
  doc.text(inr(saleAmount), W - M - 12, y + 18, { align: "right" });

  y += rowH;
  doc.setDrawColor(226, 232, 240);
  doc.line(M, y, W - M, y);
  y += 18;

  // Summary box
  const summaryX = W - M - 200;
  const valX = W - M - 12;

  doc.setFontSize(10);
  doc.text("Subtotal:", summaryX, y);
  doc.text(inr(saleAmount), valX, y, { align: "right" });
  y += 18;

  if (discount > 0) {
    doc.setTextColor(220, 38, 38);
    doc.text("Discount:", summaryX, y);
    doc.text(`- ${inr(discount)}`, valX, y, { align: "right" });
    doc.setTextColor(30, 41, 59);
    y += 18;
  }

  if (tax > 0) {
    doc.text("GST / Taxes:", summaryX, y);
    doc.text(`+ ${inr(tax)}`, valX, y, { align: "right" });
    y += 18;
  }

  doc.setDrawColor(203, 213, 225);
  doc.line(summaryX, y, W - M, y);
  y += 14;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.text("Total Payable:", summaryX, y + 2);
  doc.text(inr(finalAmount), valX, y + 2, { align: "right" });

  y += 48;

  // Footer notes & terms
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(100, 116, 139);
  doc.text("Terms & Notes:", M, y);
  y += 14;
  doc.text("1. All payments are non-refundable unless specified in master agreement.", M, y);
  y += 12;
  doc.text("2. Payments can be completed using NEFT/RTGS, UPI, or Corporate Cards.", M, y);
  y += 12;
  doc.text("3. This is a system-generated invoice generated through Qiro CRM.", M, y);

  return doc;
}

export function downloadInvoicePdf(sale, customerName = null) {
  const doc = buildInvoicePdf(sale, customerName);
  const raw = sale?.raw ?? sale ?? {};
  const invNum = raw.invoice_number || sale?.id || "INV";
  doc.save(`Invoice-${invNum}.pdf`);
}

export async function shareInvoicePdf(sale, customerName = null) {
  const doc = buildInvoicePdf(sale, customerName);
  const raw = sale?.raw ?? sale ?? {};
  const invNum = raw.invoice_number || sale?.id || "INV";
  const fileName = `Invoice-${invNum}.pdf`;
  const blob = doc.output("blob");
  const file = new File([blob], fileName, { type: "application/pdf" });

  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({
        files: [file],
        title: "Tax Invoice",
        text: `Invoice #${invNum} from Qiro CRM`
      });
      return "shared";
    } catch {
      /* fall through to download */
    }
  }
  doc.save(fileName);
  return "downloaded";
}

