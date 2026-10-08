const pool = require("../config/db");
const { computeGstBreakdown, round2 } = require("../utils/gst");


// Generate invoice number
const generateInvoiceNumber = () => {
    const timestamp = Date.now();

    return `INV-${timestamp}`;
};

const PAYMENT_STATUSES = ["UNPAID", "PARTIAL", "PAID", "REFUNDED"];
const IMAGE_DATA_URL = /^data:image\/(?:png|jpe?g|webp);base64,[A-Za-z0-9+/=\s]+$/i;
const MAX_IMAGE_DATA_URL_LENGTH = 700000;

function validateInvoiceImage(value, label) {
    if (value === undefined || value === null || value === "") return null;
    if (typeof value !== "string" || value.length > MAX_IMAGE_DATA_URL_LENGTH || !IMAGE_DATA_URL.test(value)) {
        throw new Error(`${label} must be a PNG, JPG, or WEBP image smaller than 500 KB`);
    }
    return value;
}

function resolvePayment(total, requestedStatus, requestedAmount) {
    const invoiceTotal = Math.max(0, Number(total) || 0);
    const normalizedStatus = String(requestedStatus || "UNPAID").toUpperCase();
    const status = normalizedStatus === "PENDING"
        ? "UNPAID"
        : normalizedStatus === "CANCELLED"
            ? "REFUNDED"
            : normalizedStatus;

    if (!PAYMENT_STATUSES.includes(status)) {
        throw new Error("Invalid payment status");
    }

    let amountPaid = requestedAmount === undefined
        ? 0
        : Number(requestedAmount);

    if (!Number.isFinite(amountPaid) || amountPaid < 0) {
        throw new Error("Amount paid cannot be negative");
    }

    if (status === "PAID") amountPaid = invoiceTotal;
    if (status === "UNPAID") amountPaid = 0;
    if (amountPaid > invoiceTotal) {
        throw new Error("Amount paid cannot exceed the invoice total");
    }

    const effectiveStatus = status === "REFUNDED"
        ? status
        : amountPaid >= invoiceTotal && invoiceTotal > 0
            ? "PAID"
            : amountPaid > 0
                ? "PARTIAL"
                : "UNPAID";

    return {
        paymentStatus: effectiveStatus,
        amountPaid: round2(amountPaid),
        balanceDue: round2(Math.max(invoiceTotal - amountPaid, 0))
    };
}


