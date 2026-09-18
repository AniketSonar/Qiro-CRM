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

const COMPANY = {
  name: "QIRO TECH INNOVATION PVT. LTD.",
  gst: "27AABCQ2268A1ZR",
  address: ["Office No 602, 6th Floor", "The Business AdvantEdge", "Near Laxmi Chowk, Marunji Road", "Hinjawadi Phase I, Pune - 411057"],
  email: "commercial@qirotec.com",
  phone: "+91 8623823997",
  bank: [
    "Account name: QIRO TECH INNOVATION PRIVATE LIMITED",
    "Bank: IDFC FIRST",
    "Account number: 86690868447",
    "IFSC: IDFB0043491",
    "SWIFT: IDFBINBBMUM",
    "Branch: CHHATRAPATI SAMBHAJINAGAR BRANCH"
  ]
};

const teal = [21, 103, 123];
const dark = [28, 36, 43];

const referenceHeader = (doc, title) => {
  const W = doc.internal.pageSize.getWidth();
  doc.setTextColor(...teal);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.text("QIRO TECH", W / 2, 38, { align: "center" });
  doc.setFontSize(10);
  doc.text("Innovation Pvt. Ltd.", W / 2, 52, { align: "center" });
  doc.setTextColor(...dark);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text(`Pune, Maharashtra | ${COMPANY.email} | ${COMPANY.phone}`, W / 2, 72, { align: "center" });
  doc.setDrawColor(...dark);
  doc.line(36, 86, W - 36, 86);
  doc.setTextColor(...teal);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.text(title, W / 2, 120, { align: "center" });
};

const referenceFooter = (doc) => {
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(90, 90, 90);
  doc.text(`${COMPANY.name} | GST: ${COMPANY.gst}`, W / 2, H - 28, { align: "center" });
};

