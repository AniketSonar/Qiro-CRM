const pool = require("../config/db");

// CREATE ACTIVITY
const createActivity = async (req, res) => {
    try {
        const {
            lead_id,
            contact_id,
            activity_type,
            subject,
            description,
            activity_at
        } = req.body;

        const performed_by = req.user.id;

        // Basic validation
        if (!activity_type) {
            return res.status(400).json({
                success: false,
                message: "Activity type is required"
            });
        }

        if (!lead_id && !contact_id) {
            return res.status(400).json({
                success: false,
                message: "Either lead_id or contact_id is required"
            });
        }

        const result = await pool.query(
            `
            INSERT INTO activities
            (
                lead_id,
                contact_id,
                performed_by,
                activity_type,
                subject,
                description,
                activity_at
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7)
            RETURNING *
            `,
            [
                lead_id || null,
                contact_id || null,
                performed_by,
                activity_type,
                subject || null,
                description || null,
                activity_at || new Date()
            ]
        );

        res.status(201).json({
            success: true,
            message: "Activity created successfully",
            data: result.rows[0]
        });

    } catch (error) {
        console.error("Create activity error:", error);

        res.status(500).json({
            success: false,
            message: "Internal server error"
        });
    }
};


// GET ALL ACTIVITIES
const getActivities = async (req, res) => {
    try {

        const result = await pool.query(
            `
            SELECT
                a.*,

                l.first_name AS lead_first_name,
                l.last_name AS lead_last_name,

                c.first_name AS contact_first_name,
                c.last_name AS contact_last_name,

                u.name AS performed_by_name

            FROM activities a

            LEFT JOIN leads l
                ON a.lead_id = l.id

            LEFT JOIN contacts c
                ON a.contact_id = c.id

            LEFT JOIN users u
                ON a.performed_by = u.id

            ORDER BY a.activity_at DESC
            `
        );

        res.status(200).json({
            success: true,
            count: result.rows.length,
            data: result.rows
        });

    } catch (error) {
        console.error("Get activities error:", error);

        res.status(500).json({
            success: false,
            message: "Internal server error"
        });
    }
};


// GET ACTIVITY BY ID
const getActivityById = async (req, res) => {
    try {

        const { id } = req.params;

        const result = await pool.query(
            `
            SELECT
                a.*,

                l.first_name AS lead_first_name,
                l.last_name AS lead_last_name,

                c.first_name AS contact_first_name,
                c.last_name AS contact_last_name,

                u.name AS performed_by_name

            FROM activities a

            LEFT JOIN leads l
                ON a.lead_id = l.id

            LEFT JOIN contacts c
                ON a.contact_id = c.id

            LEFT JOIN users u
                ON a.performed_by = u.id

            WHERE a.id = $1
            `,
            [id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Activity not found"
            });
        }

        res.status(200).json({
            success: true,
            data: result.rows[0]
        });

    } catch (error) {
        console.error("Get activity error:", error);

        res.status(500).json({
            success: false,
            message: "Internal server error"
        });
    }
};


// UPDATE ACTIVITY
const updateActivity = async (req, res) => {
    try {

        const { id } = req.params;

        const {
            activity_type,
            subject,
            description,
            activity_at
        } = req.body;

        const result = await pool.query(
            `
            UPDATE activities
            SET
                activity_type = COALESCE($1, activity_type),
                subject = COALESCE($2, subject),
                description = COALESCE($3, description),
                activity_at = COALESCE($4, activity_at),
                updated_at = CURRENT_TIMESTAMP

            WHERE id = $5

            RETURNING *
            `,
            [
                activity_type || null,
                subject || null,
                description || null,
                activity_at || null,
                id
            ]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Activity not found"
            });
        }

        res.status(200).json({
            success: true,
            message: "Activity updated successfully",
            data: result.rows[0]
        });

    } catch (error) {
        console.error("Update activity error:", error);

        res.status(500).json({
            success: false,
            message: "Internal server error"
        });
    }
};


// DELETE ACTIVITY
const deleteActivity = async (req, res) => {
    try {

        const { id } = req.params;

        const result = await pool.query(
            `
            DELETE FROM activities
            WHERE id = $1
            RETURNING *
            `,
            [id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Activity not found"
            });
        }

        res.status(200).json({
            success: true,
            message: "Activity deleted successfully"
        });

    } catch (error) {
        console.error("Delete activity error:", error);

        res.status(500).json({
            success: false,
            message: "Internal server error"
        });
    }

};


module.exports = {
    createActivity,
    getActivities,
    getActivityById,
    updateActivity,
    deleteActivity
};