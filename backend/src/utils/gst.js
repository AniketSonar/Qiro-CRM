/**
 * Shared GST calculation helper used by both the Quotations module and the
 * Sales / Invoices module so the numbers always match between the two.
 *
 * Modes:
 *  - NONE      : No GST is charged at all.
 *  - EXCLUSIVE : GST is calculated on top of the (subtotal - discount) amount.
 *  - INCLUSIVE : The (subtotal - discount) amount already contains GST; the
 *                taxable value and GST are extracted out of it.
 *
 * GST is always split into CGST + SGST (each half of the total rate), which
 * is the standard intra-state Indian GST split.
 */

const VALID_MODES = ["NONE", "EXCLUSIVE", "INCLUSIVE"];

function round2(n) {
    return Math.round((Number(n) || 0) * 100) / 100;
}

/**
 * @param {number} subtotal   Sum of line items before discount.
 * @param {number} discount   Flat discount amount (currency, not %).
 * @param {string} gstMode    "NONE" | "EXCLUSIVE" | "INCLUSIVE"
 * @param {number} gstRate    Total GST rate in % (e.g. 18). Split evenly into CGST + SGST.
 */
function computeGstBreakdown(subtotal, discount, gstMode, gstRate) {
    const mode = VALID_MODES.includes(String(gstMode || "").toUpperCase())
        ? String(gstMode).toUpperCase()
        : "EXCLUSIVE";

    const rate = Number(gstRate) >= 0 ? Number(gstRate) : 18;
    const discountAmt = Math.max(0, Number(discount) || 0);
    const preTax = Math.max(0, (Number(subtotal) || 0) - discountAmt);

    let taxableAmount = preTax;
    let taxAmount = 0;
    let grandTotal = preTax;

    if (mode === "NONE") {
        taxableAmount = preTax;
        taxAmount = 0;
        grandTotal = preTax;
    } else if (mode === "INCLUSIVE") {
        grandTotal = preTax;
        taxableAmount = rate > 0 ? grandTotal / (1 + rate / 100) : grandTotal;
        taxAmount = grandTotal - taxableAmount;
    } else {
        // EXCLUSIVE (default) — GST added on top of the taxable value
        taxableAmount = preTax;
        taxAmount = (preTax * rate) / 100;
        grandTotal = preTax + taxAmount;
    }

    const cgstRate = mode === "NONE" ? 0 : round2(rate / 2);
    const sgstRate = mode === "NONE" ? 0 : round2(rate / 2);
    const cgstAmount = round2(taxAmount / 2);
    const sgstAmount = round2(taxAmount / 2);

    return {
        gst_mode: mode,
        tax_rate: rate,
        discount: discountAmt,
        subtotal: round2(subtotal),
        cgst_rate: cgstRate,
        sgst_rate: sgstRate,
        taxable_amount: round2(taxableAmount),
        tax_amount: round2(taxAmount),
        cgst_amount: cgstAmount,
        sgst_amount: sgstAmount,
        grand_total: Math.round(grandTotal)
    };
}

module.exports = { computeGstBreakdown, VALID_MODES, round2 };