const drawReferenceTable = (doc, columns, rows, startY, rowHeight = 34) => {
  const W = doc.internal.pageSize.getWidth();
  const x = 36;
  const width = W - 72;
  const total = columns.reduce((sum, column) => sum + column.width, 0);
  let currentX = x;
  doc.setFillColor(...teal);
  doc.rect(x, startY, width, 34, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(255, 255, 255);
  columns.forEach((column) => {
    doc.text(column.label, currentX + column.width / 2, startY + 21, { align: "center" });
    currentX += (column.width / total) * width;
  });
  let y = startY + 34;
  rows.forEach((row) => {
    currentX = x;
    const values = columns.map((column) => doc.splitTextToSize(String(row[column.key] ?? ""), column.width - 10));
    const height = Math.max(rowHeight, ...values.map((lines) => lines.length * 13 + 16));
    doc.setDrawColor(110, 110, 110);
    doc.setTextColor(...dark);
    doc.setFont("helvetica", "normal");
    values.forEach((lines, index) => {
      const column = columns[index];
      const columnWidth = (column.width / total) * width;
      doc.rect(currentX, y, columnWidth, height);
      lines.forEach((line, lineIndex) => doc.text(line, currentX + columnWidth / 2, y + 20 + lineIndex * 13, { align: "center" }));
      currentX += columnWidth;
    });
    y += height;
  });
  return y;
};

const drawReferenceSow = (doc, title, overview, objectives, deliverables, inclusions) => {
  referenceHeader(doc, title);
  let y = 154;
  const section = (heading, lines) => {
    doc.setTextColor(...teal);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(13);
    doc.text(heading, 42, y);
    y += 20;
    doc.setTextColor(...dark);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.splitTextToSize(lines, 510).forEach((line) => {
      doc.text(line, 42, y);
      y += 14;
    });
    y += 14;
  };
  section("Project Overview", overview);
  section("Objectives", objectives.map((item) => `- ${item}`).join("\n"));
  section("Deliverables", deliverables.map((item, index) => `${index + 1}. ${item}`).join("\n"));
  section("Inclusions", inclusions.map((item) => `- ${item}`).join("\n"));
  referenceFooter(doc);
};

function buildReferenceQuotationPdf({ deal, lead, template = "web" }) {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const W = doc.internal.pageSize.getWidth();
  const isDigital = template === "digital";
  const clientName = [lead?.first_name, lead?.last_name].filter(Boolean).join(" ") || lead?.company || "Client Name";
  const project = deal?.title || (isDigital ? "Digital Marketing" : "Web Development");
  const amount = Number(deal?.amount ?? 0);
  referenceHeader(doc, "QUOTATION");
  doc.setTextColor(...dark);
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.text("Quotation for:", 42, 160);
  doc.text(project, W - 42, 160, { align: "right" });
  doc.setFont("helvetica", "normal");
  doc.text(clientName, 42, 180);
  doc.text(`Date: ${new Date().toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}`, W - 42, 180, { align: "right" });
  doc.text(lead?.company || lead?.city || "Pune, Maharashtra", 42, 198);
  doc.text(`Quotation #: Q-${new Date().getFullYear()}-${String(deal?.id ?? "0000").padStart(4, "0")}`, W - 42, 198, { align: "right" });
  doc.setTextColor(...teal);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.text(`Subject: Quotation for ${isDigital ? "Digital Marketing" : "Web Development"}`, 42, 240);
  doc.setTextColor(...dark);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text("Thank you for showing interest in our services. Please find our exclusive quotation for your requirement.", 42, 266);
  const deliverables = isDigital ? "1) Static posts (12 per month)  2) Reels (4 per month)" : "1) Hosting  2) Domain  3) SSL Certificate  4) Corporate mail id";
  drawReferenceTable(doc, [
    { key: "number", label: "Sr. No.", width: 55 },
    { key: "description", label: "Product Description", width: 130 },
    { key: "technology", label: "Technology", width: 110 },
    { key: "deliverables", label: "Deliverables", width: 230 },
    { key: "price", label: "Price / Unit", width: 100 },
    { key: "total", label: "Total Amount", width: 110 }
  ], [{ number: 1, description: project, technology: isDigital ? "Adobe Tool, Canva" : "HTML, CSS, JS, Next JS", deliverables, price: `${inr(amount)} / month`, total: inr(amount) }], 300, 110);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...dark);
  doc.text(`Sub Total: ${inr(amount)}`, W - 42, 470, { align: "right" });
  doc.text(`Including 18% GST - Grand Total: ${inr(amount)}`, W - 42, 494, { align: "right" });
  referenceFooter(doc);

  doc.addPage();
  drawReferenceSow(
    doc,
    isDigital ? "SCOPE OF WORK: DIGITAL MARKETING" : "SCOPE OF WORK",
    isDigital ? "This scope covers the creation and management of social media content for Instagram and Facebook, with monthly delivery of 12 static posts and 4 reels." : "The project aims to design, develop and launch a professional, secure and user-friendly corporate website.",
    isDigital ? ["Increase brand awareness through consistent posting", "Maintain a unified brand identity", "Provide monthly performance insights"] : ["Establish a credible online presence", "Ensure the website is secure and reliable", "Enable fast updates and annual maintenance support"],
    isDigital ? ["12 static posts with captions, hashtags and CTAs", "4 reels of 15-30 seconds", "Monthly content calendar", "Monthly performance report"] : ["Website hosting setup", "SSL certificate installation", "Responsive industry-oriented design", "Annual maintenance and technical support", "Code handover after development"],
    isDigital ? ["Content strategy and monthly theme planning", "Design and copywriting for all content", "One round of minor revisions", "Monthly performance review"] : ["Hosting setup for 1 year", "SSL certificate installation", "Website maintenance support", "WhatsApp update support"]
  );
  doc.addPage();
  referenceHeader(doc, "FEATURES & TIMELINE");
  drawReferenceTable(doc, [{ key: "phase", label: "Phase", width: 180 }, { key: "activity", label: "Key Activities", width: 220 }, { key: "timeline", label: "Timeline", width: 150 }], isDigital ? [
    { phase: "Planning", activity: "Content themes and calendar", timeline: "Monthly" },
    { phase: "Content", activity: "Posts, reels and copywriting", timeline: "Monthly" },
    { phase: "Review", activity: "Analytics and optimization", timeline: "Monthly" }
  ] : [
    { phase: "Discovery & Planning", activity: "Requirement gathering", timeline: "Week 1" },
    { phase: "Infrastructure Setup", activity: "Domain, hosting and SSL", timeline: "Week 1" },
    { phase: "Website Development", activity: "Design and responsive build", timeline: "Week 2" },
    { phase: "Testing & Go-Live", activity: "Functionality testing and deployment", timeline: "Week 2" },
    { phase: "Maintenance", activity: "Support and updates", timeline: "Ongoing" }
  ], 150, 38);
  referenceFooter(doc);
  doc.addPage();
  referenceHeader(doc, "BANK DETAILS");
  doc.setTextColor(...dark);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  COMPANY.bank.forEach((line, index) => doc.text(line, 54, 170 + index * 24));
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...teal);
  doc.text("Warm Regards,", 54, 360);
  doc.text(COMPANY.name, 54, 386);
  doc.setFont("helvetica", "normal");
  COMPANY.address.forEach((line, index) => doc.text(line, 54, 420 + index * 18));
  doc.text(`${COMPANY.email} | ${COMPANY.phone}`, 54, 500);
  referenceFooter(doc);
  return doc;
}

