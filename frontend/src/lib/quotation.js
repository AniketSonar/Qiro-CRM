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