// CREATE SALE
const createSale = async (req, res) => {
    const client = await pool.connect();

    try {
        const {
            customer_id,
            deal_id,
            assigned_to,
            invoice_number,
            product_service,
            description,
            sale_amount,
            discount = 0,
            tax = 0,
            gst_mode,
            gst_rate = 18,
            payment_status = "UNPAID",
            amount_paid = 0,
            payment_method,
            sale_date,
            notes,
            signature_image,
            stamp_image
        } = req.body || {};

        if (!customer_id) {
            return res.status(400).json({
                success: false,
                message: "customer_id is required"
            });
        }

        if (!product_service || !product_service.trim()) {
            return res.status(400).json({
                success: false,
                message: "product_service is required"
            });
        }

        if (
            sale_amount === undefined ||
            sale_amount === null ||
            Number(sale_amount) < 0
        ) {
            return res.status(400).json({
                success: false,
                message: "Valid sale_amount is required"
            });
        }

        if (Number(discount) < 0 || Number(tax) < 0) {
            return res.status(400).json({
                success: false,
                message: "Discount and tax cannot be negative"
            });
        }

        let signatureImage;
        let stampImage;
        try {
            signatureImage = validateInvoiceImage(signature_image, "Signature");
            stampImage = validateInvoiceImage(stamp_image, "Stamp");
        } catch (error) {
            return res.status(400).json({ success: false, message: error.message });
        }
        if (!signatureImage || !stampImage) {
            return res.status(400).json({
                success: false,
                message: "Signature and stamp are required to create an invoice"
            });
        }

        // GST-mode aware calculation. When gst_mode is supplied (No GST /
        // Exclusive / Inclusive) we derive tax + CGST/SGST split from the
        // sale amount; otherwise we fall back to the legacy manual "tax"
        // field so older API calls keep working unchanged.
        let finalGstMode = gst_mode || "EXCLUSIVE";
        let finalGstRate = Number(gst_rate) >= 0 ? Number(gst_rate) : 18;
        let finalTax = Number(tax) || 0;
        let cgstAmount = round2(finalTax / 2);
        let sgstAmount = round2(finalTax / 2);
        let finalAmount;

        if (gst_mode !== undefined) {
            const breakdown = computeGstBreakdown(
                Number(sale_amount) || 0,
                Number(discount) || 0,
                finalGstMode,
                finalGstRate
            );
            finalGstMode = breakdown.gst_mode;
            finalTax = breakdown.tax_amount;
            cgstAmount = breakdown.cgst_amount;
            sgstAmount = breakdown.sgst_amount;
            finalAmount = breakdown.grand_total;
        } else {
            finalAmount =
                Number(sale_amount) -
                Number(discount) +
                finalTax;
        }

        if (finalAmount < 0) {
            return res.status(400).json({
                success: false,
                message: "Final amount cannot be negative"
            });
        }

        const finalAssignedTo =
            assigned_to || req.user.id;

        await client.query("BEGIN");


        // Check customer
        const customerResult = await client.query(
            `
            SELECT *
            FROM customers
            WHERE id = $1
            `,
            [customer_id]
        );

        if (customerResult.rows.length === 0) {

            await client.query("ROLLBACK");

            return res.status(404).json({
                success: false,
                message: "Customer not found"
            });
        }

        const customer =
            customerResult.rows[0];


        // Sales Person ownership
        if (
            req.user.role === "SALES_PERSON" &&
            Number(customer.assigned_to) !== Number(req.user.id)
        ) {

            await client.query("ROLLBACK");

            return res.status(403).json({
                success: false,
                message:
                    "You can only create sales for your assigned customers"
            });
        }


        // Check deal
        if (deal_id) {

            const dealResult = await client.query(
                `
                SELECT *
                FROM deals
                WHERE id = $1
                `,
                [deal_id]
            );

            if (dealResult.rows.length === 0) {

                await client.query("ROLLBACK");

                return res.status(404).json({
                    success: false,
                    message: "Deal not found"
                });
            }

            const deal = dealResult.rows[0];

            // Deal must be won
            if (
                deal.stage !== "CLOSED_WON" ||
                deal.status !== "WON"
            ) {

                await client.query("ROLLBACK");

                return res.status(400).json({
                    success: false,
                    message:
                        "Sale can only be created from a CLOSED_WON deal"
                });
            }

            // Make sure deal belongs to customer
            if (
                Number(deal.id) !== Number(customer.deal_id)
            ) {

                await client.query("ROLLBACK");

                return res.status(400).json({
                    success: false,
                    message:
                        "Deal does not belong to this customer"
                });
            }
        }


        // Check duplicate sale
        if (deal_id) {

            const existingSale =
                await client.query(
                    `
                    SELECT id
                    FROM sales
                    WHERE deal_id = $1
                    `,
                    [deal_id]
                );

            if (existingSale.rows.length > 0) {

                await client.query("ROLLBACK");

                return res.status(409).json({
                    success: false,
                    message:
                        "A sale already exists for this deal"
                });
            }
        }


        // Validate payment status
        let payment;
        try {
            payment = resolvePayment(finalAmount, payment_status, amount_paid);
        } catch (error) {
            await client.query("ROLLBACK");
            return res.status(400).json({ success: false, message: error.message });
        }


        // Validate payment method
        const validPaymentMethods = [
            "CASH",
            "CARD",
            "UPI",
            "BANK_TRANSFER",
            "CHEQUE",
            "OTHER"
        ];

        let finalPaymentMethod =
            payment_method
                ? payment_method.toUpperCase()
                : null;

        if (
            finalPaymentMethod &&
            !validPaymentMethods.includes(
                finalPaymentMethod
            )
        ) {

            await client.query("ROLLBACK");

            return res.status(400).json({
                success: false,
                message: "Invalid payment method"
            });
        }


        const finalInvoiceNumber =
            invoice_number || generateInvoiceNumber();


        // Create sale
        const result = await client.query(
            `
            INSERT INTO sales (
                customer_id,
                deal_id,
                assigned_to,
                invoice_number,
                product_service,
                description,
                sale_amount,
                discount,
                tax,
                final_amount,
                payment_status,
                amount_paid,
                balance_due,
                payment_method,
                sale_date,
                notes,
                gst_mode,
                gst_rate,
                cgst_amount,
                sgst_amount,
                signature_image,
                stamp_image
            )
            VALUES (
                $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,
                $11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22
            )
            RETURNING *
            `,
            [
                customer_id,
                deal_id || null,
                finalAssignedTo,
                finalInvoiceNumber,
                product_service.trim(),
                description?.trim() || null,
                sale_amount,
                discount,
                finalTax,
                finalAmount,
                payment.paymentStatus,
                payment.amountPaid,
                payment.balanceDue,
                finalPaymentMethod,
                sale_date || new Date(),
                notes?.trim() || null,
                finalGstMode,
                finalGstRate,
                cgstAmount,
                sgstAmount,
                signatureImage,
                stampImage
            ]
        );


        await client.query("COMMIT");


        return res.status(201).json({
            success: true,
            message: "Sale created successfully",
            data: {
                sale: result.rows[0]
            }
        });

    } catch (error) {

        await client.query("ROLLBACK");

        console.error(
            "Create sale error:",
            error
        );

        return res.status(500).json({
            success: false,
            message: "Internal server error"
        });

    } finally {
        client.release();
    }
};


