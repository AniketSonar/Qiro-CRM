const pool = require("../config/db");
const { advanceLeadStage } = require("../utils/leadStage");


// CREATE FOLLOW-UP
const createFollowUp = async (req, res) => {
    try {
        const {
            lead_id,
            contact_id,
            assigned_to,
            follow_up_type,
            scheduled_at,
            notes
        } = req.body || {};

        if (!lead_id && !contact_id) {
            return res.status(400).json({
                success: false,
                message: "Either lead_id or contact_id is required"
            });
        }

        if (lead_id && contact_id) {
            return res.status(400).json({
                success: false,
                message: "Follow-up cannot belong to both lead and contact"
            });
        }

        if (!scheduled_at) {
            return res.status(400).json({
                success: false,
                message: "scheduled_at is required"
            });
        }

        // Validate assigned user
        const userCheck = await pool.query(
            `SELECT u.id
             FROM users u
             JOIN roles r ON u.role_id = r.id
             WHERE u.id = $1
             AND u.status = 'ACTIVE'
             AND r.name IN ('ADMIN', 'SALES_MANAGER', 'SALES_PERSON')`,
            [assigned_to || req.user.id]
        );

        if (userCheck.rows.length === 0) {
            return res.status(400).json({
                success: false,
                message: "Invalid assigned user"
            });
        }

        const finalAssignedTo = assigned_to || req.user.id;

        // Validate lead
        if (lead_id) {
            const leadCheck = await pool.query(
                `SELECT id
                 FROM leads
                 WHERE id = $1`,
                [lead_id]
            );

            if (leadCheck.rows.length === 0) {
                return res.status(404).json({
                    success: false,
                    message: "Lead not found"
                });
            }
        }

        // Validate contact
        if (contact_id) {
            const contactCheck = await pool.query(
                `SELECT id
                 FROM contacts
                 WHERE id = $1`,
                [contact_id]
            );

            if (contactCheck.rows.length === 0) {
                return res.status(404).json({
                    success: false,
                    message: "Contact not found"
                });
            }
        }

        const allowedTypes = [
            "CALL",
            "EMAIL",
            "WHATSAPP",
            "MEETING",
            "DEMO",
            "OTHER"
        ];

        const type = (follow_up_type || "CALL").toUpperCase();

        if (!allowedTypes.includes(type)) {
            return res.status(400).json({
                success: false,
                message: "Invalid follow-up type"
            });
        }

        const result = await pool.query(
            `INSERT INTO follow_ups (
                lead_id,
                contact_id,
                assigned_to,
                follow_up_type,
                scheduled_at,
                notes
            )
            VALUES ($1, $2, $3, $4, $5, $6)
            RETURNING *`,
            [
                lead_id || null,
                contact_id || null,
                finalAssignedTo,
                type,
                scheduled_at,
                notes?.trim() || null
            ]
        );

        return res.status(201).json({
            success: true,
            message: "Follow-up created successfully",
            data: {
                followUp: result.rows[0]
            }
        });

    } catch (error) {
        console.error("Create follow-up error:", error);

        return res.status(500).json({
            success: false,
            message: "Internal server error"
        });
    }
};


