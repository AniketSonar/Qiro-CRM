const pool = require("../config/db");

let hasLeadDesignationColumnCache = null;
let leadExtraColumnsReady = false;

const ensureLeadExtraColumns = async () => {
    if (leadExtraColumnsReady) return;

    await pool.query(`
        ALTER TABLE leads
        ADD COLUMN IF NOT EXISTS whatsapp VARCHAR(50),
        ADD COLUMN IF NOT EXISTS website TEXT,
        ADD COLUMN IF NOT EXISTS amount NUMERIC(15, 2)
    `);
    leadExtraColumnsReady = true;
};

const hasLeadDesignationColumn = async () => {
    if (hasLeadDesignationColumnCache !== null) {
        return hasLeadDesignationColumnCache;
    }

    try {
        const result = await pool.query(
            `SELECT 1
             FROM information_schema.columns
             WHERE table_schema = 'public'
             AND table_name = 'leads'
             AND column_name = 'designation'
             LIMIT 1`
        );

        hasLeadDesignationColumnCache = result.rows.length > 0;
        return hasLeadDesignationColumnCache;
    } catch (error) {
        hasLeadDesignationColumnCache = false;
        return hasLeadDesignationColumnCache;
    }
};

// CREATE LEAD
const createLead = async (req, res) => {
    try {
        await ensureLeadExtraColumns();
        const {
            first_name,
            last_name,
            email,
            phone,
            whatsapp,
            company,
            website,
            designation,
            amount,
            source_id,
            status,
            assigned_to,
            notes
        } = req.body;

        const leadAmount = amount === undefined || amount === "" ? null : Number(amount);
        const finalAssignedTo = String(req.user.role).toUpperCase() === "SALES_PERSON"
            ? req.user.id
            : assigned_to || null;
        if (leadAmount !== null && (!Number.isFinite(leadAmount) || leadAmount < 0)) {
            return res.status(400).json({
                success: false,
                message: "Amount must be a valid non-negative number"
            });
        }

        if (!first_name) {
            return res.status(400).json({
                success: false,
                message: "First name is required"
            });
        }

        // Validate source
        if (source_id) {
            const sourceResult = await pool.query(
                `SELECT id
                 FROM lead_sources
                 WHERE id = $1
                 AND is_active = TRUE`,
                [source_id]
            );

            if (sourceResult.rows.length === 0) {
                return res.status(400).json({
                    success: false,
                    message: "Invalid or inactive lead source"
                });
            }
        }

        // Validate assigned user
        if (assigned_to) {
            const userResult = await pool.query(
                `SELECT u.id
                 FROM users u
                 JOIN roles r ON u.role_id = r.id
                 WHERE u.id = $1
                 AND u.status = 'ACTIVE'
                 AND r.name IN ('SALES_PERSON', 'SALES_MANAGER')`,
                [assigned_to]
            );

            if (userResult.rows.length === 0) {
                return res.status(400).json({
                    success: false,
                    message: "Invalid assigned user"
                });
            }
        }

        const hasDesignationColumn = await hasLeadDesignationColumn();

        const result = hasDesignationColumn
            ? await pool.query(
                `INSERT INTO leads (
                    first_name,
                    last_name,
                    email,
                    phone,
                    whatsapp,
                    company,
                    website,
                    designation,
                    amount,
                    source_id,
                    status,
                    assigned_to,
                    notes
                )
                VALUES (
                    $1, $2, $3, $4, $5, $6,
                    $7, $8, $9, $10, $11, $12, $13
                )
                RETURNING *`,
                [
                    first_name.trim(),
                    last_name?.trim() || null,
                    email?.trim().toLowerCase() || null,
                    phone?.trim() || null,
                    whatsapp?.trim() || null,
                    company?.trim() || null,
                    website?.trim() || "No",
                    designation?.trim() || null,
                    leadAmount,
                    source_id || null,
                    status || "NEW",
                    finalAssignedTo,
                    notes?.trim() || null
                ]
            )
            : await pool.query(
                `INSERT INTO leads (
                    first_name,
                    last_name,
                    email,
                    phone,
                    whatsapp,
                    company,
                    website,
                    amount,
                    source_id,
                    status,
                    assigned_to,
                    notes
                )
                VALUES (
                    $1, $2, $3, $4, $5, $6,
                    $7, $8, $9, $10, $11, $12
                )
                RETURNING *`,
                [
                    first_name.trim(),
                    last_name?.trim() || null,
                    email?.trim().toLowerCase() || null,
                    phone?.trim() || null,
                    whatsapp?.trim() || null,
                    company?.trim() || null,
                    website?.trim() || "No",
                    leadAmount,
                    source_id || null,
                    status || "NEW",
                    finalAssignedTo,
                    notes?.trim() || null
                ]
            );

        return res.status(201).json({
            success: true,
            message: "Lead created successfully",
            data: {
                lead: result.rows[0]
            }
        });

    } catch (error) {
        console.error("Create lead error:", error);

        return res.status(500).json({
            success: false,
            message: "Internal server error"
        });
    }
};


