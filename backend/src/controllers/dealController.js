const pool = require("../config/db");


// Stage probability
const stageProbability = {
    QUALIFIED: 10,
    PROPOSAL: 30,
    DEMO: 50,
    NEGOTIATION: 70,
    CLOSED_WON: 100,
    CLOSED_LOST: 0
};

const allowedStages = Object.keys(stageProbability);


// CREATE DEAL
const createDeal = async (req, res) => {
    try {
        const {
            lead_id,
            contact_id,
            assigned_to,
            title,
            description,
            amount,
            stage,
            expected_close_date
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
                message: "Deal cannot belong to both lead and contact"
            });
        }

        if (!title || !title.trim()) {
            return res.status(400).json({
                success: false,
                message: "Deal title is required"
            });
        }

        if (amount === undefined || amount === null || amount < 0) {
            return res.status(400).json({
                success: false,
                message: "Valid deal amount is required"
            });
        }

        const dealStage = (stage || "QUALIFIED").toUpperCase();

        if (!allowedStages.includes(dealStage)) {
            return res.status(400).json({
                success: false,
                message: "Invalid deal stage"
            });
        }

        // Validate lead
        if (lead_id) {
            const leadCheck = await pool.query(
                `SELECT id, assigned_to
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

            if (
                req.user.role === "SALES_PERSON" &&
                Number(leadCheck.rows[0].assigned_to) !== Number(req.user.id)
            ) {
                return res.status(403).json({
                    success: false,
                    message: "You can only create deals from leads assigned to you"
                });
            }
        }

        // Validate contact
        if (contact_id) {
            const contactCheck = await pool.query(
                `SELECT id, owner_id
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

            if (
                req.user.role === "SALES_PERSON" &&
                Number(contactCheck.rows[0].owner_id) !== Number(req.user.id)
            ) {
                return res.status(403).json({
                    success: false,
                    message: "You can only create deals from contacts assigned to you"
                });
            }
        }

        const finalAssignedTo = assigned_to || req.user.id;

        // Validate assigned user
        const userCheck = await pool.query(
            `SELECT u.id
             FROM users u
             JOIN roles r
                ON u.role_id = r.id
             WHERE u.id = $1
             AND u.status = 'ACTIVE'
             AND r.name IN (
                'ADMIN',
                'SALES_MANAGER',
                'SALES_PERSON'
             )`,
            [finalAssignedTo]
        );

        if (userCheck.rows.length === 0) {
            return res.status(400).json({
                success: false,
                message: "Invalid assigned sales user"
            });
        }

        const result = await pool.query(
            `INSERT INTO deals (
                lead_id,
                contact_id,
                assigned_to,
                title,
                description,
                amount,
                stage,
                probability,
                expected_close_date
            )
            VALUES (
                $1,$2,$3,$4,$5,$6,$7,$8,$9
            )
            RETURNING *`,
            [
                lead_id || null,
                contact_id || null,
                finalAssignedTo,
                title.trim(),
                description?.trim() || null,
                amount,
                dealStage,
                stageProbability[dealStage],
                expected_close_date || null
            ]
        );

        return res.status(201).json({
            success: true,
            message: "Deal created successfully",
            data: {
                deal: result.rows[0]
            }
        });

    } catch (error) {
        console.error("Create deal error:", error);

        return res.status(500).json({
            success: false,
            message: "Internal server error"
        });
    }
};