// GET FOLLOW-UPS
const getFollowUps = async (req, res) => {
    try {
        const {
            status,
            assigned_to,
            lead_id,
            contact_id,
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

        // Sales Person only sees own follow-ups
        if (req.user.role === "SALES_PERSON") {
            values.push(req.user.id);
            conditions.push(`f.assigned_to = $${values.length}`);
        }

        if (assigned_to) {
            values.push(assigned_to);
            conditions.push(`f.assigned_to = $${values.length}`);
        }

        if (status) {
            values.push(status.toUpperCase());
            conditions.push(`f.status = $${values.length}`);
        }

        if (lead_id) {
            values.push(lead_id);
            conditions.push(`f.lead_id = $${values.length}`);
        }

        if (contact_id) {
            values.push(contact_id);
            conditions.push(`f.contact_id = $${values.length}`);
        }

        const whereClause =
            conditions.length > 0
                ? `WHERE ${conditions.join(" AND ")}`
                : "";

        const countResult = await pool.query(
            `
            SELECT COUNT(*)::INTEGER AS total
            FROM follow_ups f
            ${whereClause}
            `,
            values
        );

        const total = countResult.rows[0].total;

        values.push(limitNumber);
        const limitPosition = values.length;

        values.push(offset);
        const offsetPosition = values.length;

        const result = await pool.query(
            `
            SELECT
                f.*,

                u.name AS assigned_user,
                fo.name AS outcome_name,

                l.first_name AS lead_first_name,
                l.last_name AS lead_last_name,

                c.first_name AS contact_first_name,
                c.last_name AS contact_last_name

            FROM follow_ups f

            JOIN users u
                ON f.assigned_to = u.id

            LEFT JOIN leads l
                ON f.lead_id = l.id

            LEFT JOIN contacts c
                ON f.contact_id = c.id

            LEFT JOIN follow_up_outcomes fo
                ON f.outcome_id = fo.id

            ${whereClause}

            ORDER BY f.scheduled_at ASC

            LIMIT $${limitPosition}
            OFFSET $${offsetPosition}
            `,
            values
        );

        return res.status(200).json({
            success: true,
            message: "Follow-ups fetched successfully",
            data: {
                followUps: result.rows,
                pagination: {
                    page: pageNumber,
                    limit: limitNumber,
                    total,
                    totalPages: Math.ceil(total / limitNumber)
                }
            }
        });

    } catch (error) {
        console.error("Get follow-ups error:", error);

        return res.status(500).json({
            success: false,
            message: "Internal server error"
        });
    }
};


// GET SINGLE FOLLOW-UP
const getFollowUpById = async (req, res) => {
    try {
        const { id } = req.params;

        let query = `
            SELECT
                f.*,
                u.name AS assigned_user,

                l.first_name AS lead_first_name,
                l.last_name AS lead_last_name,

                c.first_name AS contact_first_name,
                c.last_name AS contact_last_name

            FROM follow_ups f

            JOIN users u
                ON f.assigned_to = u.id

            LEFT JOIN leads l
                ON f.lead_id = l.id

            LEFT JOIN contacts c
                ON f.contact_id = c.id

            WHERE f.id = $1
        `;

        const values = [id];

        if (req.user.role === "SALES_PERSON") {
            query += ` AND f.assigned_to = $2`;
            values.push(req.user.id);
        }

        const result = await pool.query(query, values);

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Follow-up not found"
            });
        }

        return res.status(200).json({
            success: true,
            message: "Follow-up fetched successfully",
            data: {
                followUp: result.rows[0]
            }
        });

    } catch (error) {
        console.error("Get follow-up error:", error);

        return res.status(500).json({
            success: false,
            message: "Internal server error"
        });
    }
};


// UPDATE FOLLOW-UP
const updateFollowUp = async (req, res) => {
    try {
        const { id } = req.params;

        const {
            follow_up_type,
            scheduled_at,
            notes
        } = req.body || {};

        if (req.user.role === "SALES_PERSON") {
            const accessCheck = await pool.query(
                `SELECT id
                 FROM follow_ups
                 WHERE id = $1
                 AND assigned_to = $2`,
                [id, req.user.id]
            );

            if (accessCheck.rows.length === 0) {
                return res.status(403).json({
                    success: false,
                    message: "You can only update your follow-ups"
                });
            }
        }

        const allowedTypes = [
            "CALL",
            "EMAIL",
            "WHATSAPP",
            "MEETING",
            "DEMO",
            "OTHER"
        ];

        const type = follow_up_type?.toUpperCase();

        if (type && !allowedTypes.includes(type)) {
            return res.status(400).json({
                success: false,
                message: "Invalid follow-up type"
            });
        }

        const result = await pool.query(
            `UPDATE follow_ups
             SET
                follow_up_type = COALESCE($1, follow_up_type),
                scheduled_at = COALESCE($2, scheduled_at),
                notes = COALESCE($3, notes),
                updated_at = CURRENT_TIMESTAMP
             WHERE id = $4
             RETURNING *`,
            [
                type || null,
                scheduled_at || null,
                notes?.trim() || null,
                id
            ]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Follow-up not found"
            });
        }

        return res.status(200).json({
            success: true,
            message: "Follow-up updated successfully",
            data: {
                followUp: result.rows[0]
            }
        });

    } catch (error) {
        console.error("Update follow-up error:", error);

        return res.status(500).json({
            success: false,
            message: "Internal server error"
        });
    }
};