/** Builds a quotation PDF from a live deal + lead record. */
export function buildQuotationPdf({ deal, lead, meeting, preparedBy, template = "web" }) {
  if (template === "web" || template === "digital") return buildReferenceQuotationPdf({ deal, lead, template });
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

function buildReferenceInvoicePdf(sale, customerName = null) {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const W = doc.internal.pageSize.getWidth();
  const raw = sale?.raw ?? sale ?? {};
  const customer = customerName || sale?.customer || raw.customer_code || "Valued Customer";
  const amount = Number(raw.sale_amount ?? sale?.amount ?? 0);
  const tax = Number(raw.tax ?? 0);
  const discount = Number(raw.discount ?? 0);
  const total = Number(raw.final_amount ?? sale?.amount ?? amount - discount + tax);
  const invoiceNumber = raw.invoice_number || sale?.id || `INV-${Date.now()}`;
  const date = raw.sale_date || sale?.date || new Date().toISOString();
  referenceHeader(doc, "TAX INVOICE");
  doc.setTextColor(...dark);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.text("ORIGINAL FOR RECIPIENT", W - 42, 104, { align: "right" });
  doc.text("Bill To:", 42, 154);
  doc.text("Invoice details:", W / 2, 154);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text(String(customer), 42, 172);
  doc.text(`Invoice date: ${new Date(date).toLocaleDateString("en-IN")}`, W / 2, 172);
  doc.text(`Invoice no.: ${invoiceNumber}`, W / 2, 188);
  doc.text("Place of supply: Maharashtra (27)", W / 2, 204);
  const end = drawReferenceTable(doc, [
    { key: "number", label: "S.N.", width: 45 },
    { key: "description", label: "DESCRIPTION", width: 240 },
    { key: "hsn", label: "HSN/SAC", width: 75 },
    { key: "qty", label: "QTY", width: 55 },
    { key: "rate", label: "RATE", width: 85 },
    { key: "amount", label: "AMOUNT", width: 105 }
  ], [{ number: 1, description: raw.product_service || "Website Development + Graphic Post", hsn: raw.hsn_sac || "", qty: 1, rate: inr(amount), amount: inr(amount) }], 238, 360);
  let y = end + 20;
  doc.setTextColor(...dark);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text("Taxable amount", W - 210, y);
  doc.text(inr(amount - discount), W - 42, y, { align: "right" });
  y += 18;
  if (discount) {
    doc.text("Discount", W - 210, y);
    doc.text(`- ${inr(discount)}`, W - 42, y, { align: "right" });
    y += 18;
  }
  doc.text("CGST @ 9% / SGST @ 9%", W - 210, y);
  doc.text(inr(tax), W - 42, y, { align: "right" });
  y += 24;
  doc.setFont("helvetica", "bold");
  doc.text("GRAND TOTAL", W - 210, y);
  doc.text(inr(total), W - 42, y, { align: "right" });
  y += 42;
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...teal);
  doc.text("BANK ACCOUNT DETAILS", 42, y);
  doc.setTextColor(...dark);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  COMPANY.bank.forEach((line, index) => doc.text(line, 42, y + 18 + index * 13));
  doc.setFont("helvetica", "bold");
  doc.text(`Payment status: ${String(raw.payment_status ?? sale?.status ?? "PENDING").toUpperCase()}`, W - 210, y + 30);
  referenceFooter(doc);
  return doc;
}

function buildLegacyInvoicePdf(sale, customerName = null) {
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

export function buildInvoicePdf(sale, customerName = null, template = "tax") {
  return template === "tax" ? buildReferenceInvoicePdf(sale, customerName) : buildLegacyInvoicePdf(sale, customerName);
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