// GET SALES
const getSales = async (req, res) => {

    try {

        const {
            payment_status,
            assigned_to,
            customer_id,
            deal_id,
            lead_id,
            page = 1,
            limit = 10
        } = req.query;


        const pageNumber =
            Math.max(parseInt(page) || 1, 1);

        const limitNumber =
            Math.min(
                Math.max(parseInt(limit) || 10, 1),
                100
            );

        const offset =
            (pageNumber - 1) *
            limitNumber;


        const values = [];
        const conditions = [];


        // Sales Person sees own sales
        if (
            req.user.role === "SALES_PERSON"
        ) {

            values.push(req.user.id);

            conditions.push(
                `s.assigned_to = $${values.length}`
            );
        }


        if (payment_status) {

            values.push(
                payment_status.toUpperCase()
            );

            conditions.push(
                `s.payment_status = $${values.length}`
            );
        }


        if (assigned_to) {

            values.push(assigned_to);

            conditions.push(
                `s.assigned_to = $${values.length}`
            );
        }


        if (customer_id) {

            values.push(customer_id);

            conditions.push(
                `s.customer_id = $${values.length}`
            );
        }


        if (deal_id) {

            values.push(deal_id);

            conditions.push(
                `s.deal_id = $${values.length}`
            );
        }

        if (lead_id) {
            values.push(lead_id);
            conditions.push(
                `s.customer_id IN (SELECT id FROM customers WHERE lead_id = $${values.length})`
            );
        }


        const whereClause =
            conditions.length > 0
                ? `WHERE ${conditions.join(" AND ")}`
                : "";


        const countResult =
            await pool.query(
                `
                SELECT COUNT(*)::INTEGER AS total
                FROM sales s
                ${whereClause}
                `,
                values
            );


        const total =
            countResult.rows[0].total;


        values.push(limitNumber);

        const limitPosition =
            values.length;


        values.push(offset);

        const offsetPosition =
            values.length;


        const result =
            await pool.query(
                `
                SELECT

                    s.*,

                    u.name AS assigned_user,

                    c.customer_code,

                    c.status AS customer_status,

                    d.title AS deal_title,
                    d.amount AS deal_amount,

                    q.quotation_type AS quotation_type,
                    q.subject AS quotation_subject,

                    l.first_name AS lead_first_name,
                    l.last_name  AS lead_last_name,
                    l.company    AS lead_company,
                    l.phone      AS lead_phone,
                    l.email      AS lead_email

                FROM sales s

                JOIN users u
                    ON s.assigned_to = u.id

                JOIN customers c
                    ON s.customer_id = c.id

                LEFT JOIN deals d
                    ON s.deal_id = d.id

                LEFT JOIN quotations q
                    ON s.quotation_id = q.id

                LEFT JOIN leads l
                    ON c.lead_id = l.id

                ${whereClause}

                ORDER BY s.sale_date DESC,
                         s.created_at DESC

                LIMIT $${limitPosition}

                OFFSET $${offsetPosition}
                `,
                values
            );


        return res.status(200).json({
            success: true,
            message:
                "Sales fetched successfully",

            data: {

                sales: result.rows,

                pagination: {

                    page: pageNumber,

                    limit: limitNumber,

                    total,

                    totalPages:
                        Math.ceil(
                            total /
                            limitNumber
                        )
                }
            }
        });

    } catch (error) {

        console.error(
            "Get sales error:",
            error
        );

        return res.status(500).json({
            success: false,
            message:
                "Internal server error"
        });
    }
};