// COMPLETE FOLLOW-UP
const completeFollowUp = async (req, res) => {
    try {
        const { id } = req.params;
        const { outcome_id, outcome } = req.body || {};
        let outcomeName = null;

        if (outcome_id) {
            const outcomeResult = await pool.query(
                `SELECT name
                 FROM follow_up_outcomes
                 WHERE id = $1
                 AND is_active = TRUE`,
                [outcome_id]
            );

            if (outcomeResult.rows.length === 0) {
                return res.status(400).json({
                    success: false,
                    message: "Invalid or inactive outcome"
                });
            }

            outcomeName = outcomeResult.rows[0].name;
        }

        if (!outcome_id && (!outcome || !outcome.trim())) {
            return res.status(400).json({
                success: false,
                message: "Outcome is required"
            });
        }

        if (req.user.role === "SALES_PERSON") {
            const accessCheck = await pool.query(
                `SELECT id
                 FROM follow_ups
                 WHERE id = $1
                 AND assigned_to = $2`,
                [id, req.user.id]
            );

            if (accessCheck.rows.length === 0) {
                return res.status(403).json({
                    success: false,
                    message: "You can only complete your follow-ups"
                });
            }
        }

        const result = await pool.query(
            `UPDATE follow_ups
             SET
                status = 'COMPLETED',
                outcome_id = $1,
                outcome = $2,
                completed_at = CURRENT_TIMESTAMP,
                updated_at = CURRENT_TIMESTAMP
             WHERE id = $3
             AND status = 'PENDING'
             RETURNING *`,
            [
                outcome_id || null,
                outcome?.trim() || outcomeName,
                id
            ]
        );

        if (result.rows.length === 0) {
            const existing = await pool.query(
                `SELECT status FROM follow_ups WHERE id = $1`,
                [id]
            );

            return res.status(existing.rows.length > 0 ? 409 : 404).json({
                success: false,
                message: existing.rows.length > 0
                    ? "Follow-up is already completed or cancelled"
                    : "Follow-up not found"
            });
        }

            const completedFollowUp = result.rows[0];
            const targetStatus = ["MEETING", "DEMO"].includes(
                completedFollowUp.follow_up_type?.toUpperCase()
            )
                ? "QUALIFIED"
                : "CONTACTED";
            await advanceLeadStage(pool, completedFollowUp.lead_id, targetStatus);

        return res.status(200).json({
            success: true,
            message: "Follow-up completed successfully",
            data: {
                followUp: result.rows[0]
            }
        });

    } catch (error) {
        console.error("Complete follow-up error:", error);

        return res.status(500).json({
            success: false,
            message: "Internal server error"
        });
    }
};


// CANCEL FOLLOW-UP
const cancelFollowUp = async (req, res) => {
    try {
        const { id } = req.params;

        if (req.user.role === "SALES_PERSON") {
            const accessCheck = await pool.query(
                `SELECT id
                 FROM follow_ups
                 WHERE id = $1
                 AND assigned_to = $2`,
                [id, req.user.id]
            );

            if (accessCheck.rows.length === 0) {
                return res.status(403).json({
                    success: false,
                    message: "You can only cancel your follow-ups"
                });
            }
        }

        const result = await pool.query(
            `UPDATE follow_ups
             SET
                status = 'CANCELLED',
                updated_at = CURRENT_TIMESTAMP
             WHERE id = $1
             RETURNING *`,
            [id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Follow-up not found"
            });
        }

        return res.status(200).json({
            success: true,
            message: "Follow-up cancelled successfully",
            data: {
                followUp: result.rows[0]
            }
        });

    } catch (error) {
        console.error("Cancel follow-up error:", error);

        return res.status(500).json({
            success: false,
            message: "Internal server error"
        });
    }
};


module.exports = {
    createFollowUp,
    getFollowUps,
    getFollowUpById,
    updateFollowUp,
    completeFollowUp,
    cancelFollowUp
};