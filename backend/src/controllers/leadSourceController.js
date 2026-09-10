const pool = require("../config/db");

// CREATE SOURCE
const createLeadSource = async (req, res) => {
    try {
        const { name, description } = req.body;

        if (!name || !name.trim()) {
            return res.status(400).json({
                success: false,
                message: "Source name is required"
            });
        }

        const cleanName = name.trim();

        const existing = await pool.query(
            `SELECT id
             FROM lead_sources
             WHERE LOWER(name) = LOWER($1)`,
            [cleanName]
        );

        if (existing.rows.length > 0) {
            return res.status(409).json({
                success: false,
                message: "Lead source already exists"
            });
        }

        const result = await pool.query(
            `INSERT INTO lead_sources (
                name,
                description
            )
            VALUES ($1, $2)
            RETURNING *`,
            [
                cleanName,
                description?.trim() || null
            ]
        );

        return res.status(201).json({
            success: true,
            message: "Lead source created successfully",
            data: {
                source: result.rows[0]
            }
        });

    } catch (error) {
        console.error("Create lead source error:", error);

        return res.status(500).json({
            success: false,
            message: "Internal server error"
        });
    }
};


// GET ALL SOURCES
const getLeadSources = async (req, res) => {
    try {
        const { includeInactive = "false" } = req.query;

        let query = `
            SELECT
                id,
                name,
                description,
                is_active,
                created_at,
                updated_at
            FROM lead_sources
        `;

        const values = [];

        // Non-admin users only see active sources
        if (
            req.user.role !== "ADMIN" ||
            includeInactive !== "true"
        ) {
            query += ` WHERE is_active = TRUE`;
        }

        query += ` ORDER BY name ASC`;

        const result = await pool.query(query, values);

        return res.status(200).json({
            success: true,
            message: "Lead sources fetched successfully",
            data: {
                sources: result.rows
            }
        });

    } catch (error) {
        console.error("Get lead sources error:", error);

        return res.status(500).json({
            success: false,
            message: "Internal server error"
        });
    }
};


// GET SOURCE BY ID
const getLeadSourceById = async (req, res) => {
    try {
        const { id } = req.params;

        const result = await pool.query(
            `SELECT
                id,
                name,
                description,
                is_active,
                created_at,
                updated_at
             FROM lead_sources
             WHERE id = $1`,
            [id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Lead source not found"
            });
        }

        // Non-admin users cannot view inactive source
        if (
            result.rows[0].is_active === false &&
            req.user.role !== "ADMIN"
        ) {
            return res.status(404).json({
                success: false,
                message: "Lead source not found"
            });
        }

        return res.status(200).json({
            success: true,
            message: "Lead source fetched successfully",
            data: {
                source: result.rows[0]
            }
        });

    } catch (error) {
        console.error("Get lead source error:", error);

        return res.status(500).json({
            success: false,
            message: "Internal server error"
        });
    }
};


// UPDATE SOURCE
const updateLeadSource = async (req, res) => {
    try {
        const { id } = req.params;
        const { name, description } = req.body;

        if (!name || !name.trim()) {
            return res.status(400).json({
                success: false,
                message: "Source name is required"
            });
        }

        const cleanName = name.trim();

        const existing = await pool.query(
            `SELECT id
             FROM lead_sources
             WHERE LOWER(name) = LOWER($1)
             AND id != $2`,
            [cleanName, id]
        );

        if (existing.rows.length > 0) {
            return res.status(409).json({
                success: false,
                message: "Another lead source with this name already exists"
            });
        }

        const result = await pool.query(
            `UPDATE lead_sources
             SET
                name = $1,
                description = $2,
                updated_at = CURRENT_TIMESTAMP
             WHERE id = $3
             RETURNING *`,
            [
                cleanName,
                description?.trim() || null,
                id
            ]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Lead source not found"
            });
        }

        return res.status(200).json({
            success: true,
            message: "Lead source updated successfully",
            data: {
                source: result.rows[0]
            }
        });

    } catch (error) {
        console.error("Update lead source error:", error);

        return res.status(500).json({
            success: false,
            message: "Internal server error"
        });
    }
};


// ACTIVATE / DEACTIVATE SOURCE
const updateLeadSourceStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const { is_active } = req.body;

        if (typeof is_active !== "boolean") {
            return res.status(400).json({
                success: false,
                message: "is_active must be true or false"
            });
        }

        const result = await pool.query(
            `UPDATE lead_sources
             SET
                is_active = $1,
                updated_at = CURRENT_TIMESTAMP
             WHERE id = $2
             RETURNING *`,
            [
                is_active,
                id
            ]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Lead source not found"
            });
        }

        return res.status(200).json({
            success: true,
            message: is_active
                ? "Lead source activated successfully"
                : "Lead source deactivated successfully",
            data: {
                source: result.rows[0]
            }
        });

    } catch (error) {
        console.error("Lead source status error:", error);

        return res.status(500).json({
            success: false,
            message: "Internal server error"
        });
    }
};


// DELETE SOURCE
const deleteLeadSource = async (req, res) => {
    try {
        const { id } = req.params;

        // Check whether leads are using this source
        const usage = await pool.query(
            `SELECT COUNT(*)::INTEGER AS count
             FROM leads
             WHERE source_id = $1`,
            [id]
        );

        if (usage.rows[0].count > 0) {
            return res.status(409).json({
                success: false,
                message:
                    "This source is being used by existing leads. Deactivate it instead of deleting it."
            });
        }

        const result = await pool.query(
            `DELETE FROM lead_sources
             WHERE id = $1
             RETURNING id`,
            [id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Lead source not found"
            });
        }

        return res.status(200).json({
            success: true,
            message: "Lead source deleted successfully",
            data: {
                id: result.rows[0].id
            }
        });

    } catch (error) {
        console.error("Delete lead source error:", error);

        return res.status(500).json({
            success: false,
            message: "Internal server error"
        });
    }
};


module.exports = {
    createLeadSource,
    getLeadSources,
    getLeadSourceById,
    updateLeadSource,
    updateLeadSourceStatus,
    deleteLeadSource
};