// DELETE SALE (INVOICE)
const deleteSale = async (req, res) => {
    const client = await pool.connect();

    try {
        const { id } = req.params;

        await client.query("BEGIN");

        const saleResult = await client.query(
            `SELECT id, assigned_to, quotation_id FROM sales WHERE id = $1 FOR UPDATE`,
            [id]
        );

        if (saleResult.rows.length === 0) {
            await client.query("ROLLBACK");
            return res.status(404).json({ success: false, message: "Invoice not found" });
        }

        const sale = saleResult.rows[0];
        if (req.user.role === "SALES_PERSON" && Number(sale.assigned_to) !== Number(req.user.id)) {
            await client.query("ROLLBACK");
            return res.status(403).json({ success: false, message: "You can only delete your assigned invoices" });
        }

        await client.query(`DELETE FROM sales WHERE id = $1`, [id]);
        await client.query("COMMIT");

        return res.status(200).json({ success: true, message: "Invoice deleted" });
    } catch (error) {
        await client.query("ROLLBACK");
        console.error("deleteSale error:", error);
        return res.status(500).json({ success: false, message: error.message || "Internal server error" });
    } finally {
        client.release();
    }
};


// GET SALE BY ID
const getSaleById = async (req, res) => {

    try {

        const { id } = req.params;

        let query = `
            SELECT

                s.*,

                u.name AS assigned_user,

                c.customer_code,

                c.customer_type,

                c.status AS customer_status,

                d.title AS deal_title,
                d.amount AS deal_amount,

                q.quotation_type AS quotation_type,
                q.subject AS quotation_subject,

                l.first_name AS lead_first_name,
                l.last_name  AS lead_last_name,
                l.company    AS lead_company,
                l.phone      AS lead_phone,
                l.email      AS lead_email

            FROM sales s

            JOIN users u
                ON s.assigned_to = u.id

            JOIN customers c
                ON s.customer_id = c.id

            LEFT JOIN deals d
                ON s.deal_id = d.id

            LEFT JOIN quotations q
                ON s.quotation_id = q.id

            LEFT JOIN leads l
                ON c.lead_id = l.id

            WHERE s.id = $1
        `;

        const values = [id];


        if (
            req.user.role === "SALES_PERSON"
        ) {

            query += `
                AND s.assigned_to = $2
            `;

            values.push(req.user.id);
        }


        const result =
            await pool.query(
                query,
                values
            );


        if (
            result.rows.length === 0
        ) {

            return res.status(404).json({
                success: false,
                message: "Sale not found"
            });
        }


        return res.status(200).json({
            success: true,
            message:
                "Sale fetched successfully",

            data: {
                sale: result.rows[0]
            }
        });

    } catch (error) {

        console.error(
            "Get sale error:",
            error
        );

        return res.status(500).json({
            success: false,
            message:
                "Internal server error"
        });
    }
};


