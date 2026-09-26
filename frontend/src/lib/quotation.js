import { jsPDF } from "jspdf";
import { QIRO_LOGO_BASE64 } from "./qiroLogo.js";

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
    const reader = new FileReader();
    reader.onload = () => {
      const all = readAll();
      const k = `${documentType}:${String(dealId)}`;
      const list = all[k] ?? [];
      const item = {
        id: `att-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        name: file.name,
        size: file.size,
        type: file.type,
        addedAt: new Date().toISOString(),
        dataUrl: reader.result
      };
      all[k] = [item, ...list];
      writeAll(all);
      resolve(all[k]);
    };
    reader.onerror = () => reject(reader.error ?? new Error("Failed to read file"));
    reader.readAsDataURL(file);
  });
}

export function removeAttachment(dealId, id, documentType = "quotation") {
  const all = readAll();
  const k = `${documentType}:${String(dealId)}`;
  all[k] = (all[k] ?? []).filter((f) => f.id !== id);
  writeAll(all);
  return all[k];
}

export function humanSize(bytes = 0) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function downloadAttachment(att) {
  const a = document.createElement("a");
  a.href = att.dataUrl;
  a.download = att.name;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

export async function shareAttachment(att, title = "Document") {
  if (navigator.canShare && att.dataUrl) {
    try {
      const blob = await fetch(att.dataUrl).then((r) => r.blob());
      const file = new File([blob], att.name, { type: att.type || "application/pdf" });
      if (navigator.canShare({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: title,
          text: `${title}: ${att.name}`
        });
        return "shared";
      }
    } catch {
      /* fall through to download */
    }
  }

  downloadAttachment(att);
  return "downloaded";
}

/* ------------------------------------------------------------------ */
/* Dynamic Professional Quotation PDF Generator                       */
/* ------------------------------------------------------------------ */

const inr = (n) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 })
    .format(Number(n ?? 0))
    .replace("₹", "Rs. ");

export const BANK_DETAILS = {
  companyName: "QIRO TECH INNOVATION PRIVATE LIMITED",
  bankName: "IDFC FIRST",
  accountNumber: "86690868447",
  ifsc: "IDFB0043491",
  swift: "IDFBINBBMUM",
  branch: "CHHATRAPATI SAMBHAJINAGAR BRANCH"
};

export const COMPANY_DETAILS = {
  name: "QIRO TECH INNOVATION PVT. LTD.",
  shortName: "Qiro Tech Innovation Pvt. Ltd.",
  addressLine1: "Office No 602, 6th Floor, The Business AdvantEdge,",
  addressLine2: "Near Laxmi Chowk, Marunji Road, Hinjawadi Phase I,",
  cityStatePin: "Pune, Maharashtra – 411057",
  headerTagline: "Pune, Maharashtra | commercial@qirotec.com | +918623823997",
  email: "commercial@qirotec.com",
  phone: "+91 8623823997",
  gstin: "27AABCQ2268A1ZR"
};

function formatSectionHeading(title, number, includeNumber = false) {
  const rawTitle = String(title ?? "").trim();
  if (!rawTitle) return "";
  const normalized = rawTitle
    .replace(/^\d+\s*([\.)])\s*/, "")
    .replace(/^[-•*]\s*/, "")
    .trim();
  return includeNumber ? `${number}. ${normalized}` : normalized;
}

/**
 * Builds the comprehensive, corporate Multi-page Quotation PDF strictly formatted inside
 * structural borders, with zero margin overflow, matching the corporate reference documents.
 */
export function buildDynamicQuotationPdf(quotation) {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const M = 40; // Clean 40pt margin for A4 (515.28 pt content width)
  const contentW = W - M * 2;
  const halfW = contentW / 2;
  const bottomLimit = H - 50;

  const raw = quotation?.raw ?? quotation ?? {};
  const client = raw.client_details ?? {};
  const items = Array.isArray(raw.items) ? raw.items : [];
  const scopeSections = Array.isArray(raw.scope_sections) ? raw.scope_sections : [];
  const timelineItems = Array.isArray(raw.timeline_items) ? raw.timeline_items : [];
  const inclusions = Array.isArray(raw.inclusions) ? raw.inclusions : [];
  const pricing = raw.pricing_breakdown ?? {
    subtotal: raw.subtotal || raw.total_amount || 0,
    discount: raw.discount || 0,
    tax_rate: 18,
    tax_amount: raw.tax || 0,
    grand_total: raw.total_amount || 0
  };

  const clientName = client.name || raw.customer_name || "Valued Client";
  const clientCompany = client.company && client.company !== "—" ? client.company : "";
  const clientCity = client.city || "Pune, Maharashtra";
  const qNum = raw.quotation_number || `Q-${new Date().getFullYear()}-0001`;
  const qDate = raw.created_at
    ? new Date(raw.created_at).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })
    : new Date().toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
  const qType = raw.quotation_type || "Quotation";
  const qSubject = raw.subject || `Quotation for ${qType.replace(" Quotation", "")}`;

  let y = 32;

  // Helper for adding new page with consistent margin
  function checkPageBreak(requiredHeight) {
    if (y + requiredHeight > bottomLimit) {
      doc.addPage();
      y = 45;
      return true;
    }
    return false;
  }

  // ═══════════════════════════════════════════════════════════════
  // PAGE 1: HEADER & LOGO
  // ═══════════════════════════════════════════════════════════════

  // Official Qiro Tech Logo Image (exact official symbol & typography)
  const logoW = 185;
  const logoH = 55.4;
  const logoX = (W - logoW) / 2;
  doc.addImage(QIRO_LOGO_BASE64, "PNG", logoX, y, logoW, logoH);
  y += logoH + 8;

  // Tagline / Contact bar
  doc.setTextColor(71, 85, 105);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text(COMPANY_DETAILS.headerTagline, W / 2, y, { align: "center" });

  // Divider line (thick dark line matching reference image)
  y += 12;
  doc.setDrawColor(30, 41, 59);
  doc.setLineWidth(1.2);
  doc.line(M, y, W - M, y);

  // QUOTATION Title Banner
  y += 34;
  doc.setTextColor(5, 92, 121);
  doc.setFont("times", "bold");
  doc.setFontSize(15);
  doc.text("QUOTATION", W / 2, y, { align: "center" });

  // Quotation For (Left) & Metadata (Right) — matching reference image exactly
  y += 38;
  doc.setTextColor(5, 92, 121);
  doc.setFont("times", "bold");
  doc.setFontSize(12);
  doc.text("Quotation for:", M, y);

  if (clientCompany) {
    doc.setTextColor(5, 92, 121);
    doc.setFont("times", "bold");
    doc.setFontSize(12);
    doc.text(clientCompany, W - M, y, { align: "right" });
  }

  y += 18;
  doc.setTextColor(30, 41, 59);
  doc.setFont("times", "bold");
  doc.setFontSize(11);
  doc.text(clientName, M, y);

  doc.setFont("times", "normal");
  doc.setFontSize(11);
  doc.setTextColor(30, 41, 59);
  doc.text(`Date: ${qDate}`, W - M, y, { align: "right" });

  y += 16;
  doc.setFont("times", "normal");
  doc.setFontSize(10);
  doc.setTextColor(71, 85, 105);
  doc.text(clientCity, M, y);

  doc.setFont("times", "bold");
  doc.setTextColor(30, 41, 59);
  doc.text(`Quotation : #${qNum}`, W - M, y, { align: "right" });

  // Spacious gap before Subject (matching reference image)
  y += 68;

  // Subject Banner (Centered in the middle like reference image)
  doc.setTextColor(5, 92, 121);
  doc.setFont("times", "bold");
  doc.setFontSize(18);
  doc.text(`Subject :  ${qSubject}`, W / 2, y, { align: "center" });

  // Spacious gap before Salutation
  y += 50;

  // Salutation & Intro (matching reference image)
  doc.setTextColor(30, 41, 59);
  doc.setFont("times", "normal");
  doc.setFontSize(12);
  doc.text("Dear Sir,", M, y);
  y += 18;
  const introMsg = `Subject: - Your enquiry for requirement for ${qType.replace(" Quotation", "")} service. Dated on ${qDate}.`;
  doc.text(introMsg, M, y);
  y += 18;
  doc.text("Thank you for showing interest in our Services & contacting us. Please find our exclusive quotation for your ", M, y);
  y += 16;
  doc.text("requirement", M, y);
  y += 34;

  // ═══════════════════════════════════════════════════════════════
  // STRUCTURED PRODUCTS / SERVICES TABLE (PROPORTIONAL FULL-PAGE FILL)
  // ═══════════════════════════════════════════════════════════════
  const colSr = 25;
  const colDesc = 105;
  const colTech = 95;
  const colDeliv = 155;
  const colPrice = 65;
  const colTotal = contentW - (colSr + colDesc + colTech + colDeliv + colPrice);

  const colStarts = [
    M,
    M + colSr,
    M + colSr + colDesc,
    M + colSr + colDesc + colTech,
    M + colSr + colDesc + colTech + colDeliv,
    M + colSr + colDesc + colTech + colDeliv + colPrice,
    M + contentW
  ];

  const thY = y;
  const thH = 28;
  doc.setFillColor(15, 96, 125); // Teal / Dark petrol blue from reference
  doc.rect(M, thY, contentW, thH, "F");

  // Subtle vertical dividing lines in header
  doc.setDrawColor(255, 255, 255);
  doc.setLineWidth(0.5);
  [colStarts[1], colStarts[2], colStarts[3], colStarts[4], colStarts[5]].forEach((x) => {
    doc.line(x, thY + 3, x, thY + thH - 3);
  });

  doc.setTextColor(255, 255, 255);
  doc.setFont("times", "bold");
  doc.setFontSize(8.5);

  doc.text("Sr.", colStarts[0] + colSr / 2, thY + 11, { align: "center" });
  doc.text("No.", colStarts[0] + colSr / 2, thY + 22, { align: "center" });

  doc.text("Product", colStarts[1] + 6, thY + 11);
  doc.text("Description", colStarts[1] + 6, thY + 22);

  doc.text("Technology", colStarts[2] + 6, thY + 17);
  doc.text("Deliverables", colStarts[3] + 6, thY + 17);
  doc.text("Price / Unit", colStarts[4] + colPrice / 2, thY + 17, { align: "center" });
  doc.text("Total Amount", colStarts[5] + colTotal - 6, thY + 17, { align: "right" });

  y += thH;

  // Render Table Items with detailed fallback if empty
  const defaultSoftwareItems = [
    {
      description: "UI/UX Design System, Wireframes & Interactive Prototype",
      technology: "Figma, Tailwind CSS, Responsive Web",
      deliverables: "1) User Journey Mapping\n2) Clickable High-Fidelity Prototype\n3) Design System & Tokens",
      quantity: 1,
      unit_price: 25000,
      total: 25000
    },
    {
      description: "Core Software Engine & Custom Business Logic Modules",
      technology: "React.js, Next.js, Node.js, TypeScript",
      deliverables: "1) Multi-Tier Role RBAC\n2) Central KPI Dashboard\n3) Entity Lifecycle Workflows\n4) System Audit Trail Logs",
      quantity: 1,
      unit_price: 65000,
      total: 65000
    },
    {
      description: "RESTful API Engine, Database Architecture & Security",
      technology: "PostgreSQL, Express.js, JWT, TLS 1.3",
      deliverables: "1) Relational DB Modeling\n2) Stateless Token Authentication\n3) Data Encryption at Rest\n4) Automated Daily Backups",
      quantity: 1,
      unit_price: 35000,
      total: 35000
    },
    {
      description: "Third-Party Integrations & Automation Hub",
      technology: "Webhooks, SMTP, SMS / WhatsApp APIs",
      deliverables: "1) Payment Gateway (Razorpay/Stripe)\n2) Automated Email & WhatsApp Alerts\n3) Excel & PDF Export Engine",
      quantity: 1,
      unit_price: 25000,
      total: 25000
    },
    {
      description: "DevOps, Cloud Hosting Setup, CI/CD & QA Testing",
      technology: "Docker, AWS / Vercel Cloud, GitHub Actions",
      deliverables: "1) Production Cloud Hosting Setup\n2) Automated CI/CD Pipeline\n3) End-to-End QA Testing Audit\n4) Source Code Handover",
      quantity: 1,
      unit_price: 20000,
      total: 20000
    }
  ];

  const defaultGeneralItems = [
    {
      description: raw.product_service || "Digital Marketing",
      technology: "1) Adobe Tool\n2) Canva",
      deliverables: "1) Static Posts (12 Per Month)\n2) Reels (4 Per Month)",
      quantity: 1,
      unit_price: raw.total_amount || 15000,
      total: raw.total_amount || 15000
    }
  ];

  const itemsToRender = items.length > 0
    ? items
    : (qType === "Software Quotation" ? defaultSoftwareItems : defaultGeneralItems);

  // Dynamic row height so table elegantly fills Page 1 matching reference
  const minRowH = itemsToRender.length === 1 ? 95 : itemsToRender.length === 2 ? 65 : 42;

  itemsToRender.forEach((it, idx) => {
    const descLines = doc.splitTextToSize(String(it.description || ""), colDesc - 12);
    const techLines = doc.splitTextToSize(String(it.technology || "—"), colTech - 12);
    const delivLines = doc.splitTextToSize(String(it.deliverables || "—"), colDeliv - 12);

    const maxLines = Math.max(descLines.length, techLines.length, delivLines.length, 1);
    const rowHeight = Math.max(minRowH, maxLines * 14 + 20);

    checkPageBreak(rowHeight + 35);

    // Outer row borders
    doc.setDrawColor(203, 213, 225);
    doc.setLineWidth(0.5);
    doc.rect(M, y, contentW, rowHeight, "S");

    // Vertical column lines
    [colStarts[1], colStarts[2], colStarts[3], colStarts[4], colStarts[5]].forEach((x) => {
      doc.line(x, y, x, y + rowHeight);
    });

    // Content text with vertical centering
    doc.setFont("times", "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(30, 41, 59);

    doc.text(String(idx + 1), colStarts[0] + colSr / 2, y + rowHeight / 2 + 3.5, { align: "center" });

    const descTop = y + (rowHeight - descLines.length * 13) / 2 + 10;
    descLines.forEach((l, i) => doc.text(l, colStarts[1] + 6, descTop + i * 13));

    const techTop = y + (rowHeight - techLines.length * 13) / 2 + 10;
    techLines.forEach((l, i) => doc.text(l, colStarts[2] + 6, techTop + i * 13));

    const delivTop = y + (rowHeight - delivLines.length * 13) / 2 + 10;
    delivLines.forEach((l, i) => doc.text(l, colStarts[3] + 6, delivTop + i * 13));

    const priceText = inr(it.unit_price) + (it.quantity > 1 ? ` (x${it.quantity})` : "");
    doc.text(priceText, colStarts[4] + colPrice / 2, y + rowHeight / 2 + 3.5, { align: "center" });

    doc.text(inr(it.total), colStarts[5] + colTotal - 6, y + rowHeight / 2 + 3.5, { align: "right" });

    y += rowHeight;
  });

  // ═══════════════════════════════════════════════════════════════
  // STRUCTURED TOTALS SECTION (MATCHING REFERENCE IMAGE)
  // ═══════════════════════════════════════════════════════════════
  checkPageBreak(90);

  // Subtotal Row
  const subTotalH = 34;
  doc.setDrawColor(203, 213, 225);
  doc.setLineWidth(0.5);
  doc.rect(M, y, contentW - colTotal, subTotalH, "S");
  doc.rect(colStarts[5], y, colTotal, subTotalH, "S");

  doc.setFont("times", "bold");
  doc.setFontSize(9.5);
  doc.setTextColor(30, 41, 59);
  doc.text("Sub Total :", colStarts[5] - 12, y + subTotalH / 2 + 3.5, { align: "right" });
  doc.text(inr(pricing.subtotal), M + contentW - 5, y + subTotalH / 2 + 3.5, { align: "right" });
  y += subTotalH;

  // Discount Row (if any)
  if (pricing.discount > 0) {
    const discountH = 28;
    doc.rect(M, y, contentW - colTotal, discountH, "S");
    doc.rect(colStarts[5], y, colTotal, discountH, "S");

    doc.setFont("times", "normal");
    doc.setFontSize(9);
    doc.setTextColor(220, 38, 38);
    doc.text("Discount :", colStarts[5] - 12, y + discountH / 2 + 3.5, { align: "right" });
    doc.text(`- ${inr(pricing.discount)}`, M + contentW - 8, y + discountH / 2 + 3.5, { align: "right" });
    y += discountH;
  }

  // Grand Total Row (matching reference image: "(Including 18% GST ) Grand Total :")
  const grandTotalH = 38;
  doc.rect(M, y, contentW - colTotal, grandTotalH, "S");
  doc.rect(colStarts[5], y, colTotal, grandTotalH, "S");

  doc.setFont("times", "bold");
  doc.setFontSize(9.5);
  doc.setTextColor(5, 92, 121);
  doc.text(`(Including ${pricing.tax_rate ?? 18}% GST ) Grand Total :`, colStarts[5] - 12, y + grandTotalH / 2 + 3.5, { align: "right" });
  doc.setFontSize(9.5);
  doc.text(inr(pricing.grand_total), M + contentW - 5, y + grandTotalH / 2 + 3.5, { align: "right" });
  y += grandTotalH;

  // ═══════════════════════════════════════════════════════════════
  // PAGE 2+: SCOPE OF WORK (SOW)
  // ═══════════════════════════════════════════════════════════════
  doc.addPage();
  y = 45;

  // SOW Header Banner
  doc.setTextColor(5, 92, 121);
  doc.setFont("times", "bold");
  doc.setFontSize(15);
  const sowTitle = clientCompany
    ? `SCOPE OF WORK (SOW) — ${qType.replace(" Quotation", "").toUpperCase()} FOR ${clientCompany.toUpperCase()}`
    : `SCOPE OF WORK (SOW) — ${qType.replace(" Quotation", "").toUpperCase()}`;
  doc.text(sowTitle, W / 2, y, { align: "center" });

  y += 10;
  doc.setDrawColor(5, 92, 121);
  doc.setLineWidth(1.2);
  doc.line(M, y, W - M, y);
  y += 22;

  // Render Scope Sections with detailed formatting
  scopeSections.forEach((sec, idx) => {
    checkPageBreak(65);

    doc.setTextColor(5, 92, 121);
    doc.setFont("times", "bold");
    doc.setFontSize(14);
    doc.text(formatSectionHeading(sec.title || "Section"), M, y + 12);
    y += 26;

    // Section Body Text & Bullets
    doc.setTextColor(51, 65, 85);
    doc.setFont("times", "normal");
    doc.setFontSize(9.5);

    const rawContent = String(sec.content || "");
    const lines = rawContent.split("\n").filter((l) => l.trim().length > 0);

    lines.forEach((line) => {
      const trimmed = line.trim();
      const isBullet = trimmed.startsWith("•") || trimmed.startsWith("-") || trimmed.startsWith("*") || /^\d+[\.\)]/.test(trimmed);
      const cleanLine = trimmed.replace(/^[\s•\-\*]+/, "").trim();

      const splitText = doc.splitTextToSize(cleanLine, contentW - (isBullet ? 22 : 8));
      checkPageBreak(splitText.length * 13 + 6);

      if (isBullet) {
        doc.setFillColor(5, 92, 121);
        doc.circle(M + 8, y + 6, 2, "F");
        splitText.forEach((t, i) => {
          doc.text(t, M + 18, y + 9 + i * 13);
        });
      } else {
        splitText.forEach((t, i) => {
          doc.text(t, M + 6, y + 9 + i * 13);
        });
      }
      y += splitText.length * 13 + 5;
    });

    y += 10;
  });

  // ═══════════════════════════════════════════════════════════════
  // FEATURES & TIMELINE TABLE (STRICT BOUNDARIES)
  // ═══════════════════════════════════════════════════════════════
  if (timelineItems.length > 0) {
    checkPageBreak(90);

    doc.setTextColor(5, 92, 121);
    doc.setFont("times", "bold");
    doc.setFontSize(14);
    doc.text(formatSectionHeading("Features & Project Timeline"), M, y + 12);
    y += 26;

    const tColPhase = 140;
    const tColAct = 255;
    const tColTime = contentW - tColPhase - tColAct;

    doc.setFillColor(5, 92, 121);
    doc.rect(M, y, contentW, 22, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(8.5);
    doc.text("Phase / Milestone", M + 8, y + 14);
    doc.text("Key Activities & Deliverables", M + tColPhase + 8, y + 14);
    doc.text("Estimated Timeline", M + tColPhase + tColAct + 8, y + 14);
    y += 22;

    doc.setTextColor(30, 41, 59);
    doc.setFont("times", "normal");
    doc.setFontSize(8.5);

    timelineItems.forEach((t) => {
      const pLines = doc.splitTextToSize(String(t.phase || ""), tColPhase - 16);
      const aLines = doc.splitTextToSize(String(t.key_activities || ""), tColAct - 16);
      const tLines = doc.splitTextToSize(String(t.timeline || ""), tColTime - 16);
      const rowH = Math.max(24, Math.max(pLines.length, aLines.length, tLines.length) * 12 + 10);

      checkPageBreak(rowH + 20);

      doc.setDrawColor(203, 213, 225);
      doc.setLineWidth(0.5);
      doc.rect(M, y, contentW, rowH);
      doc.line(M + tColPhase, y, M + tColPhase, y + rowH);
      doc.line(M + tColPhase + tColAct, y, M + tColPhase + tColAct, y + rowH);

      pLines.forEach((l, i) => doc.text(l, M + 8, y + 13 + i * 11));
      aLines.forEach((l, i) => doc.text(l, M + tColPhase + 8, y + 13 + i * 11));
      tLines.forEach((l, i) => doc.text(l, M + tColPhase + tColAct + 8, y + 13 + i * 11));

      y += rowH;
    });

    y += 18;
  }

  // ═══════════════════════════════════════════════════════════════
  // INCLUSIONS SECTION
  // ═══════════════════════════════════════════════════════════════
  if (inclusions.length > 0) {
    checkPageBreak(70);

    doc.setTextColor(5, 92, 121);
    doc.setFont("times", "bold");
    doc.setFontSize(14);
    doc.text(formatSectionHeading("Standard Deliverables & Inclusions"), M, y + 12);
    y += 26;

    doc.setTextColor(51, 65, 85);
    doc.setFont("times", "normal");
    doc.setFontSize(9);

    inclusions.forEach((inc) => {
      const clean = String(inc).replace(/^[\s•\-\*]+/, "").trim();
      const splitText = doc.splitTextToSize(clean, contentW - 24);
      checkPageBreak(splitText.length * 13 + 6);

      doc.setFillColor(5, 92, 121);
      doc.circle(M + 8, y + 6, 2.5, "F");
      splitText.forEach((t, i) => {
        doc.text(t, M + 18, y + 9 + i * 12);
      });
      y += splitText.length * 12 + 6;
    });

    y += 18;
  }

  // ═══════════════════════════════════════════════════════════════
  // STRUCTURED BANK DETAILS CARD
  // ═══════════════════════════════════════════════════════════════
  checkPageBreak(120);

  doc.setTextColor(5, 92, 121);
  doc.setFont("times", "bold");
  doc.setFontSize(14);
  doc.text(formatSectionHeading("Bank Account Details"), M, y + 12);
  y += 26;

  const bankBoxH = 76;
  doc.setDrawColor(203, 213, 225);
  doc.setLineWidth(0.5);
  doc.setFillColor(248, 250, 252);
  doc.rect(M, y, contentW, bankBoxH, "FD");
  doc.line(M + halfW, y, M + halfW, y + bankBoxH);

  // Left Bank Columns
  const bLeft = [
    ["Account Name", BANK_DETAILS.companyName],
    ["Bank Name", BANK_DETAILS.bankName],
    ["Account No.", BANK_DETAILS.accountNumber]
  ];
  bLeft.forEach(([lbl, val], i) => {
    const by = y + 17 + i * 20;
    doc.setFont("times", "bold");
    doc.setFontSize(8.5);
    doc.setTextColor(71, 85, 105);
    doc.text(lbl + " :", M + 12, by);
    doc.setFont("times", "normal");
    doc.setTextColor(30, 41, 59);
    doc.text(val, M + 80, by);
  });

  // Right Bank Columns
  const bRight = [
    ["IFSC Code", BANK_DETAILS.ifsc],
    ["SWIFT Code", BANK_DETAILS.swift],
    ["Branch Name", BANK_DETAILS.branch]
  ];
  bRight.forEach(([lbl, val], i) => {
    const by = y + 17 + i * 20;
    doc.setFont("times", "bold");
    doc.setFontSize(8.5);
    doc.setTextColor(71, 85, 105);
    doc.text(lbl + " :", M + halfW + 12, by);
    doc.setFont("times", "normal");
    doc.setTextColor(30, 41, 59);
    doc.text(val, M + halfW + 80, by);
  });

  y += bankBoxH + 18;

  // ═══════════════════════════════════════════════════════════════
  // TERMS & CONDITIONS (IN BORDERED CARD)
  // ═══════════════════════════════════════════════════════════════
  if (raw.terms_conditions) {
    checkPageBreak(80);

    doc.setTextColor(5, 92, 121);
    doc.setFont("times", "bold");
    doc.setFontSize(14);
    doc.text("Terms & Commercial Conditions", M, y + 12);
    y += 26;

    const termLines = doc.splitTextToSize(raw.terms_conditions, contentW - 20);
    const termBoxH = Math.max(34, termLines.length * 12 + 14);
    checkPageBreak(termBoxH + 20);

    doc.setDrawColor(203, 213, 225);
    doc.setLineWidth(0.5);
    doc.setFillColor(255, 255, 255);
    doc.rect(M, y, contentW, termBoxH, "FD");

    doc.setTextColor(71, 85, 105);
    doc.setFont("times", "normal");
    doc.setFontSize(10);
    termLines.forEach((l, i) => {
      doc.text(l, M + 10, y + 14 + i * 12);
    });
    y += termBoxH + 18;
  }

  // ═══════════════════════════════════════════════════════════════
  // STRUCTURED SIGNATURE & ACCEPTANCE CARD
  // ═══════════════════════════════════════════════════════════════
  checkPageBreak(70);
  const closingBoxH = 92;

  doc.setDrawColor(203, 213, 225);
  doc.setLineWidth(0.5);
  doc.setFillColor(248, 250, 252);
  doc.rect(M, y, contentW, closingBoxH, "FD");
  doc.line(M + halfW, y, M + halfW, y + closingBoxH);

  // Left: Client Acceptance
  doc.setFont("times", "bold");
  doc.setFontSize(10);
  doc.setTextColor(100, 116, 139);
  doc.text("Client Acceptance & Approval", M + 12, y + 16);

  doc.setFont("times", "normal");
  doc.setFontSize(8);
  doc.setTextColor(71, 85, 105);
  doc.text("Accepted & Confirmed on behalf of Client:", M + 12, y + 32);
  doc.text("Authorized Name: ____________________________", M + 12, y + 54);
  doc.text("Signature & Seal: ____________________________", M + 12, y + 74);

  // Right: Company Details
  doc.setFont("times", "bold");
  doc.setFontSize(8.5);
  doc.setTextColor(100, 116, 139);
  doc.text("FOR QIRO TECH INNOVATION PVT. LTD.", M + halfW + 12, y + 16);

  doc.setFont("times", "bold");
  doc.setFontSize(9.5);
  doc.setTextColor(5, 92, 121);
  doc.text("Authorized Signatory", M + halfW + 12, y + 32);

  doc.setFont("times", "normal");
  doc.setFontSize(8);
  doc.setTextColor(71, 85, 105);
  doc.text(`Email: ${COMPANY_DETAILS.email} | Ph: ${COMPANY_DETAILS.phone}`, M + halfW + 12, y + 54);
  doc.text(`GSTIN: ${COMPANY_DETAILS.gstin}`, M + halfW + 12, y + 74);

  y += closingBoxH + 18;

  // ═══════════════════════════════════════════════════════════════
  // PAGE NUMBERING FOOTER ON ALL PAGES
  // ═══════════════════════════════════════════════════════════════
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFont("times", "normal");
    doc.setFontSize(8);
    doc.setTextColor(148, 163, 184);
    doc.text(`Page ${i} of ${totalPages}`, W - M, H - 20, { align: "right" });
    doc.text(`Qiro Tech Innovation Pvt. Ltd. · #${qNum}`, M, H - 20);
  }

  return doc;
}

/** Legacy backwards-compatible export for existing deals view */
export function buildQuotationPdf(payload) {
  const deal = payload?.deal;
  const lead = payload?.lead;
  const preparedBy = payload?.preparedBy;

  const quotationData = {
    quotation_number: `Q-${new Date().getFullYear()}-${String(deal?.id || 1).padStart(4, "0")}`,
    quotation_type: deal?.title || "Website Quotation",
    subject: `Quotation for ${deal?.title || "Web Development"}`,
    customer_name: [lead?.first_name, lead?.last_name].filter(Boolean).join(" ") || lead?.company || "Customer",
    client_details: {
      name: [lead?.first_name, lead?.last_name].filter(Boolean).join(" ") || lead?.company || "Customer",
      company: lead?.company || "—",
      email: lead?.email || "",
      phone: lead?.phone || "",
      city: "Pune, Maharashtra"
    },
    items: [
      {
        description: deal?.title || "Web Development",
        technology: "HTML, CSS, JS, Next JS",
        deliverables: "1) Hosting, 2) Domain, 3) SSL Certificate",
        quantity: 1,
        unit_price: Number(deal?.amount || 0),
        total: Number(deal?.amount || 0)
      }
    ],
    pricing_breakdown: {
      subtotal: Number(deal?.amount || 0),
      discount: 0,
      tax_rate: 18,
      tax_amount: (Number(deal?.amount || 0) * 18) / 100,
      grand_total: Math.round(Number(deal?.amount || 0) * 1.18)
    },
    scope_sections: [
      {
        title: "Project Overview",
        content: deal?.description || "The project aims to design, develop and launch a professional, secure and user-friendly digital solution."
      },
      {
        title: "Deliverables",
        content: "• Quality assured deliverables\n• Deployment & Handover\n• Maintenance support"
      }
    ],
    inclusions: [
      "Hosting & Infrastructure setup",
      "SSL Certificate installation",
      "Technical support via WhatsApp & Email"
    ]
  };

  return buildDynamicQuotationPdf(quotationData);
}

export function quotationFileName(dealOrQuotation, lead) {
  const num = dealOrQuotation?.quotation_number || `Q-${dealOrQuotation?.id ?? ""}`;
  const name =
    [lead?.first_name, lead?.last_name].filter(Boolean).join("-") ||
    dealOrQuotation?.customer_name ||
    lead?.company ||
    "customer";
  return `Quotation-${num}-${String(name).toLowerCase().replace(/\s+/g, "-")}.pdf`;
}

/** Download the PDF, then offer the native share sheet when available. */
export async function shareQuotationPdf(payload) {
  const doc = payload?.quotation_type
    ? buildDynamicQuotationPdf(payload)
    : buildQuotationPdf(payload);

  const fileName = quotationFileName(payload?.deal || payload, payload?.lead);
  const blob = doc.output("blob");
  const file = new File([blob], fileName, { type: "application/pdf" });

  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({
        files: [file],
        title: "Quotation",
        text: `Quotation from Qiro Tech Innovation`
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
/* Tax Invoice PDF — Professional layout matching Qiro reference       */
/* ------------------------------------------------------------------ */

/** Convert number to Indian words (rupees) */
function numberToWordsINR(num) {
  if (!num || num === 0) return "Zero";
  const ones = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine",
    "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen",
    "Seventeen", "Eighteen", "Nineteen"];
  const tens = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];

  const convert = (n) => {
    if (n === 0) return "";
    if (n < 20) return ones[n] + " ";
    if (n < 100) return tens[Math.floor(n / 10)] + " " + (n % 10 ? ones[n % 10] + " " : "");
    if (n < 1000) return ones[Math.floor(n / 100)] + " Hundred " + convert(n % 100);
    if (n < 100000) return convert(Math.floor(n / 1000)) + "Thousand " + convert(n % 1000);
    if (n < 10000000) return convert(Math.floor(n / 100000)) + "Lakh " + convert(n % 100000);
    return convert(Math.floor(n / 10000000)) + "Crore " + convert(n % 10000000);
  };

  const rounded = Math.round(Math.abs(num));
  return "Rs. " + convert(rounded).replace(/\s+/g, " ").trim() + " Only";
}

/** Get financial year string e.g. "2026-27" */
function financialYear(dateStr) {
  const d = dateStr ? new Date(dateStr) : new Date();
  const month = d.getMonth(); // 0-based
  const year = d.getFullYear();
  const fy = month >= 3 ? year : year - 1; // April onwards = current FY
  return `${fy}-${String(fy + 1).slice(2)}`;
}

export function buildInvoicePdf(sale, customerName = null) {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const W = doc.internal.pageSize.getWidth();
  const M = 36;
  const contentW = W - M * 2;
  let y = 0;

  const raw = sale?.raw ?? sale ?? {};
  const invoiceNum = raw.invoice_number || sale?.id || `INV-${Date.now()}`;
  const saleDate = raw.sale_date || sale?.date || new Date().toISOString();
  const saleAmount = Number(raw.sale_amount ?? sale?.amount ?? 0);
  const discount = Number(raw.discount ?? 0);
  const tax = Number(raw.tax ?? 0);
  const finalAmount = Number(raw.final_amount ?? sale?.amount ?? (saleAmount - discount + tax));
  const paymentStatus = String(raw.payment_status ?? sale?.status ?? "PENDING").toUpperCase();
  const dealTitle = raw.deal_title || raw.product_service || "Professional Services";
  const dealAmount = Number(raw.deal_amount ?? finalAmount);

  // Client details from lead join
  const clientName = customerName
    || [raw.lead_first_name, raw.lead_last_name].filter(Boolean).join(" ")
    || raw.customer_code
    || "Valued Customer";
  const clientCompany = raw.lead_company || "";
  const clientPhone = raw.lead_phone || "";

  // Format invoice number for display: QTIPL/YYYY-YY/XXXX
  const fy = financialYear(saleDate);
  const invSeq = invoiceNum.replace(/\D/g, "").slice(-4).padStart(4, "0");
  const displayInvoiceNo = `QTIPL/${fy}/${invSeq}`;

  // Format date as YYYY-MM-DD
  const dateObj = new Date(saleDate);
  const formattedDate = `${dateObj.getFullYear()}-${String(dateObj.getMonth() + 1).padStart(2, "0")}-${String(dateObj.getDate()).padStart(2, "0")}`;

  // GST calculations (18% total = CGST 9% + SGST 9%)
  const taxableAmount = saleAmount - discount;
  const cgstRate = 9;
  const sgstRate = 9;
  const cgstAmt = Math.round(taxableAmount * cgstRate / 100);
  const sgstAmt = Math.round(taxableAmount * sgstRate / 100);
  const totalRounded = Math.round(taxableAmount + cgstAmt + sgstAmt);
  const gstTotal = cgstAmt + sgstAmt;
  const invoiceAmount = (amount) => `${Number(amount || 0).toLocaleString("en-IN")}`;

  // Dark teal theme (matches reference)
  const tealR = 5, tealG = 92, tealB = 121;

  // Helper: draw bordered cell
  const drawCell = (x, cy, w, h, opts = {}) => {
    doc.setDrawColor(0, 0, 0);
    doc.setLineWidth(0.5);
    if (opts.fill) {
      doc.setFillColor(...(opts.fillColor || [5, 92, 121]));
      doc.rect(x, cy, w, h, "FD");
    } else {
      doc.rect(x, cy, w, h, "S");
    }
  };

  // ═══════════════════════════════════════════════════════════════
  // TAX INVOICE title bar
  // ═══════════════════════════════════════════════════════════════
  y = M;
  const titleH = 22;
  drawCell(M, y, contentW, titleH, { fill: true, fillColor: [5, 92, 121] });
  doc.setFont("times", "bold");
  doc.setFontSize(11);
  doc.setTextColor(255, 255, 255);
  doc.text("TAX INVOICE", W / 2, y + 15, { align: "center" });

  doc.setFontSize(7);
  doc.setTextColor(30, 30, 30);
  doc.text("ORIGINAL FOR RECIPIENT", W - M, y + 8, { align: "right" });

  y += titleH;

  // ═══════════════════════════════════════════════════════════════
  // Company header block
  // ═══════════════════════════════════════════════════════════════
  const compH = 68;
  drawCell(M, y, contentW, compH);

  doc.setTextColor(5, 92, 121);
  doc.setFont("times", "bold");
  doc.setFontSize(16);
  doc.text("QIRO TECH INNOVATION PVT. LTD.", W / 2, y + 22, { align: "center" });

  doc.setFont("times", "normal");
  doc.setFontSize(7);
  doc.setTextColor(60, 60, 60);
  doc.text(
    "OFFICE NO 602, 6TH FLOOR, THE BUSINESS ADVANTEDGE, NEAR LAXMI CHOWK, MARUNJI ROAD, HINJAWADI PHASE I, HINJAWADI, PUNE 411057",
    W / 2, y + 37, { align: "center" }
  );
  doc.text(
    `Email: ${COMPANY_DETAILS.email} | Ph: ${COMPANY_DETAILS.phone}`,
    W / 2, y + 49, { align: "center" }
  );
  doc.text(`GSTIN: ${COMPANY_DETAILS.gstin}`, W / 2, y + 59, { align: "center" });

  y += compH;

  // ═══════════════════════════════════════════════════════════════
  // Client Details (left) | Invoice Metadata (right)
  // ═══════════════════════════════════════════════════════════════
  const detailH = 120;
  const halfW = contentW / 2;

  drawCell(M, y, halfW, detailH);
  drawCell(M + halfW, y, halfW, detailH);

  doc.setFont("times", "normal");
  doc.setFontSize(8);
  doc.setTextColor(30, 30, 30);

  let ly = y + 16;
  const labelX = M + 8;
  const valLX = M + 72;

  // Client Name
  doc.setFont("times", "bold");
  doc.setFontSize(8);
  doc.text("Client Name :", labelX, ly);
  doc.setFontSize(9);
  doc.text(String(clientCompany || clientName).toUpperCase(), valLX, ly);

  // Address (placeholder — lead address not stored)
  ly += 16;
  doc.setFontSize(8);
  doc.text("Address :", labelX, ly);
  doc.setFont("times", "normal");

  // Mobile
  ly += 30;
  doc.setFont("times", "bold");
  doc.setFontSize(8);
  doc.text("Mobile No. :", labelX, ly);
  doc.setFont("times", "normal");
  doc.text(String(clientPhone), valLX, ly);

  // Pincode
  ly += 14;
  doc.setFont("times", "bold");
  doc.text("Pincode :", labelX, ly);

  // GSTIN
  ly += 14;
  doc.setFont("times", "bold");
  doc.text("GSTIN :", labelX, ly);

  // Right column — Invoice metadata
  const rLabelX = M + halfW + 8;
  const rValX = M + halfW + 90;
  let ry = y + 16;

  doc.setFont("times", "bold");
  doc.setFontSize(8);
  doc.text("Invoice Date :", rLabelX, ry);
  doc.setFont("times", "normal");
  doc.text(formattedDate, rValX, ry);

  ry += 16;
  doc.setFont("times", "bold");
  doc.text("Invoice No :", rLabelX, ry);
  doc.setFont("times", "normal");
  doc.text(displayInvoiceNo, rValX, ry);

  ry += 16;
  doc.setFont("times", "bold");
  doc.text("State Name :", rLabelX, ry);
  doc.setFont("times", "normal");
  doc.text("Maharashtra", rValX, ry);

  ry += 16;
  doc.setFont("times", "bold");
  doc.text("State Code :", rLabelX, ry);
  doc.setFont("times", "normal");
  doc.text("MH", rValX, ry);

  ry += 16;
  doc.setFont("times", "bold");
  doc.text("Place of Supply :", rLabelX, ry);
  doc.setFont("times", "normal");
  doc.text("Maharashtra (27)", rValX, ry);

  y += detailH;

  // ═══════════════════════════════════════════════════════════════
  // Items table header
  // ═══════════════════════════════════════════════════════════════
  const colSN = 35;
  const colHSN = 65;
  const colQTY = 50;
  const colRate = 70;
  const colAmt = 80;
  const colDesc = contentW - colSN - colHSN - colQTY - colRate - colAmt;
  const thH = 22;

  let tx = M;
  const colStarts = [
    tx,
    tx + colSN,
    tx + colSN + colDesc,
    tx + colSN + colDesc + colHSN,
    tx + colSN + colDesc + colHSN + colQTY,
    tx + colSN + colDesc + colHSN + colQTY + colRate
  ];
  const colWidths = [colSN, colDesc, colHSN, colQTY, colRate, colAmt];
  const colLabels = ["S.N.", "DESCRIPTION", "HSN/SAC", "QTY", "RATE", "AMOUNT"];

  colStarts.forEach((cx, i) => {
    drawCell(cx, y, colWidths[i], thH, { fill: true, fillColor: [230, 240, 240] });
  });

  doc.setFont("times", "bold");
  doc.setFontSize(8);
  doc.setTextColor(30, 30, 30);
  colStarts.forEach((cx, i) => {
    doc.text(colLabels[i], cx + colWidths[i] / 2, y + 14, { align: "center" });
  });

  y += thH;

  // ═══════════════════════════════════════════════════════════════
  // Item data row
  // ═══════════════════════════════════════════════════════════════
  const itemDesc = dealTitle;
  const descLines = doc.splitTextToSize(String(itemDesc), colDesc - 16);
  const itemRowH = Math.max(70, descLines.length * 12 + 20);

  colStarts.forEach((cx, i) => drawCell(cx, y, colWidths[i], itemRowH));

  doc.setFont("times", "normal");
  doc.setFontSize(8);
  doc.setTextColor(30, 30, 30);
  doc.text("1", colStarts[0] + colSN / 2, y + 16, { align: "center" });
  descLines.forEach((line, i) => doc.text(line, colStarts[1] + 8, y + 16 + i * 12));
  doc.text("1", colStarts[3] + colQTY / 2, y + 16, { align: "center" });
  if (taxableAmount > 0) {
    doc.text(inr(taxableAmount), colStarts[4] + colRate - 6, y + 16, { align: "right" });
    doc.text(inr(taxableAmount), colStarts[5] + colAmt - 6, y + 16, { align: "right" });
  }

  y += itemRowH;

  // ═══════════════════════════════════════════════════════════════
  // GST Summary rows
  // ═══════════════════════════════════════════════════════════════
  const summX = colStarts[4];
  const summLabelW = colRate;
  const summAmtW = colAmt;
  const leftSpanW = colSN + colDesc + colHSN + colQTY;

  const summaryRows = [
    { label: "TAXABLE AMOUNT", amount: taxableAmount },
    { label: `CGST @${cgstRate}%`, amount: cgstAmt },
    { label: `SGST @${sgstRate}%`, amount: sgstAmt },
    { label: "TOTAL (ROUNDED)", amount: totalRounded, bold: true, icon: true }
  ];

  const leftLabels = [
    "",
    `GST Amount : ${numberToWordsINR(gstTotal)}`,
    "",
    `Invoice Value : ${numberToWordsINR(totalRounded)}`
  ];

  summaryRows.forEach((row, i) => {
    const rowH = row.bold ? 28 : 22;
    drawCell(M, y, leftSpanW, rowH);
    drawCell(summX, y, summLabelW, rowH, row.bold ? { fill: true, fillColor: [230, 240, 240] } : {});
    drawCell(summX + summLabelW, y, summAmtW, rowH);

    if (leftLabels[i]) {
      doc.setFont("times", "bold");
      doc.setFontSize(8);
      doc.setTextColor(30, 30, 30);
      doc.text(leftLabels[i], M + 8, y + 13);
    }

    doc.setFont("times", row.bold ? "bold" : "normal");
    doc.setFontSize(8);
    doc.setTextColor(30, 30, 30);
    const labelLines = doc.splitTextToSize(row.label, summLabelW - 10);
    labelLines.forEach((line, lineIndex) => {
      doc.text(line, summX + 5, y + 10 + lineIndex * 9);
    });

    if (row.amount > 0) {
      doc.setFont("times", "normal");
      doc.setFontSize(8);
      doc.setTextColor(30, 30, 30);
      doc.text(invoiceAmount(row.amount), summX + summLabelW + summAmtW - 5, y + rowH / 2 + 3, { align: "right" });
    }

    y += rowH;
  });

  // ═══════════════════════════════════════════════════════════════
  // Bank Details (left) | Grand Total / Deal / Bill (right)
  // ═══════════════════════════════════════════════════════════════
  const bankSectionH = 120;
  const totalsW = summLabelW + summAmtW;

  drawCell(M, y, leftSpanW, bankSectionH);

  doc.setFont("times", "bold");
  doc.setFontSize(8);
  doc.setTextColor(30, 30, 30);
  doc.text("BANK ACCOUNT DETAILS", M + 8, y + 16);

  doc.setFont("times", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(30, 30, 30);

  const bankLines = [
    ["Account Name", BANK_DETAILS.companyName],
    ["Bank Name", BANK_DETAILS.bankName],
    ["Account No.", BANK_DETAILS.accountNumber],
    ["IFSC Code", BANK_DETAILS.ifsc],
    ["SWIFT Code", BANK_DETAILS.swift],
    ["Branch Name", BANK_DETAILS.branch]
  ];

  let by = y + 30;
  bankLines.forEach(([lbl, val]) => {
    doc.setFont("times", "bold");
    doc.text(lbl, M + 8, by);
    doc.setFont("times", "normal");
    doc.text(`: ${val}`, M + 78, by);
    by += 13;
  });

  by += 4;
  doc.setFont("times", "bold");
  doc.setFontSize(8);
  doc.text("Payment Status :", M + 8, by);
  if (paymentStatus === "PAID") {
    doc.setTextColor(22, 163, 74);
    doc.text("FULLY PAID", M + 90, by);
  } else if (paymentStatus === "PARTIAL") {
    doc.setTextColor(234, 88, 12);
    doc.text("PARTIALLY PAID", M + 90, by);
  } else {
    doc.setTextColor(220, 38, 38);
    doc.text("PENDING", M + 90, by);
  }
  doc.setTextColor(30, 30, 30);

  // Right side — Grand TOTAL
  const totalRowH = 30;
  const grandTotalY = y;
  drawCell(summX, grandTotalY, totalsW, totalRowH);
  doc.setFont("times", "bold");
  doc.setFontSize(8);
  doc.setTextColor(30, 30, 30);
  doc.text("Grand TOTAL :", summX + 6, grandTotalY + 13);
  doc.setTextColor(30, 30, 30);
  doc.setFontSize(8);
  doc.text(invoiceAmount(totalRounded), summX + totalsW - 5, grandTotalY + 13, { align: "right" });

  // TOTAL PROJECT DEAL
  const dealRowY = grandTotalY + totalRowH;
  drawCell(summX, dealRowY, totalsW, totalRowH + 6);
  doc.setFont("times", "bold");
  doc.setFontSize(8);
  doc.setTextColor(30, 30, 30);
  doc.text("TOTAL PROJECT", summX + 6, dealRowY + 11);
  doc.text("DEAL :", summX + 6, dealRowY + 22);
  doc.setTextColor(30, 30, 30);
  doc.text(invoiceAmount(dealAmount), summX + totalsW - 5, dealRowY + 17, { align: "right" });

  // Current Bill Amount
  const billRowY = dealRowY + totalRowH + 6;
  const billRowH = bankSectionH - totalRowH - (totalRowH + 6);
  drawCell(summX, billRowY, totalsW, billRowH);
  doc.setFont("times", "bold");
  doc.setFontSize(8);
  doc.setTextColor(30, 30, 30);
  const billLabelLines = doc.splitTextToSize("Current Bill Amount :", summLabelW - 10);
  billLabelLines.forEach((line, lineIndex) => {
    doc.text(line, summX + 6, billRowY + 12 + lineIndex * 10);
  });
  doc.setTextColor(30, 30, 30);
  doc.text(invoiceAmount(finalAmount), summX + totalsW - 5, billRowY + 14, { align: "right" });

  y += bankSectionH;

  // ═══════════════════════════════════════════════════════════════
  // Footer
  // ═══════════════════════════════════════════════════════════════
  y += 16;
  doc.setFont("times", "normal");
  doc.setFontSize(7);
  doc.setTextColor(120, 120, 120);
  doc.text("This is a system-generated invoice by Qiro CRM. Subject to Pune, Maharashtra jurisdiction.", M, y);
  y += 10;
  doc.text("Terms: Payment is due as per agreed commercial terms. All disputes subject to Pune jurisdiction.", M, y);

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
