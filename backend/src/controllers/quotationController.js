const pool = require("../config/db");
const nodemailer = require("nodemailer");

/**
 * Generate sequential Quotation Number in format: Q-YYYY-XXXX (e.g. Q-2026-0026)
 */
async function generateQuotationNumber() {
    const year = new Date().getFullYear();
    const prefix = `Q-${year}-`;
    try {
        const res = await pool.query(
            `SELECT quotation_number FROM quotations 
             WHERE quotation_number LIKE $1 
             ORDER BY id DESC LIMIT 1`,
            [`${prefix}%`]
        );

        if (res.rows.length === 0) {
            return `${prefix}0001`;
        }

        const lastNumStr = res.rows[0].quotation_number.replace(prefix, "");
        const nextNum = (parseInt(lastNumStr, 10) || 0) + 1;
        return `${prefix}${String(nextNum).padStart(4, "0")}`;
    } catch {
        return `${prefix}${Date.now().toString().slice(-4)}`;
    }
}

/**
 * GET /api/quotations
 * List all quotations with optional filtering by lead_id or status
 */
const getQuotations = async (req, res) => {
    try {
        const { lead_id, status } = req.query;
        let query = `
            SELECT q.*, 
                   l.first_name AS lead_first_name, 
                   l.last_name AS lead_last_name, 
                   l.company AS lead_company,
                   l.email AS lead_email,
                   l.phone AS lead_phone,
                   u.name AS creator_name
            FROM quotations q
            LEFT JOIN leads l ON q.lead_id = l.id
            LEFT JOIN users u ON q.created_by = u.id
            WHERE 1=1
        `;
        const params = [];

        if (lead_id) {
            params.push(lead_id);
            query += ` AND q.lead_id = $${params.length}`;
        }
        if (status) {
            params.push(status);
            query += ` AND q.status = $${params.length}`;
        }

        query += ` ORDER BY q.id DESC`;

        const result = await pool.query(query, params);
        return res.status(200).json({
            success: true,
            data: result.rows
        });
    } catch (error) {
        console.error("getQuotations error:", error);
        return res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * GET /api/quotations/:id
 * Fetch single quotation with full details
 */
const getQuotationById = async (req, res) => {
    try {
        const { id } = req.params;
        const result = await pool.query(
            `SELECT q.*, 
                    l.first_name AS lead_first_name, 
                    l.last_name AS lead_last_name, 
                    l.company AS lead_company,
                    l.email AS lead_email,
                    l.phone AS lead_phone,
                    u.name AS creator_name
             FROM quotations q
             LEFT JOIN leads l ON q.lead_id = l.id
             LEFT JOIN users u ON q.created_by = u.id
             WHERE q.id = $1`,
            [id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ success: false, message: "Quotation not found" });
        }

        return res.status(200).json({
            success: true,
            data: result.rows[0]
        });
    } catch (error) {
        console.error("getQuotationById error:", error);
        return res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * POST /api/quotations
 * Create new dynamic quotation
 */
const createQuotation = async (req, res) => {
    try {
        const {
            lead_id,
            deal_id,
            quotation_type,
            subject,
            items = [],
            scope_sections = [],
            timeline_items = [],
            inclusions = [],
            client_details = {},
            discount = 0,
            tax_rate = 18,
            valid_until,
            terms_conditions,
            status = "DRAFT"
        } = req.body;

        if (!lead_id) {
            return res.status(400).json({ success: false, message: "A CRM Lead is required" });
        }
        if (!quotation_type) {
            return res.status(400).json({ success: false, message: "Quotation type is required" });
        }
        if (!Array.isArray(items) || items.length === 0) {
            return res.status(400).json({ success: false, message: "At least one product/service item is required" });
        }

        // Auto-fetch lead details if client_details is incomplete
        const leadRes = await pool.query(`SELECT * FROM leads WHERE id = $1`, [lead_id]);
        if (leadRes.rows.length === 0) {
            return res.status(404).json({ success: false, message: "Selected lead not found" });
        }
        const lead = leadRes.rows[0];

        const fullClientDetails = {
            name: `${lead.first_name || ""} ${lead.last_name || ""}`.trim() || lead.email || "Customer",
            company: lead.company || client_details.company || "—",
            email: lead.email || client_details.email || "",
            phone: lead.phone || lead.whatsapp_number || client_details.phone || "",
            address: client_details.address || "Pune, Maharashtra",
            city: client_details.city || "Pune",
            state: client_details.state || "Maharashtra",
            pincode: client_details.pincode || "411057",
            gstin: client_details.gstin || ""
        };

        // Calculate pricing
        let subtotal = 0;
        const processedItems = items.map((item, idx) => {
            const qty = Number(item.quantity) || 1;
            const price = Number(item.unit_price) || 0;
            const total = qty * price;
            subtotal += total;
            return {
                sr_no: idx + 1,
                description: item.description || "Service",
                technology: item.technology || "",
                deliverables: item.deliverables || "",
                quantity: qty,
                unit_price: price,
                total
            };
        });

        const discountAmt = Number(discount) || 0;
        const taxableAmount = Math.max(0, subtotal - discountAmt);
        const taxRate = Number(tax_rate) >= 0 ? Number(tax_rate) : 18;
        const taxAmount = (taxableAmount * taxRate) / 100;
        const grandTotal = Math.round(taxableAmount + taxAmount);

        const pricingBreakdown = {
            subtotal,
            discount: discountAmt,
            taxable_amount: taxableAmount,
            tax_rate: taxRate,
            tax_amount: taxAmount,
            grand_total: grandTotal
        };

        const quotationNumber = await generateQuotationNumber();
        const autoSubject = subject || quotation_type || "Quotation";
        const primaryProduct = processedItems[0]?.description || quotation_type;

        const insertQuery = `
            INSERT INTO quotations (
                quotation_number,
                lead_id,
                deal_id,
                created_by,
                assigned_to,
                customer_name,
                customer_email,
                whatsapp_number,
                product_service,
                description,
                quantity,
                unit_price,
                discount,
                tax,
                subtotal,
                total_amount,
                valid_until,
                status,
                terms_conditions,
                quotation_type,
                subject,
                items,
                scope_sections,
                timeline_items,
                inclusions,
                client_details,
                pricing_breakdown,
                created_at,
                updated_at
            )
            VALUES (
                $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
                $11, $12, $13, $14, $15, $16, $17, $18, $19, $20,
                $21, $22, $23, $24, $25, $26, $27, NOW(), NOW()
            )
            RETURNING *
        `;

        const result = await pool.query(insertQuery, [
            quotationNumber,
            lead_id,
            deal_id || null,
            req.user?.id || null,
            lead.assigned_to || req.user?.id || null,
            fullClientDetails.name,
            fullClientDetails.email,
            fullClientDetails.phone,
            primaryProduct,
            processedItems[0]?.deliverables || autoSubject,
            processedItems[0]?.quantity || 1,
            processedItems[0]?.unit_price || subtotal,
            discountAmt,
            taxAmount,
            subtotal,
            grandTotal,
            valid_until || null,
            status,
            terms_conditions || "Standard commercial terms apply. 50% advance, balance on completion.",
            quotation_type,
            autoSubject,
            JSON.stringify(processedItems),
            JSON.stringify(scope_sections),
            JSON.stringify(timeline_items),
            JSON.stringify(inclusions),
            JSON.stringify(fullClientDetails),
            JSON.stringify(pricingBreakdown)
        ]);

        return res.status(201).json({
            success: true,
            message: "Quotation created successfully",
            data: result.rows[0]
        });
    } catch (error) {
        console.error("createQuotation error:", error);
        return res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * PUT /api/quotations/:id
 * Update existing quotation
 */
const updateQuotation = async (req, res) => {
    try {
        const { id } = req.params;
        const {
            quotation_type,
            subject,
            items = [],
            scope_sections = [],
            timeline_items = [],
            inclusions = [],
            client_details = {},
            discount = 0,
            tax_rate = 18,
            valid_until,
            terms_conditions,
            status
        } = req.body;

        const existingRes = await pool.query(`SELECT * FROM quotations WHERE id = $1`, [id]);
        if (existingRes.rows.length === 0) {
            return res.status(404).json({ success: false, message: "Quotation not found" });
        }
        const existing = existingRes.rows[0];

        // Recalculate pricing
        let subtotal = 0;
        const processedItems = (items.length > 0 ? items : (existing.items || [])).map((item, idx) => {
            const qty = Number(item.quantity) || 1;
            const price = Number(item.unit_price) || 0;
            const total = qty * price;
            subtotal += total;
            return {
                sr_no: idx + 1,
                description: item.description || "Service",
                technology: item.technology || "",
                deliverables: item.deliverables || "",
                quantity: qty,
                unit_price: price,
                total
            };
        });

        const discountAmt = discount !== undefined ? Number(discount) : Number(existing.discount || 0);
        const taxableAmount = Math.max(0, subtotal - discountAmt);
        const taxRate = tax_rate !== undefined ? Number(tax_rate) : 18;
        const taxAmount = (taxableAmount * taxRate) / 100;
        const grandTotal = Math.round(taxableAmount + taxAmount);

        const pricingBreakdown = {
            subtotal,
            discount: discountAmt,
            taxable_amount: taxableAmount,
            tax_rate: taxRate,
            tax_amount: taxAmount,
            grand_total: grandTotal
        };

        const updateQuery = `
            UPDATE quotations
            SET quotation_type = COALESCE($1, quotation_type),
                subject = COALESCE($2, subject),
                items = $3,
                scope_sections = $4,
                timeline_items = $5,
                inclusions = $6,
                client_details = $7,
                pricing_breakdown = $8,
                subtotal = $9,
                discount = $10,
                tax = $11,
                total_amount = $12,
                status = COALESCE($13, status),
                valid_until = COALESCE($14, valid_until),
                terms_conditions = COALESCE($15, terms_conditions),
                updated_at = NOW()
            WHERE id = $16
            RETURNING *
        `;

        const result = await pool.query(updateQuery, [
            quotation_type || null,
            subject || null,
            JSON.stringify(processedItems),
            JSON.stringify(scope_sections),
            JSON.stringify(timeline_items),
            JSON.stringify(inclusions),
            JSON.stringify(client_details),
            JSON.stringify(pricingBreakdown),
            subtotal,
            discountAmt,
            taxAmount,
            grandTotal,
            status || null,
            valid_until || null,
            terms_conditions || null,
            id
        ]);

        return res.status(200).json({
            success: true,
            message: "Quotation updated successfully",
            data: result.rows[0]
        });
    } catch (error) {
        console.error("updateQuotation error:", error);
        return res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * DELETE /api/quotations/:id
 */
const deleteQuotation = async (req, res) => {
    try {
        const { id } = req.params;
        const result = await pool.query(`DELETE FROM quotations WHERE id = $1 RETURNING id`, [id]);
        if (result.rows.length === 0) {
            return res.status(404).json({ success: false, message: "Quotation not found" });
        }
        return res.status(200).json({ success: true, message: "Quotation deleted" });
    } catch (error) {
        console.error("deleteQuotation error:", error);
        return res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * POST /api/quotations/:id/send-email
 * Send quotation email with PDF attachment
 */
const sendQuotationEmail = async (req, res) => {
    try {
        const { id } = req.params;
        const { pdf_base64, recipient_email } = req.body;

        const qRes = await pool.query(`SELECT * FROM quotations WHERE id = $1`, [id]);
        if (qRes.rows.length === 0) {
            return res.status(404).json({ success: false, message: "Quotation not found" });
        }
        const q = qRes.rows[0];

        const targetEmail = recipient_email || q.customer_email;
        if (!targetEmail) {
            return res.status(400).json({ success: false, message: "No recipient email found for this quotation" });
        }

        const emailSubject = `${q.subject || q.quotation_type || "Quotation"} – ${q.quotation_number}`;
        const fileName = `${q.quotation_number || "Quotation"}.pdf`;

        // Check if SMTP is configured
        if (process.env.SMTP_HOST && process.env.SMTP_USER) {
            const transporter = nodemailer.createTransport({
                host: process.env.SMTP_HOST,
                port: Number(process.env.SMTP_PORT) || 587,
                secure: process.env.SMTP_SECURE === "true",
                auth: {
                    user: process.env.SMTP_USER,
                    pass: process.env.SMTP_PASS
                }
            });

            const mailOptions = {
                from: process.env.SMTP_FROM || `"Qiro Tech Innovation" <commercial@qirotec.com>`,
                to: targetEmail,
                subject: emailSubject,
                text: `Dear Sir/Madam,\n\nPlease find attached your exclusive quotation (${q.quotation_number}) for ${q.subject || q.quotation_type}.\n\nWarm regards,\nQiro Tech Innovation Pvt. Ltd.\ncommercial@qirotec.com | +918623823997`,
                attachments: pdf_base64 ? [
                    {
                        filename: fileName,
                        content: pdf_base64.split("base64,")[1] || pdf_base64,
                        encoding: "base64"
                    }
                ] : []
            };

            await transporter.sendMail(mailOptions);
        }

        // Update quotation status in DB
        await pool.query(
            `UPDATE quotations 
             SET email_sent = true, 
                 email_sent_at = NOW(), 
                 status = 'SENT',
                 updated_at = NOW() 
             WHERE id = $1`,
            [id]
        );

        return res.status(200).json({
            success: true,
            message: `Quotation sent successfully to ${targetEmail}`
        });
    } catch (error) {
        console.error("sendQuotationEmail error:", error);
        return res.status(500).json({ success: false, message: error.message });
    }
};

module.exports = {
    getQuotations,
    getQuotationById,
    createQuotation,
    updateQuotation,
    deleteQuotation,
    sendQuotationEmail
};
