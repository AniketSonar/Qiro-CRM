import { jsPDF } from "jspdf";
import { QIRO_LOGO_BASE64 } from "./qiroLogo.js";

/* ------------------------------------------------------------------ */
/* Shared layout for Proforma Invoice and Tax Invoice PDFs             */
/* Follows the Zylker-style reference: logo + company block, centred   */
/* title, Bill To / Ship To, meta table, item table, totals with a     */
/* Balance Due bar, terms — plus bank details, regards, company block  */
/* and a dedicated SIGN & STAMP area (as in Qiro's reference PDF).     */
/* ------------------------------------------------------------------ */

const ACCENT = [184, 98, 20];
const DARK = [40, 40, 40];
const GREY = [110, 110, 110];
const ROW_BG = [244, 244, 244];
const LINE = [215, 215, 215];

export const QIRO_COMPANY = {
  shortName: "Qiro Tech Innovation Pvt. Ltd.",
  legalName: "Qiro Tech Innovation Pvt Ltd.",
  gstin: "27AABCQ2268A1ZR",
  email: "commercial@qirotec.com",
  phone: "+91 9113882782",
  headerAddress: [
    "Office No 602, 6th Floor, The Business AdvantEdge,",
    "Near Laxmi Chowk, Marunji Road, Hinjawadi Phase I,",
    "Pune, Maharashtra 411057"
  ],
  footerAddress: [
    "OFFICE NO 602, 6TH FLOOR, THE BUSINESS ADVANTEDGE,",
    "NEAR LAXMICHOWK, MARUNJI ROAD,",
    "HINJAWADI PHASE I, HINJEWADI, PUNE 411057"
  ]
};

export const QIRO_SIGNATORY = { name: "Kavya Nandi", phone: "+91 9113882782" };