// GET ALL LEADS
const getLeads = async (req, res) => {
    try {
        const {
            search = "",
            status,
            source_id,
            assigned_to,
            date_order = "desc",
            page = 1,
            limit = 10
        } = req.query;

        const pageNumber = Math.max(parseInt(page) || 1, 1);
        const limitNumber = Math.min(
            Math.max(parseInt(limit) || 10, 1),
            100
        );

        const offset = (pageNumber - 1) * limitNumber;

        const values = [];
        const conditions = [];

                // Role-based lead visibility
        if (req.user.role === "SALES_PERSON") {
            values.push(req.user.id);
            conditions.push(`l.assigned_to = $${values.length}`);
        }

        if (search.trim()) {
            values.push(`%${search.trim()}%`);

            conditions.push(`
                (
                    l.first_name ILIKE $${values.length}
                    OR l.last_name ILIKE $${values.length}
                    OR l.email ILIKE $${values.length}
                    OR l.phone ILIKE $${values.length}
                    OR l.company ILIKE $${values.length}
                )
            `);
        }

        if (status) {
            values.push(status.toUpperCase());
            conditions.push(`l.status = $${values.length}`);
        }

        if (source_id) {
            values.push(source_id);
            conditions.push(`l.source_id = $${values.length}`);
        }

        if (assigned_to) {
            values.push(assigned_to);
            conditions.push(`l.assigned_to = $${values.length}`);
        }

        const whereClause =
            conditions.length > 0
                ? `WHERE ${conditions.join(" AND ")}`
                : "";

        const dateDirection = date_order.toLowerCase() === "asc" ? "ASC" : "DESC";

        const countResult = await pool.query(
            `
            SELECT COUNT(*)::INTEGER AS total
            FROM leads l
            ${whereClause}
            `,
            values
        );

        const total = countResult.rows[0].total;

        values.push(limitNumber);
        const limitPosition = values.length;

        values.push(offset);
        const offsetPosition = values.length;

        const hasDesignationColumn = await hasLeadDesignationColumn();
        const designationSelect = hasDesignationColumn
            ? "l.designation,"
            : "NULL::TEXT AS designation,";

        const result = await pool.query(
            `
            SELECT
                l.id,
                l.first_name,
                l.last_name,
                l.email,
                l.phone,
                l.company,
                ${designationSelect}
                l.amount,
                l.status,
                l.notes,
                l.created_at,
                l.updated_at,

                ls.id AS source_id,
                ls.name AS source,

                u.id AS assigned_to,
                u.name AS assigned_user

            FROM leads l

            LEFT JOIN lead_sources ls
                ON l.source_id = ls.id

            LEFT JOIN users u
                ON l.assigned_to = u.id

            ${whereClause}

            ORDER BY l.created_at ${dateDirection}

            LIMIT $${limitPosition}
            OFFSET $${offsetPosition}
            `,
            values
        );

        return res.status(200).json({
            success: true,
            message: "Leads fetched successfully",
            data: {
                leads: result.rows,
                pagination: {
                    page: pageNumber,
                    limit: limitNumber,
                    total,
                    totalPages: Math.ceil(total / limitNumber)
                }
            }
        });

    } catch (error) {
        console.error("Get leads error:", error);

        return res.status(500).json({
            success: false,
            message: "Internal server error"
        });
    }
};