// UPDATE SALE
const updateSale = async (req, res) => {

    try {

        const { id } = req.params;

        const {
            payment_status,
            amount_paid,
            payment_method,
            notes,
            discount,
            tax,
            gst_mode,
            gst_rate,
            signature_image,
            stamp_image
        } = req.body || {};


        const existing =
            await pool.query(
                `
                SELECT *
                FROM sales
                WHERE id = $1
                `,
                [id]
            );


        if (
            existing.rows.length === 0
        ) {

            return res.status(404).json({
                success: false,
                message: "Sale not found"
            });
        }


        const sale =
            existing.rows[0];

        let signatureImage;
        let stampImage;
        try {
            signatureImage = signature_image === undefined
                ? sale.signature_image
                : validateInvoiceImage(signature_image, "Signature");
            stampImage = stamp_image === undefined
                ? sale.stamp_image
                : validateInvoiceImage(stamp_image, "Stamp");
        } catch (error) {
            return res.status(400).json({ success: false, message: error.message });
        }


        if (
            req.user.role ===
            "SALES_PERSON" &&
            Number(sale.assigned_to) !==
            Number(req.user.id)
        ) {

            return res.status(403).json({
                success: false,
                message:
                    "You can only update your assigned sales"
            });
        }


        const newDiscount =
            discount !== undefined
                ? Number(discount)
                : Number(sale.discount);


        let newTax =
            tax !== undefined
                ? Number(tax)
                : Number(sale.tax);

        let newGstMode = gst_mode !== undefined ? gst_mode : sale.gst_mode;
        let newGstRate = gst_rate !== undefined ? Number(gst_rate) : Number(sale.gst_rate ?? 18);
        let newCgstAmount = Number(sale.cgst_amount ?? 0);
        let newSgstAmount = Number(sale.sgst_amount ?? 0);
        let finalAmount;

        if (gst_mode !== undefined || gst_rate !== undefined) {
            const breakdown = computeGstBreakdown(
                Number(sale.sale_amount),
                newDiscount,
                newGstMode || "EXCLUSIVE",
                newGstRate
            );
            newGstMode = breakdown.gst_mode;
            newTax = breakdown.tax_amount;
            newCgstAmount = breakdown.cgst_amount;
            newSgstAmount = breakdown.sgst_amount;
            finalAmount = breakdown.grand_total;
        } else {
            if (newDiscount < 0 || newTax < 0) {
                return res.status(400).json({
                    success: false,
                    message: "Discount and tax cannot be negative"
                });
            }

            finalAmount =
                Number(sale.sale_amount) -
                newDiscount +
                newTax;

            newCgstAmount = round2(newTax / 2);
            newSgstAmount = round2(newTax / 2);
        }


        if (finalAmount < 0) {

            return res.status(400).json({
                success: false,
                message:
                    "Final amount cannot be negative"
            });
        }


        let payment;
        try {
            payment = resolvePayment(
                finalAmount,
                payment_status || (amount_paid !== undefined ? "PARTIAL" : sale.payment_status),
                amount_paid !== undefined ? amount_paid : sale.amount_paid
            );
        } catch (error) {
            return res.status(400).json({ success: false, message: error.message });
        }


        const validPaymentMethods = [
            "CASH",
            "CARD",
            "UPI",
            "BANK_TRANSFER",
            "CHEQUE",
            "OTHER"
        ];


        const newPaymentMethod =
            payment_method
                ? payment_method.toUpperCase()
                : sale.payment_method;


        if (
            newPaymentMethod &&
            !validPaymentMethods.includes(
                newPaymentMethod
            )
        ) {

            return res.status(400).json({
                success: false,
                message:
                    "Invalid payment method"
            });
        }


        const result =
            await pool.query(
                `
                UPDATE sales

                SET

                    discount = $1,

                    tax = $2,

                    final_amount = $3,

                    payment_status = $4,

                    amount_paid = $5,

                    balance_due = $6,

                    payment_method = $7,

                    notes = COALESCE($8, notes),

                    gst_mode = $9,

                    gst_rate = $10,

                    cgst_amount = $11,

                    sgst_amount = $12,

                    signature_image = $13,

                    stamp_image = $14,

                    updated_at =
                        CURRENT_TIMESTAMP

                WHERE id = $15

                RETURNING *
                `,
                [
                    newDiscount,
                    newTax,
                    finalAmount,
                    payment.paymentStatus,
                    payment.amountPaid,
                    payment.balanceDue,
                    newPaymentMethod,
                    notes !== undefined
                        ? notes.trim()
                        : null,
                    newGstMode,
                    newGstRate,
                    newCgstAmount,
                    newSgstAmount,
                    signatureImage,
                    stampImage,
                    id
                ]
            );


        return res.status(200).json({
            success: true,
            message:
                "Sale updated successfully",

            data: {
                sale: result.rows[0]
            }
        });

    } catch (error) {

        console.error(
            "Update sale error:",
            error
        );

        return res.status(500).json({
            success: false,
            message:
                "Internal server error"
        });
    }
};