// GET DEALS
const getDeals = async (req, res) => {
    try {
        const {
            stage,
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

        // Sales Person only sees assigned deals
        if (req.user.role === "SALES_PERSON") {
            values.push(req.user.id);
            conditions.push(
                `d.assigned_to = $${values.length}`
            );
        }

        if (stage) {
            values.push(stage.toUpperCase());

            conditions.push(
                `d.stage = $${values.length}`
            );
        }

        if (status) {
            values.push(status.toUpperCase());

            conditions.push(
                `d.status = $${values.length}`
            );
        }

        if (assigned_to) {
            values.push(assigned_to);

            conditions.push(
                `d.assigned_to = $${values.length}`
            );
        }

        if (lead_id) {
            values.push(lead_id);

            conditions.push(
                `d.lead_id = $${values.length}`
            );
        }

        if (contact_id) {
            values.push(contact_id);

            conditions.push(
                `d.contact_id = $${values.length}`
            );
        }

        const whereClause =
            conditions.length > 0
                ? `WHERE ${conditions.join(" AND ")}`
                : "";

        const countResult = await pool.query(
            `
            SELECT COUNT(*)::INTEGER AS total
            FROM deals d
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
                d.*,

                customer.id AS customer_id,

                u.name AS assigned_user,

                l.first_name AS lead_first_name,
                l.last_name AS lead_last_name,

                c.first_name AS contact_first_name,
                c.last_name AS contact_last_name

            FROM deals d

            JOIN users u
                ON d.assigned_to = u.id

            LEFT JOIN leads l
                ON d.lead_id = l.id

            LEFT JOIN contacts c
                ON d.contact_id = c.id

            LEFT JOIN customers customer
                ON customer.deal_id = d.id

            ${whereClause}

            ORDER BY d.created_at DESC

            LIMIT $${limitPosition}
            OFFSET $${offsetPosition}
            `,
            values
        );

        return res.status(200).json({
            success: true,
            message: "Deals fetched successfully",
            data: {
                deals: result.rows,
                pagination: {
                    page: pageNumber,
                    limit: limitNumber,
                    total,
                    totalPages: Math.ceil(
                        total / limitNumber
                    )
                }
            }
        });

    } catch (error) {
        console.error("Get deals error:", error);

        return res.status(500).json({
            success: false,
            message: "Internal server error"
        });
    }
};


// GET DEAL BY ID
const getDealById = async (req, res) => {
    try {
        const { id } = req.params;

        let query = `
            SELECT
                d.*,

                u.name AS assigned_user,

                l.first_name AS lead_first_name,
                l.last_name AS lead_last_name,

                c.first_name AS contact_first_name,
                c.last_name AS contact_last_name

            FROM deals d

            JOIN users u
                ON d.assigned_to = u.id

            LEFT JOIN leads l
                ON d.lead_id = l.id

            LEFT JOIN contacts c
                ON d.contact_id = c.id

            WHERE d.id = $1
        `;

        const values = [id];

        if (req.user.role === "SALES_PERSON") {
            query += ` AND d.assigned_to = $2`;
            values.push(req.user.id);
        }

        const result = await pool.query(
            query,
            values
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Deal not found"
            });
        }

        return res.status(200).json({
            success: true,
            message: "Deal fetched successfully",
            data: {
                deal: result.rows[0]
            }
        });

    } catch (error) {
        console.error("Get deal error:", error);

        return res.status(500).json({
            success: false,
            message: "Internal server error"
        });
    }
};


// UPDATE DEAL
const updateDeal = async (req, res) => {
    try {
        const { id } = req.params;

        const {
            title,
            description,
            amount,
            stage,
            expected_close_date
        } = req.body || {};

        // Check ownership
        const existing = await pool.query(
            `SELECT *
             FROM deals
             WHERE id = $1`,
            [id]
        );

        if (existing.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Deal not found"
            });
        }

        const deal = existing.rows[0];

        if (
            req.user.role === "SALES_PERSON" &&
            Number(deal.assigned_to) !== Number(req.user.id)
        ) {
            return res.status(403).json({
                success: false,
                message: "You can only update your assigned deals"
            });
        }

        let newStage = stage
            ? stage.toUpperCase()
            : deal.stage;

        if (!allowedStages.includes(newStage)) {
            return res.status(400).json({
                success: false,
                message: "Invalid deal stage"
            });
        }

        let newStatus = deal.status;

        let actualCloseDate = deal.actual_close_date;

        let lostReason = deal.lost_reason;

        if (newStage === "CLOSED_WON") {
            newStatus = "WON";
            actualCloseDate = new Date();
        }

        if (newStage === "CLOSED_LOST") {
            newStatus = "LOST";
            actualCloseDate = new Date();

            if (!req.body.lost_reason) {
                return res.status(400).json({
                    success: false,
                    message: "lost_reason is required when closing a deal as lost"
                });
            }

            lostReason =
                req.body.lost_reason.trim();
        }

        const result = await pool.query(
            `UPDATE deals
             SET
                title = COALESCE($1, title),
                description = COALESCE($2, description),
                amount = COALESCE($3, amount),
                stage = $4,
                probability = $5,
                expected_close_date = COALESCE($6, expected_close_date),
                actual_close_date = $7,
                lost_reason = $8,
                status = $9,
                updated_at = CURRENT_TIMESTAMP

             WHERE id = $10

             RETURNING *`,
            [
                title?.trim() || null,
                description?.trim() || null,
                amount ?? null,
                newStage,
                stageProbability[newStage],
                expected_close_date || null,
                actualCloseDate,
                lostReason,
                newStatus,
                id
            ]
        );

        return res.status(200).json({
            success: true,
            message: "Deal updated successfully",
            data: {
                deal: result.rows[0]
            }
        });

    } catch (error) {
        console.error("Update deal error:", error);

        return res.status(500).json({
            success: false,
            message: "Internal server error"
        });
    }
};


// DELETE DEAL
const deleteDeal = async (req, res) => {
    try {
        const { id } = req.params;

        const result = await pool.query(
            `DELETE FROM deals
             WHERE id = $1
             RETURNING id`,
            [id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Deal not found"
            });
        }

        return res.status(200).json({
            success: true,
            message: "Deal deleted successfully",
            data: {
                id: result.rows[0].id
            }
        });

    } catch (error) {
        console.error("Delete deal error:", error);

        return res.status(500).json({
            success: false,
            message: "Internal server error"
        });
    }
};


module.exports = {
    createDeal,
    getDeals,
    getDealById,
    updateDeal,
    deleteDeal
};