// GET SINGLE LEAD
const getLeadById = async (req, res) => {
    try {
        const { id } = req.params;

        const hasDesignationColumn = await hasLeadDesignationColumn();
        const designationSelect = hasDesignationColumn
            ? "l.designation,"
            : "NULL::TEXT AS designation,";

        let query = `
            SELECT
                l.id,
                l.first_name,
                l.last_name,
                l.email,
                l.phone,
                l.company,
                ${designationSelect}
                l.amount,
                l.status,
                l.notes,
                l.created_at,
                l.updated_at,

                ls.id AS source_id,
                ls.name AS source,

                u.id AS assigned_to,
                u.name AS assigned_user

            FROM leads l

            LEFT JOIN lead_sources ls
                ON l.source_id = ls.id

            LEFT JOIN users u
                ON l.assigned_to = u.id

            WHERE l.id = $1
        `;

        const values = [id];

        // Sales Person can only access their assigned lead
        if (req.user.role === "SALES_PERSON") {
            query += ` AND l.assigned_to = $2`;
            values.push(req.user.id);
        }

        const result = await pool.query(query, values);

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Lead not found"
            });
        }

        return res.status(200).json({
            success: true,
            message: "Lead fetched successfully",
            data: {
                lead: result.rows[0]
            }
        });

    } catch (error) {
        console.error("Get lead error:", error);

        return res.status(500).json({
            success: false,
            message: "Internal server error"
        });
    }
};


// UPDATE LEAD
const updateLead = async (req, res) => {
    try {
        await ensureLeadExtraColumns();
        const { id } = req.params;

        if (req.user.role === "SALES_PERSON") {
            const accessCheck = await pool.query(
                `SELECT id
                FROM leads
                WHERE id = $1
                AND assigned_to = $2`,
                [id, req.user.id]
            );

            if (accessCheck.rows.length === 0) {
                return res.status(403).json({
                    success: false,
                    message: "You can only update leads assigned to you"
                });
            }
        }

        const {
            first_name,
            last_name,
            email,
            phone,
            whatsapp,
            company,
            website,
            designation,
            amount,
            source_id,
            notes
        } = req.body;

        const leadAmount = amount === undefined || amount === "" ? null : Number(amount);
        if (leadAmount !== null && (!Number.isFinite(leadAmount) || leadAmount < 0)) {
            return res.status(400).json({
                success: false,
                message: "Amount must be a valid non-negative number"
            });
        }

        const existingLead = await pool.query(
            `SELECT id FROM leads WHERE id = $1`,
            [id]
        );

        if (existingLead.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Lead not found"
            });
        }

        if (!first_name) {
            return res.status(400).json({
                success: false,
                message: "First name is required"
            });
        }

        if (source_id) {
            const sourceResult = await pool.query(
                `SELECT id
                 FROM lead_sources
                 WHERE id = $1
                 AND is_active = TRUE`,
                [source_id]
            );

            if (sourceResult.rows.length === 0) {
                return res.status(400).json({
                    success: false,
                    message: "Invalid or inactive lead source"
                });
            }
        }

        const hasDesignationColumn = await hasLeadDesignationColumn();

        const result = hasDesignationColumn
            ? await pool.query(
                `UPDATE leads
                 SET
                    first_name = $1,
                    last_name = $2,
                    email = $3,
                    phone = $4,
                          whatsapp = $5,
                          company = $6,
                          website = $7,
                          designation = $8,
                                                    amount = $9,
                                                    source_id = $10,
                                                    notes = $11,
                    updated_at = CURRENT_TIMESTAMP
                                            WHERE id = $12
                 RETURNING *`,
                [
                    first_name.trim(),
                    last_name?.trim() || null,
                    email?.trim().toLowerCase() || null,
                    phone?.trim() || null,
                    whatsapp?.trim() || null,
                    company?.trim() || null,
                    website?.trim() || "No",
                    designation?.trim() || null,
                    leadAmount,
                    source_id || null,
                    notes?.trim() || null,
                    id
                ]
            )
            : await pool.query(
                `UPDATE leads
                 SET
                    first_name = $1,
                    last_name = $2,
                    email = $3,
                    phone = $4,
                          whatsapp = $5,
                          company = $6,
                          website = $7,
                                                    amount = $8,
                                                    source_id = $9,
                                                    notes = $10,
                    updated_at = CURRENT_TIMESTAMP
                                            WHERE id = $11
                 RETURNING *`,
                [
                    first_name.trim(),
                    last_name?.trim() || null,
                    email?.trim().toLowerCase() || null,
                    phone?.trim() || null,
                    whatsapp?.trim() || null,
                    company?.trim() || null,
                    website?.trim() || "No",
                    leadAmount,
                    source_id || null,
                    notes?.trim() || null,
                    id
                ]
            );

        return res.status(200).json({
            success: true,
            message: "Lead updated successfully",
            data: {
                lead: result.rows[0]
            }
        });

    } catch (error) {
        console.error("Update lead error:", error);

        return res.status(500).json({
            success: false,
            message: "Internal server error"
        });
    }
};