export const money = (n) =>
  Number(n || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export const fmtLong = (d) =>
  new Date(d).toLocaleDateString("en-GB", { day: "2-digit", month: "long", year: "numeric" });

/**
 * spec = {
 *   title,                       // "PROFORMA INVOICE" | "TAX INVOICE"
 *   meta: [[label, value], ...], // right-hand table (max ~5 rows)
 *   billTo: { name, lines: [] },
 *   shipTo: { name, lines: [] } | null,
 *   items: [{ description, sub: [], qty, rate, amount }],
 *   totals: [{ label, value }],  // normal rows
 *   total: { label, value },     // bold row under a rule
 *   due: { label, value },       // coloured bar
 *   notes: [],                   // lines under "Thanks for your business."
 *   terms: { title, lines: [] },
 *   bank: [[label, value], ...],
 *   footerText
 * }
 */
export function renderDocument(spec) {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const M = 36;
  const contentW = W - M * 2;
  const bottom = H - 60;
  let y = 0;

  const setText = (font, size, color) => {
    doc.setFont("helvetica", font);
    doc.setFontSize(size);
    doc.setTextColor(...color);
  };
  const hline = (yy, x1 = M, x2 = W - M) => {
    doc.setDrawColor(...LINE);
    doc.setLineWidth(0.6);
    doc.line(x1, yy, x2, yy);
  };
  const newPage = () => {
    doc.addPage();
    y = 44;
  };

  // ─── Header: logo (left) + company block (right) ───
  doc.addImage(QIRO_LOGO_BASE64, "PNG", M, 30, 165, 49.4);
  setText("bold", 11, ACCENT);
  doc.text(QIRO_COMPANY.shortName, W - M, 42, { align: "right" });
  setText("normal", 9, GREY);
  [...QIRO_COMPANY.headerAddress, `${QIRO_COMPANY.email} | ${QIRO_COMPANY.phone}`].forEach((l, i) =>
    doc.text(l, W - M, 58 + i * 13.5, { align: "right" })
  );

  // ─── Title with side rules ───
  y = 138;
  setText("normal", 17, ACCENT);
  doc.text(spec.title, W / 2, y, { align: "center" });
  const tw = doc.getTextWidth(spec.title);
  hline(y - 6, M, W / 2 - tw / 2 - 12);
  hline(y - 6, W / 2 + tw / 2 + 12, W - M);

  // ─── Bill To / Ship To (left) ───
  const addrBlock = (label, party, top, accentName) => {
    let yy = top;
    setText("normal", 11, DARK);
    doc.text(label, M, yy);
    yy += 15;
    if (accentName) {
      setText("bold", 10.5, ACCENT);
      doc.text(doc.splitTextToSize(party.name, 250)[0], M, yy);
      yy += 15;
    }
    setText("normal", 9.5, GREY);
    const lines = accentName ? party.lines : [party.name, ...party.lines];
    lines.filter(Boolean).forEach((l) => {
      doc.text(doc.splitTextToSize(String(l), 250)[0], M, yy);
      yy += 14;
    });
    return yy;
  };
  const topY = 176;
  let leftEnd = addrBlock("Bill To", spec.billTo, topY, true);
  if (spec.shipTo) leftEnd = addrBlock("Ship To", spec.shipTo, leftEnd + 10, false);

  // ─── Meta table (right) ───
  const metaW = 222;
  const metaX = W - M - metaW;
  const labelW = 92;
  const rowH = 25;
  spec.meta.forEach(([label, value], i) => {
    const ry = topY - 12 + i * rowH;
    doc.setFillColor(...ACCENT);
    doc.rect(metaX, ry, labelW, rowH, "F");
    doc.setDrawColor(255, 255, 255);
    doc.setLineWidth(0.4);
    doc.line(metaX, ry + rowH, metaX + labelW, ry + rowH);
    doc.setDrawColor(...LINE);
    doc.setLineWidth(0.5);
    doc.rect(metaX + labelW, ry, metaW - labelW, rowH, "S");
    setText("normal", 8.5, [255, 255, 255]);
    doc.text(String(label), metaX + 7, ry + 15.5);
    setText("normal", 8.5, DARK);
    doc.text(doc.splitTextToSize(String(value ?? ""), metaW - labelW - 14)[0], metaX + labelW + 8, ry + 15.5);
  });
  y = Math.max(leftEnd, topY - 12 + spec.meta.length * rowH) + 24;

  // ─── Items table ───
  const cols = { sr: 34, qty: 60, rate: 72, amt: 78 };
  cols.desc = contentW - cols.sr - cols.qty - cols.rate - cols.amt;
  const cx = [M, M + cols.sr, M + cols.sr + cols.desc, M + cols.sr + cols.desc + cols.qty, M + cols.sr + cols.desc + cols.qty + cols.rate];

  const drawTableHead = () => {
    doc.setFillColor(...ACCENT);
    doc.rect(M, y, contentW, 24, "F");
    doc.setDrawColor(255, 255, 255);
    doc.setLineWidth(0.6);
    [cx[2], cx[3], cx[4]].forEach((x) => doc.line(x, y, x, y + 24));
    setText("normal", 8.5, [255, 255, 255]);
    doc.text("S.N.", cx[0] + 9, y + 15);
    doc.text("Item & Description", cx[1] + 9, y + 15);
    doc.text("Qty", cx[3] - 9, y + 15, { align: "right" });
    doc.text("Rate", cx[4] - 9, y + 15, { align: "right" });
    doc.text("Amount", M + contentW - 9, y + 15, { align: "right" });
    y += 24;
  };
  drawTableHead();

  spec.items.forEach((it, idx) => {
    const descLines = doc.splitTextToSize(String(it.description || ""), cols.desc - 18);
    const subLines = (it.sub || []).flatMap((l) => doc.splitTextToSize(String(l), cols.desc - 18));
    const h = Math.max(54, (descLines.length + subLines.length) * 13 + 26);
    if (y + h > bottom) {
      newPage();
      drawTableHead();
    }
    doc.setFillColor(...ROW_BG);
    doc.rect(M, y, contentW, h, "F");
    doc.setDrawColor(...LINE);
    doc.setLineWidth(0.5);
    doc.line(M, y + h, M + contentW, y + h);
    doc.line(M, y, M, y + h);
    doc.line(M + contentW, y, M + contentW, y + h);
    [cx[2], cx[3], cx[4]].forEach((x) => doc.line(x, y, x, y + h));

    setText("normal", 9, DARK);
    doc.text(String(idx + 1), cx[0] + 9, y + 21);
    doc.text(descLines, cx[1] + 9, y + 21);
    setText("normal", 8.5, GREY);
    doc.text(subLines, cx[1] + 9, y + 21 + descLines.length * 13);
    setText("normal", 9, DARK);
    doc.text(Number(it.qty ?? 1).toFixed(2), cx[3] - 9, y + 21, { align: "right" });
    doc.text(money(it.rate), cx[4] - 9, y + 21, { align: "right" });
    doc.text(money(it.amount), M + contentW - 9, y + 21, { align: "right" });
    y += h;
  });

  // ─── Notes (left) + totals (right) ───
  y += 22;
  const totalsH = spec.totals.length * 26 + 26 + 34;
  if (y + totalsH > bottom) newPage();
  const totalsTop = y;
  setText("normal", 8.5, GREY);
  doc.text("Thanks for your business.", M, y);
  (spec.notes || []).forEach((n, i) => {
    doc.splitTextToSize(String(n), 250).forEach((l, j) => doc.text(l, M, y + 14 + (i + j) * 11));
  });

  const tx = W - M - 232;
  const row = (label, value, bold = false) => {
    setText(bold ? "bold" : "normal", bold ? 10.5 : 9, DARK);
    doc.text(label, bold ? tx + 125 : tx + 8, y + 3, { align: bold ? "right" : "left" });
    doc.text(value, W - M - 10, y + 3, { align: "right" });
    y += 26;
  };
  spec.totals.forEach((t) => row(t.label, t.value));
  hline(y - 11, tx, W - M);
  y += 2;
  row(spec.total.label, spec.total.value, true);

  doc.setFillColor(...ACCENT);
  doc.rect(tx - 30, y - 8, 262, 26, "F");
  setText("bold", 10, [255, 255, 255]);
  doc.text(spec.due.label, tx + 8, y + 9);
  doc.text(spec.due.value, W - M - 10, y + 9, { align: "right" });
  y += 18;

  // Terms & Conditions (left, beside Balance Due)
  const noteBottom = totalsTop + 14 + (spec.notes || []).length * 11 + 20;
  const ty = Math.max(y - 10, noteBottom);
  setText("normal", 10, DARK);
  doc.text(spec.terms.title, M, ty);
  setText("normal", 8.5, GREY);
  spec.terms.lines.forEach((l, i) => doc.text(doc.splitTextToSize(String(l), 260)[0], M, ty + 14 + i * 12));
  y = ty + 14 + spec.terms.lines.length * 12 + 12;
  hline(y);
  y += 18;

  // ─── Closing block (as in the reference PDF) ───
  // Bank details on top; below them a signing row: Regards / name / number on
  // the LEFT, company name / GST / address on the RIGHT (right-aligned), and
  // the SIGN & STAMP space left open between the two.
  const closingH = 24 + spec.bank.length * 13.5 + 128;
  if (y + closingH > H - 48) newPage();
  const rx = W - M; // right edge

  // Bank details
  let ly = y;
  setText("bold", 9.5, ACCENT);
  doc.text("Bank Details", M, ly);
  ly += 15;
  spec.bank.forEach(([k, v]) => {
    setText("bold", 8, DARK);
    doc.text(k, M, ly);
    setText("normal", 8, DARK);
    const vl = doc.splitTextToSize(String(v), 300);
    doc.text(vl, M + 78, ly);
    ly += 11.5 * vl.length + 1.5;
  });

  // Signing row
  const rowTop = ly + 16;

  // Left — Regards, name, number
  let ny = rowTop;
  setText("bold", 8.5, DARK);
  doc.text("Regards,", M, ny);
  ny += 34;
  doc.text(QIRO_SIGNATORY.name, M, ny);
  ny += 11;
  setText("normal", 8.5, DARK);
  doc.text(QIRO_SIGNATORY.phone, M, ny);

  // Right — company name, GST, address (right-aligned)
  let cy = rowTop;
  setText("bold", 9, DARK);
  doc.text(QIRO_COMPANY.legalName, rx, cy, { align: "right" });
  cy += 12;
  setText("normal", 8.5, DARK);
  doc.text(`GST Number: ${QIRO_COMPANY.gstin}`, rx, cy, { align: "right" });
  cy += 52; // open gap after the GST number for the company stamp
  setText("normal", 7.5, GREY);
  QIRO_COMPANY.footerAddress.forEach((l) => {
    doc.text(l, rx, cy, { align: "right" });
    cy += 9.5;
  });

  // Space between the left and right text is intentionally left blank for signature & stamp.

  // ─── Footer on every page ───
  const pages = doc.getNumberOfPages();
  for (let p = 1; p <= pages; p++) {
    doc.setPage(p);
    hline(H - 44);
    setText("normal", 7.5, [150, 150, 150]);
    doc.text(spec.footerText, M, H - 30);
    if (pages > 1) doc.text(`Page ${p} of ${pages}`, W - M, H - 30, { align: "right" });
  }

  return doc;
}

export async function sharePdf(doc, fileName, title, text) {
  const file = new File([doc.output("blob")], fileName, { type: "application/pdf" });
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title, text });
      return "shared";
    } catch {
      /* fall through to download */
    }
  }
  doc.save(fileName);
  return "downloaded";
}
