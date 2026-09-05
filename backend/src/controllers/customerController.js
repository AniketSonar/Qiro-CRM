const pool = require("../config/db");


// Generate customer code
const generateCustomerCode = () => {
    const timestamp = Date.now();

    return `CUS-${timestamp}`;
};


// CONVERT WON DEAL TO CUSTOMER
const convertDealToCustomer = async (req, res) => {
    const client = await pool.connect();

    try {
        const { dealId } = req.params;

        await client.query("BEGIN");

        // Get deal
        const dealResult = await client.query(
            `
            SELECT *
            FROM deals
            WHERE id = $1
            FOR UPDATE
            `,
            [dealId]
        );

        if (dealResult.rows.length === 0) {
            await client.query("ROLLBACK");

            return res.status(404).json({
                success: false,
                message: "Deal not found"
            });
        }

        const deal = dealResult.rows[0];

        // Sales Person ownership
        if (
            req.user.role === "SALES_PERSON" &&
            Number(deal.assigned_to) !== Number(req.user.id)
        ) {
            await client.query("ROLLBACK");

            return res.status(403).json({
                success: false,
                message: "You can only convert your assigned deals"
            });
        }

        // Deal must be won. Stage is the source of truth for the pipeline.
        if (deal.stage !== "CLOSED_WON") {
            await client.query("ROLLBACK");

            return res.status(400).json({
                success: false,
                message: "Only CLOSED_WON deals can be converted to customers"
            });
        }

        // Check existing customer
        const existingCustomer = await client.query(
            `
            SELECT *
            FROM customers
            WHERE deal_id = $1
            `,
            [dealId]
        );

        if (existingCustomer.rows.length > 0) {
            if (deal.lead_id) {
                await client.query(
                    `UPDATE leads
                     SET status = 'CONVERTED', updated_at = CURRENT_TIMESTAMP
                     WHERE id = $1`,
                    [deal.lead_id]
                );
            }
            await client.query("COMMIT");

            return res.status(200).json({
                success: true,
                message: "Deal is already converted to a customer",
                data: {
                    customer: existingCustomer.rows[0]
                }
            });
        }

        // Generate code
        const customerCode = generateCustomerCode();

        // Create customer
        const customerResult = await client.query(
            `
            INSERT INTO customers (
                lead_id,
                contact_id,
                deal_id,
                assigned_to,
                customer_code,
                customer_type,
                status
            )
            VALUES (
                $1,
                $2,
                $3,
                $4,
                $5,
                'INDIVIDUAL',
                'ACTIVE'
            )
            RETURNING *
            `,
            [
                deal.lead_id,
                deal.contact_id,
                deal.id,
                deal.assigned_to,
                customerCode
            ]
        );

        if (deal.lead_id) {
            await client.query(
                `UPDATE leads
                 SET status = 'CONVERTED', updated_at = CURRENT_TIMESTAMP
                 WHERE id = $1`,
                [deal.lead_id]
            );
        }

        await client.query("COMMIT");

        return res.status(201).json({
            success: true,
            message: "Deal converted to customer successfully",
            data: {
                customer: customerResult.rows[0]
            }
        });

    } catch (error) {

        await client.query("ROLLBACK");

        console.error(
            "Convert deal to customer error:",
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


// GET CUSTOMERS
const getCustomers = async (req, res) => {
    try {

        const {
            status,
            assigned_to,
            customer_type,
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
            (pageNumber - 1) * limitNumber;

        const values = [];
        const conditions = [];

        // Sales Person only sees assigned customers
        if (req.user.role === "SALES_PERSON") {

            values.push(req.user.id);

            conditions.push(
                `c.assigned_to = $${values.length}`
            );
        }

        if (status) {

            values.push(status.toUpperCase());

            conditions.push(
                `c.status = $${values.length}`
            );
        }

        if (assigned_to) {

            values.push(assigned_to);

            conditions.push(
                `c.assigned_to = $${values.length}`
            );
        }

        if (customer_type) {

            values.push(
                customer_type.toUpperCase()
            );

            conditions.push(
                `c.customer_type = $${values.length}`
            );
        }

        const whereClause =
            conditions.length > 0
                ? `WHERE ${conditions.join(" AND ")}`
                : "";

        const countResult = await pool.query(
            `
            SELECT COUNT(*)::INTEGER AS total
            FROM customers c
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

        const result = await pool.query(
            `
            SELECT
                c.*,

                u.name AS assigned_user,

                l.first_name AS lead_first_name,
                l.last_name AS lead_last_name,

                ct.first_name AS contact_first_name,
                ct.last_name AS contact_last_name,

                d.title AS deal_title,
                d.amount AS deal_amount,
                d.description AS deal_description

            FROM customers c

            LEFT JOIN users u
                ON c.assigned_to = u.id

            LEFT JOIN leads l
                ON c.lead_id = l.id

            LEFT JOIN contacts ct
                ON c.contact_id = ct.id

            LEFT JOIN deals d
                ON c.deal_id = d.id

            ${whereClause}

            ORDER BY c.created_at DESC

            LIMIT $${limitPosition}
            OFFSET $${offsetPosition}
            `,
            values
        );

        return res.status(200).json({
            success: true,
            message: "Customers fetched successfully",
            data: {
                customers: result.rows,

                pagination: {
                    page: pageNumber,
                    limit: limitNumber,
                    total,

                    totalPages:
                        Math.ceil(
                            total / limitNumber
                        )
                }
            }
        });

    } catch (error) {

        console.error(
            "Get customers error:",
            error
        );

        return res.status(500).json({
            success: false,
            message: "Internal server error"
        });
    }
};


// GET CUSTOMER BY ID
const getCustomerById = async (req, res) => {

    try {

        const { id } = req.params;

        let query = `
            SELECT
                c.*,

                u.name AS assigned_user,

                l.first_name AS lead_first_name,
                l.last_name AS lead_last_name,

                ct.first_name AS contact_first_name,
                ct.last_name AS contact_last_name,

                d.title AS deal_title,
                d.amount AS deal_amount,
                d.stage AS deal_stage

            FROM customers c

            LEFT JOIN users u
                ON c.assigned_to = u.id

            LEFT JOIN leads l
                ON c.lead_id = l.id

            LEFT JOIN contacts ct
                ON c.contact_id = ct.id

            LEFT JOIN deals d
                ON c.deal_id = d.id

            WHERE c.id = $1
        `;

        const values = [id];

        if (req.user.role === "SALES_PERSON") {

            query += `
                AND c.assigned_to = $2
            `;

            values.push(req.user.id);
        }

        const result = await pool.query(
            query,
            values
        );

        if (result.rows.length === 0) {

            return res.status(404).json({
                success: false,
                message: "Customer not found"
            });
        }

        return res.status(200).json({
            success: true,
            message: "Customer fetched successfully",
            data: {
                customer: result.rows[0]
            }
        });

    } catch (error) {

        console.error(
            "Get customer error:",
            error
        );

        return res.status(500).json({
            success: false,
            message: "Internal server error"
        });
    }
};


// UPDATE CUSTOMER
const updateCustomer = async (req, res) => {

    try {

        const { id } = req.params;

        const {
            customer_type,
            status,
            notes
        } = req.body || {};

        const existing = await pool.query(
            `
            SELECT *
            FROM customers
            WHERE id = $1
            `,
            [id]
        );

        if (existing.rows.length === 0) {

            return res.status(404).json({
                success: false,
                message: "Customer not found"
            });
        }

        const customer =
            existing.rows[0];

        if (
            req.user.role === "SALES_PERSON" &&
            Number(customer.assigned_to) !== Number(req.user.id)
        ) {

            return res.status(403).json({
                success: false,
                message:
                    "You can only update your assigned customers"
            });
        }

        if (
            customer_type &&
            !["INDIVIDUAL", "BUSINESS"]
                .includes(customer_type.toUpperCase())
        ) {

            return res.status(400).json({
                success: false,
                message: "Invalid customer type"
            });
        }

        if (
            status &&
            !["ACTIVE", "INACTIVE"]
                .includes(status.toUpperCase())
        ) {

            return res.status(400).json({
                success: false,
                message: "Invalid customer status"
            });
        }

        const result = await pool.query(
            `
            UPDATE customers
            SET
                customer_type =
                    COALESCE($1, customer_type),

                status =
                    COALESCE($2, status),

                notes =
                    COALESCE($3, notes),

                updated_at =
                    CURRENT_TIMESTAMP

            WHERE id = $4

            RETURNING *
            `,
            [
                customer_type
                    ? customer_type.toUpperCase()
                    : null,

                status
                    ? status.toUpperCase()
                    : null,

                notes !== undefined
                    ? notes.trim()
                    : null,

                id
            ]
        );

        return res.status(200).json({
            success: true,
            message: "Customer updated successfully",
            data: {
                customer: result.rows[0]
            }
        });

    } catch (error) {

        console.error(
            "Update customer error:",
            error
        );

        return res.status(500).json({
            success: false,
            message: "Internal server error"
        });
    }
};


module.exports = {
    convertDealToCustomer,
    getCustomers,
    getCustomerById,
    updateCustomer
};