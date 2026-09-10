const pool = require("../config/db");


// Generate invoice number
const generateInvoiceNumber = () => {
    const timestamp = Date.now();

    return `INV-${timestamp}`;
};


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
            payment_status = "PENDING",
            payment_method,
            sale_date,
            notes
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

        const finalAmount =
            Number(sale_amount) -
            Number(discount) +
            Number(tax);

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
        const validPaymentStatuses = [
            "PENDING",
            "PARTIAL",
            "PAID",
            "REFUNDED"
        ];

        const finalPaymentStatus =
            payment_status.toUpperCase();

        if (
            !validPaymentStatuses.includes(
                finalPaymentStatus
            )
        ) {

            await client.query("ROLLBACK");

            return res.status(400).json({
                success: false,
                message: "Invalid payment status"
            });
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
                payment_method,
                sale_date,
                notes
            )
            VALUES (
                $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,
                $11,$12,$13,$14
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
                tax,
                finalAmount,
                finalPaymentStatus,
                finalPaymentMethod,
                sale_date || new Date(),
                notes?.trim() || null
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

                    d.title AS deal_title

                FROM sales s

                JOIN users u
                    ON s.assigned_to = u.id

                JOIN customers c
                    ON s.customer_id = c.id

                LEFT JOIN deals d
                    ON s.deal_id = d.id

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
                d.amount AS deal_amount

            FROM sales s

            JOIN users u
                ON s.assigned_to = u.id

            JOIN customers c
                ON s.customer_id = c.id

            LEFT JOIN deals d
                ON s.deal_id = d.id

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
            payment_method,
            notes,
            discount,
            tax
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


        const newTax =
            tax !== undefined
                ? Number(tax)
                : Number(sale.tax);


        if (
            newDiscount < 0 ||
            newTax < 0
        ) {

            return res.status(400).json({
                success: false,
                message:
                    "Discount and tax cannot be negative"
            });
        }


        const finalAmount =
            Number(sale.sale_amount) -
            newDiscount +
            newTax;


        if (finalAmount < 0) {

            return res.status(400).json({
                success: false,
                message:
                    "Final amount cannot be negative"
            });
        }


        const validPaymentStatuses = [
            "PENDING",
            "PARTIAL",
            "PAID",
            "REFUNDED"
        ];


        const newPaymentStatus =
            payment_status
                ? payment_status.toUpperCase()
                : sale.payment_status;


        if (
            !validPaymentStatuses.includes(
                newPaymentStatus
            )
        ) {

            return res.status(400).json({
                success: false,
                message:
                    "Invalid payment status"
            });
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

                    payment_method = $5,

                    notes = COALESCE($6, notes),

                    updated_at =
                        CURRENT_TIMESTAMP

                WHERE id = $7

                RETURNING *
                `,
                [
                    newDiscount,
                    newTax,
                    finalAmount,
                    newPaymentStatus,
                    newPaymentMethod,
                    notes !== undefined
                        ? notes.trim()
                        : null,
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


module.exports = {
    createSale,
    getSales,
    getSaleById,
    updateSale
};