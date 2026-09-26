const pool = require("../config/db");

const getCalendar = async (req, res) => {
    try {
        const isAdmin = req.user.role === "ADMIN";
        const holidays = await pool.query(
                `SELECT id, to_char(holiday_date::date, 'YYYY-MM-DD') AS holiday_date,
                    name, description, 'HOLIDAY' AS event_type
             FROM company_holidays ORDER BY holiday_date ASC`
        );
        const leaveParams = isAdmin ? [] : [req.user.id];
        const leaveConditions = isAdmin
            ? "r.name = 'SALES_PERSON'"
            : "l.user_id = $1 AND r.name = 'SALES_PERSON'";
        const leaves = await pool.query(
                `SELECT l.id, l.user_id, to_char(l.start_date::date, 'YYYY-MM-DD') AS start_date,
                    to_char(l.end_date::date, 'YYYY-MM-DD') AS end_date, l.leave_type,
                    l.days, l.reason, l.status, u.name AS user_name,
                    'LEAVE' AS event_type
             FROM employee_leaves l
             JOIN users u ON u.id = l.user_id
             JOIN roles r ON r.id = u.role_id
             WHERE ${leaveConditions}
             ORDER BY l.start_date ASC`,
            leaveParams
        );
        return res.json({ success: true, data: { holidays: holidays.rows, leaves: leaves.rows } });
    } catch (error) {
        console.error("Get calendar error:", error);
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
};

const createHoliday = async (req, res) => {
    try {
        const { holidayDate, name, description } = req.body || {};
        if (!holidayDate || !name?.trim()) return res.status(400).json({ success: false, message: "Holiday date and name are required" });
        const result = await pool.query(
            `INSERT INTO company_holidays (holiday_date, name, description, created_by)
             VALUES ($1, $2, $3, $4) RETURNING id, holiday_date, name, description, 'HOLIDAY' AS event_type`,
            [holidayDate, name.trim(), description?.trim() || null, req.user.id]
        );
        return res.status(201).json({ success: true, data: { holiday: result.rows[0] } });
    } catch (error) {
        if (error.code === "23505") return res.status(409).json({ success: false, message: "A holiday already exists on this date" });
        console.error("Create holiday error:", error);
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
};

const deleteHoliday = async (req, res) => {
    try {
        const result = await pool.query("DELETE FROM company_holidays WHERE id = $1 RETURNING id", [req.params.id]);
        if (result.rows.length === 0) return res.status(404).json({ success: false, message: "Holiday not found" });
        return res.json({ success: true, message: "Holiday deleted" });
    } catch (error) {
        console.error("Delete holiday error:", error);
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
};

module.exports = { getCalendar, createHoliday, deleteHoliday };