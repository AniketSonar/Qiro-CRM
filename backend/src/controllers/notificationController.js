const pool = require("../config/db");

// CREATE NOTIFICATION
const createNotification = async (req, res) => {
    try {
        const {
            user_id,
            title,
            message,
            notification_type,
            related_id,
            related_type,
            scheduled_at
        } = req.body;

        if (!user_id || !title || !message || !notification_type) {
            return res.status(400).json({
                success: false,
                message: "user_id, title, message and notification_type are required"
            });
        }

        // Check that target user exists
        const userCheck = await pool.query(
            `SELECT id FROM users WHERE id = $1`,
            [user_id]
        );

        if (userCheck.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: "User not found"
            });
        }

        const result = await pool.query(
            `
            INSERT INTO notifications
            (
                user_id,
                title,
                message,
                notification_type,
                related_id,
                related_type,
                scheduled_at
            )
            VALUES ($1,$2,$3,$4,$5,$6,$7)
            RETURNING *
            `,
            [
                user_id,
                title,
                message,
                notification_type,
                related_id || null,
                related_type || null,
                scheduled_at || null
            ]
        );

        res.status(201).json({
            success: true,
            message: "Notification created successfully",
            data: result.rows[0]
        });

    } catch (error) {
        console.error("Create notification error:", error);

        res.status(500).json({
            success: false,
            message: "Internal server error"
        });
    }
};


// GET MY NOTIFICATIONS
const getMyNotifications = async (req, res) => {
    try {

        const userId = req.user.id;

        const result = await pool.query(
            `
            SELECT *
            FROM notifications
            WHERE user_id = $1
            ORDER BY created_at DESC
            `,
            [userId]
        );

        res.status(200).json({
            success: true,
            count: result.rows.length,
            data: result.rows
        });

    } catch (error) {
        console.error("Get notifications error:", error);

        res.status(500).json({
            success: false,
            message: "Internal server error"
        });
    }
};


// GET UNREAD NOTIFICATIONS
const getUnreadNotifications = async (req, res) => {
    try {

        const userId = req.user.id;

        const result = await pool.query(
            `
            SELECT *
            FROM notifications
            WHERE user_id = $1
            AND is_read = FALSE
            ORDER BY created_at DESC
            `,
            [userId]
        );

        res.status(200).json({
            success: true,
            count: result.rows.length,
            data: result.rows
        });

    } catch (error) {
        console.error("Get unread notifications error:", error);

        res.status(500).json({
            success: false,
            message: "Internal server error"
        });
    }
};


// MARK ONE AS READ
const markAsRead = async (req, res) => {
    try {

        const { id } = req.params;
        const userId = req.user.id;

        const result = await pool.query(
            `
            UPDATE notifications
            SET
                is_read = TRUE,
                read_at = CURRENT_TIMESTAMP,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = $1
            AND user_id = $2
            RETURNING *
            `,
            [id, userId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Notification not found"
            });
        }

        res.status(200).json({
            success: true,
            message: "Notification marked as read",
            data: result.rows[0]
        });

    } catch (error) {
        console.error("Mark notification read error:", error);

        res.status(500).json({
            success: false,
            message: "Internal server error"
        });
    }
};


// MARK ALL AS READ
const markAllAsRead = async (req, res) => {
    try {

        const userId = req.user.id;

        const result = await pool.query(
            `
            UPDATE notifications
            SET
                is_read = TRUE,
                read_at = CURRENT_TIMESTAMP,
                updated_at = CURRENT_TIMESTAMP
            WHERE user_id = $1
            AND is_read = FALSE
            `,
            [userId]
        );

        res.status(200).json({
            success: true,
            message: "All notifications marked as read",
            updated_count: result.rowCount
        });

    } catch (error) {
        console.error("Mark all notifications read error:", error);

        res.status(500).json({
            success: false,
            message: "Internal server error"
        });
    }
};


// DELETE NOTIFICATION
const deleteNotification = async (req, res) => {
    try {

        const { id } = req.params;
        const userId = req.user.id;

        const result = await pool.query(
            `
            DELETE FROM notifications
            WHERE id = $1
            AND user_id = $2
            RETURNING *
            `,
            [id, userId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Notification not found"
            });
        }

        res.status(200).json({
            success: true,
            message: "Notification deleted successfully"
        });

    } catch (error) {
        console.error("Delete notification error:", error);

        res.status(500).json({
            success: false,
            message: "Internal server error"
        });
    }
};


module.exports = {
    createNotification,
    getMyNotifications,
    getUnreadNotifications,
    markAsRead,
    markAllAsRead,
    deleteNotification
};