// DELETE LEAD
const deleteLead = async (req, res) => {
    try {
        const { id } = req.params;

        const conditions = ["id = $1"];
        const values = [id];

        if (req.user.role === "SALES_PERSON") {
            conditions.push("assigned_to = $2");
            values.push(req.user.id);
        }

        const result = await pool.query(
            `DELETE FROM leads
             WHERE ${conditions.join(" AND ")}
             RETURNING id`,
            values
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Lead not found"
            });
        }

        return res.status(200).json({
            success: true,
            message: "Lead deleted successfully",
            data: {
                id: result.rows[0].id
            }
        });

    } catch (error) {
        console.error("Delete lead error:", error);

        return res.status(500).json({
            success: false,
            message: "Internal server error"
        });
    }
};


// CHANGE STATUS
const updateLeadStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body;

        if (req.user.role === "SALES_PERSON") {
            const accessCheck = await pool.query(
                `SELECT id
                FROM leads
                WHERE id = $1
                AND assigned_to = $2`,
                [id, req.user.id]
            );

            if (accessCheck.rows.length === 0) {
                return res.status(403).json({
                    success: false,
                    message: "You can only update assigned leads"
                });
            }
        }

        const allowedStatuses = [
            "NEW",
            "CONTACTED",
            "QUALIFIED",
            "PROPOSAL",
            "NEGOTIATION",
            "CONVERTED",
            "LOST"
        ];

        if (!status || !allowedStatuses.includes(status.toUpperCase())) {
            return res.status(400).json({
                success: false,
                message: "Invalid lead status"
            });
        }

        const result = await pool.query(
            `UPDATE leads
             SET
                status = $1,
                updated_at = CURRENT_TIMESTAMP
             WHERE id = $2
             RETURNING *`,
            [
                status.toUpperCase(),
                id
            ]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Lead not found"
            });
        }

        return res.status(200).json({
            success: true,
            message: "Lead status updated successfully",
            data: {
                lead: result.rows[0]
            }
        });

    } catch (error) {
        console.error("Update lead status error:", error);

        return res.status(500).json({
            success: false,
            message: "Internal server error"
        });
    }
};


// ASSIGN / REASSIGN LEAD
const assignLead = async (req, res) => {
    try {
        const { id } = req.params;
        const { assigned_to } = req.body;

        if (!assigned_to) {
            return res.status(400).json({
                success: false,
                message: "assigned_to is required"
            });
        }

        const userResult = await pool.query(
            `SELECT u.id
             FROM users u
             JOIN roles r ON u.role_id = r.id
             WHERE u.id = $1
             AND u.status = 'ACTIVE'
             AND r.name IN ('SALES_PERSON', 'SALES_MANAGER')`,
            [assigned_to]
        );

        if (userResult.rows.length === 0) {
            return res.status(400).json({
                success: false,
                message: "User cannot be assigned leads"
            });
        }

        const result = await pool.query(
            `UPDATE leads
             SET
                assigned_to = $1,
                updated_at = CURRENT_TIMESTAMP
             WHERE id = $2
             RETURNING *`,
            [
                assigned_to,
                id
            ]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Lead not found"
            });
        }

        return res.status(200).json({
            success: true,
            message: "Lead assigned successfully",
            data: {
                lead: result.rows[0]
            }
        });

    } catch (error) {
        console.error("Assign lead error:", error);

        return res.status(500).json({
            success: false,
            message: "Internal server error"
        });
    }
};


module.exports = {
    createLead,
    getLeads,
    getLeadById,
    updateLead,
    deleteLead,
    updateLeadStatus,
    assignLead
};