// CONVERT AN ACCEPTED QUOTATION TO AN INVOICE (SALE)
//
// If the quotation's lead has already been converted to a customer (via a
// CLOSED_WON deal) that customer is reused. Otherwise a CLOSED_WON deal and
// a customer record are auto-created so accepting a quotation "just works"
// without forcing the sales rep through a separate manual conversion step.
// The GST mode + CGST/SGST split stored on the quotation is carried over
// as-is so the numbers on the invoice match the quotation exactly.
const convertQuotationToInvoice = async (req, res) => {
    const client = await pool.connect();

    try {
        const { quotationId } = req.params;
        const {
            payment_status,
            amount_paid,
            payment_method,
            sale_date,
            notes,
            signature_image,
            stamp_image
        } = req.body || {};

        let signatureImage;
        let stampImage;
        try {
            signatureImage = validateInvoiceImage(signature_image, "Signature");
            stampImage = validateInvoiceImage(stamp_image, "Stamp");
        } catch (error) {
            return res.status(400).json({ success: false, message: error.message });
        }
        if (!signatureImage || !stampImage) {
            return res.status(400).json({
                success: false,
                message: "Signature and stamp are required to create an invoice"
            });
        }

        await client.query("BEGIN");

        const qRes = await client.query(
            `SELECT * FROM quotations WHERE id = $1 FOR UPDATE`,
            [quotationId]
        );

        if (qRes.rows.length === 0) {
            await client.query("ROLLBACK");
            return res.status(404).json({ success: false, message: "Quotation not found" });
        }

        const quotation = qRes.rows[0];

        if (String(quotation.status || "").toUpperCase() !== "ACCEPTED") {
            await client.query("ROLLBACK");
            return res.status(400).json({
                success: false,
                message: "Only accepted quotations can be converted to an invoice."
            });
        }

        if (!quotation.lead_id) {
            await client.query("ROLLBACK");
            return res.status(400).json({
                success: false,
                message: "This quotation has no linked lead, so an invoice cannot be created for it."
            });
        }

        // Find an existing customer for this lead
        let customerRes = await client.query(
            `SELECT * FROM customers WHERE lead_id = $1 ORDER BY id DESC LIMIT 1`,
            [quotation.lead_id]
        );
        let customer = customerRes.rows[0];

        if (!customer) {
            // Find (or auto-create) a CLOSED_WON deal for this lead
            let dealRes = await client.query(
                `SELECT * FROM deals WHERE lead_id = $1 AND stage = 'CLOSED_WON' ORDER BY id DESC LIMIT 1`,
                [quotation.lead_id]
            );
            let deal = dealRes.rows[0];

            if (!deal) {
                const leadRes = await client.query(`SELECT * FROM leads WHERE id = $1`, [quotation.lead_id]);
                const lead = leadRes.rows[0];
                const dealAssignee = quotation.assigned_to || lead?.assigned_to || req.user.id;

                const dealInsert = await client.query(
                    `INSERT INTO deals (
                        lead_id, contact_id, assigned_to, title, description, amount, stage, probability, expected_close_date
                    ) VALUES ($1,$2,$3,$4,$5,$6,'CLOSED_WON',100,NOW())
                    RETURNING *`,
                    [
                        quotation.lead_id,
                        null,
                        dealAssignee,
                        quotation.subject || quotation.quotation_type || "Converted Deal",
                        `Auto-created on acceptance of quotation ${quotation.quotation_number}`,
                        quotation.total_amount || 0
                    ]
                );
                deal = dealInsert.rows[0];

                await client.query(
                    `UPDATE leads SET status = 'CONVERTED', updated_at = CURRENT_TIMESTAMP WHERE id = $1`,
                    [quotation.lead_id]
                );
            }

            const customerCode = `CUS-${Date.now()}`;
            const customerInsert = await client.query(
                `INSERT INTO customers (
                    lead_id, contact_id, deal_id, assigned_to, customer_code, customer_type, status
                ) VALUES ($1,$2,$3,$4,$5,'INDIVIDUAL','ACTIVE')
                RETURNING *`,
                [quotation.lead_id, deal.contact_id || null, deal.id, deal.assigned_to, customerCode]
            );
            customer = customerInsert.rows[0];
        }

        // Rebuild the GST breakdown from the quotation's own stored figures
        // so the invoice matches the quotation exactly (No GST / Exclusive / Inclusive).
        const pricing = quotation.pricing_breakdown || {};
        const gstMode = quotation.gst_mode || pricing.gst_mode || "EXCLUSIVE";
        const gstRate = Number(pricing.tax_rate ?? 18);
        const breakdown = computeGstBreakdown(
            Number(quotation.subtotal || 0),
            Number(quotation.discount || 0),
            gstMode,
            gstRate
        );

        // Keep the linked deal value aligned with the invoice total, including GST.
        await client.query(
            `UPDATE deals SET amount = $1, updated_at = NOW() WHERE id = $2`,
            [breakdown.grand_total, customer.deal_id]
        );
        await client.query(
            `UPDATE leads SET amount = $1, updated_at = NOW() WHERE id = $2`,
            [breakdown.grand_total, quotation.lead_id]
        );

        const finalInvoiceNumber = generateInvoiceNumber();

        let payment;
        try {
            payment = resolvePayment(
                breakdown.grand_total,
                payment_status || "UNPAID",
                amount_paid
            );
        } catch (error) {
            await client.query("ROLLBACK");
            return res.status(400).json({ success: false, message: error.message });
        }

        const saleInsert = await client.query(
            `INSERT INTO sales (
                customer_id, deal_id, assigned_to, invoice_number,
                product_service, description, sale_amount, discount, tax, final_amount,
                payment_status, amount_paid, balance_due, payment_method, sale_date, notes,
                gst_mode, gst_rate, cgst_amount, sgst_amount
                , signature_image, stamp_image
            ) VALUES (
                $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22
            ) RETURNING *`,
            [
                customer.id,
                customer.deal_id,
                quotation.assigned_to || req.user.id,
                finalInvoiceNumber,
                quotation.subject || quotation.product_service || quotation.quotation_type || "Invoice",
                quotation.description || null,
                breakdown.taxable_amount,
                Number(quotation.discount || 0),
                breakdown.tax_amount,
                breakdown.grand_total,
                payment.paymentStatus,
                payment.amountPaid,
                payment.balanceDue,
                payment_method ? payment_method.toUpperCase() : null,
                sale_date || new Date(),
                notes?.trim() || `Auto-generated from accepted quotation ${quotation.quotation_number}`,
                breakdown.gst_mode,
                gstRate,
                breakdown.cgst_amount,
                breakdown.sgst_amount,
                signatureImage,
                stampImage
            ]
        );

        const sale = saleInsert.rows[0];

        // The quotation has served its purpose — remove it now that the
        // invoice exists. The invoice keeps its own copy of every figure.
        await client.query(`DELETE FROM quotations WHERE id = $1`, [quotation.id]);

        await client.query("COMMIT");

        return res.status(201).json({
            success: true,
            message: "Invoice created and the quotation was removed",
            data: { sale }
        });
    } catch (error) {
        await client.query("ROLLBACK");
        console.error("convertQuotationToInvoice error:", error);
        return res.status(500).json({
            success: false,
            message: error.message || "Internal server error"
        });
    } finally {
        client.release();
    }
};


module.exports = {
    createSale,
    getSales,
    getSaleById,
    updateSale,
    deleteSale,
    convertQuotationToInvoice
};