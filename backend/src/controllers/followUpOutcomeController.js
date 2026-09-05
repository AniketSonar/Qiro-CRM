const pool = require("../config/db");


// GET ALL OUTCOMES
const getOutcomes = async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT *
             FROM follow_up_outcomes
             WHERE is_active = TRUE
             ORDER BY name ASC`
        );

        return res.status(200).json({
            success: true,
            message: "Follow-up outcomes fetched successfully",
            data: {
                outcomes: result.rows
            }
        });

    } catch (error) {
        console.error("Get outcomes error:", error);

        return res.status(500).json({
            success: false,
            message: "Internal server error"
        });
    }
};


// CREATE OUTCOME
const createOutcome = async (req, res) => {
    try {
        const {
            name,
            description
        } = req.body || {};

        if (!name || !name.trim()) {
            return res.status(400).json({
                success: false,
                message: "Outcome name is required"
            });
        }

        const formattedName = name
            .trim()
            .toUpperCase()
            .replace(/\s+/g, "_");

        const existing = await pool.query(
            `SELECT id
             FROM follow_up_outcomes
             WHERE name = $1`,
            [formattedName]
        );

        if (existing.rows.length > 0) {
            return res.status(409).json({
                success: false,
                message: "Outcome already exists"
            });
        }

        const result = await pool.query(
            `INSERT INTO follow_up_outcomes (
                name,
                description
            )
            VALUES ($1, $2)
            RETURNING *`,
            [
                formattedName,
                description?.trim() || null
            ]
        );

        return res.status(201).json({
            success: true,
            message: "Follow-up outcome created successfully",
            data: {
                outcome: result.rows[0]
            }
        });

    } catch (error) {
        console.error("Create outcome error:", error);

        return res.status(500).json({
            success: false,
            message: "Internal server error"
        });
    }
};


// UPDATE OUTCOME
const updateOutcome = async (req, res) => {
    try {
        const { id } = req.params;

        const {
            name,
            description,
            is_active
        } = req.body || {};

        if (!name || !name.trim()) {
            return res.status(400).json({
                success: false,
                message: "Outcome name is required"
            });
        }

        const formattedName = name
            .trim()
            .toUpperCase()
            .replace(/\s+/g, "_");

        const result = await pool.query(
            `UPDATE follow_up_outcomes
             SET
                name = $1,
                description = $2,
                is_active = COALESCE($3, is_active),
                updated_at = CURRENT_TIMESTAMP
             WHERE id = $4
             RETURNING *`,
            [
                formattedName,
                description?.trim() || null,
                is_active,
                id
            ]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Outcome not found"
            });
        }

        return res.status(200).json({
            success: true,
            message: "Outcome updated successfully",
            data: {
                outcome: result.rows[0]
            }
        });

    } catch (error) {
        console.error("Update outcome error:", error);

        return res.status(500).json({
            success: false,
            message: "Internal server error"
        });
    }
};


// DELETE / DEACTIVATE OUTCOME
const deactivateOutcome = async (req, res) => {
    try {
        const { id } = req.params;

        const result = await pool.query(
            `UPDATE follow_up_outcomes
             SET
                is_active = FALSE,
                updated_at = CURRENT_TIMESTAMP
             WHERE id = $1
             RETURNING *`,
            [id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Outcome not found"
            });
        }

        return res.status(200).json({
            success: true,
            message: "Outcome deactivated successfully",
            data: {
                outcome: result.rows[0]
            }
        });

    } catch (error) {
        console.error("Deactivate outcome error:", error);

        return res.status(500).json({
            success: false,
            message: "Internal server error"
        });
    }
};


// SET FOLLOW-UP OUTCOME
const setFollowUpOutcome = async (req, res) => {
    try {
        const { id } = req.params;
        const {
            outcome_id,
            notes
        } = req.body || {};

        if (!outcome_id) {
            return res.status(400).json({
                success: false,
                message: "outcome_id is required"
            });
        }

        // Check outcome
        const outcomeCheck = await pool.query(
            `SELECT id, name
             FROM follow_up_outcomes
             WHERE id = $1
             AND is_active = TRUE`,
            [outcome_id]
        );

        if (outcomeCheck.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Invalid or inactive outcome"
            });
        }

        // Check follow-up
        const followUpCheck = await pool.query(
            `SELECT *
             FROM follow_ups
             WHERE id = $1`,
            [id]
        );

        if (followUpCheck.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Follow-up not found"
            });
        }

        const followUp = followUpCheck.rows[0];

        // Sales Person can only update own follow-up
        if (
            req.user.role === "SALES_PERSON" &&
            followUp.assigned_to !== req.user.id
        ) {
            return res.status(403).json({
                success: false,
                message: "You can only update your own follow-ups"
            });
        }

        const result = await pool.query(
            `UPDATE follow_ups
             SET
                outcome_id = $1,
                outcome = $2,
                status = 'COMPLETED',
                completed_at = COALESCE(
                    completed_at,
                    CURRENT_TIMESTAMP
                ),
                updated_at = CURRENT_TIMESTAMP
             WHERE id = $3
             RETURNING *`,
            [
                outcome_id,
                outcomeCheck.rows[0].name,
                id
            ]
        );

        return res.status(200).json({
            success: true,
            message: "Follow-up outcome recorded successfully",
            data: {
                followUp: result.rows[0]
            }
        });

    } catch (error) {
        console.error("Set follow-up outcome error:", error);

        return res.status(500).json({
            success: false,
            message: "Internal server error"
        });
    }
};


module.exports = {
    getOutcomes,
    createOutcome,
    updateOutcome,
    deactivateOutcome,
    setFollowUpOutcome
};