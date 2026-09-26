const pool = require("../config/db");


// CREATE CONTACT
const createContact = async (req, res) => {
    try {
        const {
            first_name,
            last_name,
            email,
            phone,
            company,
            designation,
            address,
            city,
            state,
            country,
            notes,
            owner_id
        } = req.body || {};

        if (!first_name || !first_name.trim()) {
            return res.status(400).json({
                success: false,
                message: "First name is required"
            });
        }

        // If owner is provided, verify user
        if (owner_id) {
            const ownerCheck = await pool.query(
                `SELECT u.id
                 FROM users u
                 JOIN roles r ON u.role_id = r.id
                 WHERE u.id = $1
                 AND u.status = 'ACTIVE'
                 AND r.name IN ('SALES_PERSON', 'SALES_MANAGER')`,
                [owner_id]
            );

            if (ownerCheck.rows.length === 0) {
                return res.status(400).json({
                    success: false,
                    message: "Invalid contact owner"
                });
            }
        }

        const result = await pool.query(
            `INSERT INTO contacts (
                first_name,
                last_name,
                email,
                phone,
                company,
                designation,
                address,
                city,
                state,
                country,
                notes,
                owner_id
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
                company?.trim() || null,
                designation?.trim() || null,
                address?.trim() || null,
                city?.trim() || null,
                state?.trim() || null,
                country?.trim() || null,
                notes?.trim() || null,
                owner_id || null
            ]
        );

        return res.status(201).json({
            success: true,
            message: "Contact created successfully",
            data: {
                contact: result.rows[0]
            }
        });

    } catch (error) {
        console.error("Create contact error:", error);

        return res.status(500).json({
            success: false,
            message: "Internal server error"
        });
    }
};


// GET CONTACTS
const getContacts = async (req, res) => {
    try {
        const {
            search = "",
            owner_id,
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

        // Sales Person sees only own contacts
        if (req.user.role === "SALES_PERSON") {
            values.push(req.user.id);
            conditions.push(`c.owner_id = $${values.length}`);
        }

        // Optional owner filter
        if (owner_id) {
            values.push(owner_id);
            conditions.push(`c.owner_id = $${values.length}`);
        }

        // Search
        if (search.trim()) {
            values.push(`%${search.trim()}%`);

            conditions.push(`
                (
                    c.first_name ILIKE $${values.length}
                    OR c.last_name ILIKE $${values.length}
                    OR c.email ILIKE $${values.length}
                    OR c.phone ILIKE $${values.length}
                    OR c.company ILIKE $${values.length}
                )
            `);
        }

        const whereClause =
            conditions.length > 0
                ? `WHERE ${conditions.join(" AND ")}`
                : "";

        const countResult = await pool.query(
            `
            SELECT COUNT(*)::INTEGER AS total
            FROM contacts c
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
                c.*,
                u.name AS owner_name

            FROM contacts c

            LEFT JOIN users u
                ON c.owner_id = u.id

            ${whereClause}

            ORDER BY c.created_at DESC

            LIMIT $${limitPosition}
            OFFSET $${offsetPosition}
            `,
            values
        );

        return res.status(200).json({
            success: true,
            message: "Contacts fetched successfully",
            data: {
                contacts: result.rows,
                pagination: {
                    page: pageNumber,
                    limit: limitNumber,
                    total,
                    totalPages: Math.ceil(total / limitNumber)
                }
            }
        });

    } catch (error) {
        console.error("Get contacts error:", error);

        return res.status(500).json({
            success: false,
            message: "Internal server error"
        });
    }
};


// GET CONTACT BY ID
const getContactById = async (req, res) => {
    try {
        const { id } = req.params;

        let query = `
            SELECT
                c.*,
                u.name AS owner_name

            FROM contacts c

            LEFT JOIN users u
                ON c.owner_id = u.id

            WHERE c.id = $1
        `;

        const values = [id];

        if (req.user.role === "SALES_PERSON") {
            query += ` AND c.owner_id = $2`;
            values.push(req.user.id);
        }

        const result = await pool.query(query, values);

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Contact not found"
            });
        }

        return res.status(200).json({
            success: true,
            message: "Contact fetched successfully",
            data: {
                contact: result.rows[0]
            }
        });

    } catch (error) {
        console.error("Get contact error:", error);

        return res.status(500).json({
            success: false,
            message: "Internal server error"
        });
    }
};


// UPDATE CONTACT
const updateContact = async (req, res) => {
    try {
        const { id } = req.params;

        const {
            first_name,
            last_name,
            email,
            phone,
            company,
            designation,
            address,
            city,
            state,
            country,
            notes
        } = req.body || {};

        if (!first_name || !first_name.trim()) {
            return res.status(400).json({
                success: false,
                message: "First name is required"
            });
        }

        if (req.user.role === "SALES_PERSON") {
            const accessCheck = await pool.query(
                `SELECT id
                 FROM contacts
                 WHERE id = $1
                 AND owner_id = $2`,
                [id, req.user.id]
            );

            if (accessCheck.rows.length === 0) {
                return res.status(403).json({
                    success: false,
                    message: "You can only update contacts assigned to you"
                });
            }
        }

        const result = await pool.query(
            `UPDATE contacts
             SET
                first_name = $1,
                last_name = $2,
                email = $3,
                phone = $4,
                company = $5,
                designation = $6,
                address = $7,
                city = $8,
                state = $9,
                country = $10,
                notes = $11,
                updated_at = CURRENT_TIMESTAMP
             WHERE id = $12
             RETURNING *`,
            [
                first_name.trim(),
                last_name?.trim() || null,
                email?.trim().toLowerCase() || null,
                phone?.trim() || null,
                company?.trim() || null,
                designation?.trim() || null,
                address?.trim() || null,
                city?.trim() || null,
                state?.trim() || null,
                country?.trim() || null,
                notes?.trim() || null,
                id
            ]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Contact not found"
            });
        }

        return res.status(200).json({
            success: true,
            message: "Contact updated successfully",
            data: {
                contact: result.rows[0]
            }
        });

    } catch (error) {
        console.error("Update contact error:", error);

        return res.status(500).json({
            success: false,
            message: "Internal server error"
        });
    }
};


// DELETE CONTACT
const deleteContact = async (req, res) => {
    try {
        const { id } = req.params;

        const result = await pool.query(
            `DELETE FROM contacts
             WHERE id = $1
             RETURNING id`,
            [id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Contact not found"
            });
        }

        return res.status(200).json({
            success: true,
            message: "Contact deleted successfully",
            data: {
                id: result.rows[0].id
            }
        });

    } catch (error) {
        console.error("Delete contact error:", error);

        return res.status(500).json({
            success: false,
            message: "Internal server error"
        });
    }
};


// ASSIGN CONTACT
const assignContact = async (req, res) => {
    try {
        const { id } = req.params;
        const { owner_id } = req.body || {};

        if (!owner_id) {
            return res.status(400).json({
                success: false,
                message: "owner_id is required"
            });
        }

        const ownerCheck = await pool.query(
            `SELECT u.id
             FROM users u
             JOIN roles r ON u.role_id = r.id
             WHERE u.id = $1
             AND u.status = 'ACTIVE'
             AND r.name IN ('SALES_PERSON', 'SALES_MANAGER')`,
            [owner_id]
        );

        if (ownerCheck.rows.length === 0) {
            return res.status(400).json({
                success: false,
                message: "Invalid contact owner"
            });
        }

        const result = await pool.query(
            `UPDATE contacts
             SET
                owner_id = $1,
                updated_at = CURRENT_TIMESTAMP
             WHERE id = $2
             RETURNING *`,
            [owner_id, id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Contact not found"
            });
        }

        return res.status(200).json({
            success: true,
            message: "Contact assigned successfully",
            data: {
                contact: result.rows[0]
            }
        });

    } catch (error) {
        console.error("Assign contact error:", error);

        return res.status(500).json({
            success: false,
            message: "Internal server error"
        });
    }
};


module.exports = {
    createContact,
    getContacts,
    getContactById,
    updateContact,
    deleteContact,
    assignContact
};