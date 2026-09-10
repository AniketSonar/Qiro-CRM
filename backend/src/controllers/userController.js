const bcrypt = require("bcrypt");
const pool = require("../config/db");

// GET AVAILABLE ROLES
const getRoles = async (req, res) => {
    try {
        const result = await pool.query(
              "SELECT id, name FROM roles WHERE name IN ('ADMIN', 'SALES_PERSON', 'CUSTOMER') ORDER BY id"
        );

        return res.status(200).json({
            success: true,
            message: "Roles fetched successfully",
            data: {
                roles: result.rows
            }
        });
    } catch (error) {
        console.error("Get roles error:", error);

        return res.status(500).json({
            success: false,
            message: "Internal server error"
        });
    }
};

// CREATE USER
const createUser = async (req, res) => {
    try {
        const { name, email, password, role } = req.body;

        if (!name || !email || !password || !role) {
            return res.status(400).json({
                success: false,
                message: "Name, email, password and role are required"
            });
        }

        if (password.length < 6) {
            return res.status(400).json({
                success: false,
                message: "Password must be at least 6 characters long"
            });
        }

        const normalizedEmail = email.trim().toLowerCase();
        const normalizedRole = role.trim().toUpperCase();

        // Check role
        const roleResult = await pool.query(
            "SELECT id, name FROM roles WHERE name = $1",
            [normalizedRole]
        );

        if (roleResult.rows.length === 0) {
            return res.status(400).json({
                success: false,
                message: "Invalid role"
            });
        }

        // Check duplicate email
        const existingUser = await pool.query(
            "SELECT id FROM users WHERE email = $1",
            [normalizedEmail]
        );

        if (existingUser.rows.length > 0) {
            return res.status(409).json({
                success: false,
                message: "Email already registered"
            });
        }

        const passwordHash = await bcrypt.hash(password, 10);

        const result = await pool.query(
            `INSERT INTO users
                (name, email, password_hash, role_id)
             VALUES ($1, $2, $3, $4)
             RETURNING id, name, email, role_id, status, created_at`,
            [
                name.trim(),
                normalizedEmail,
                passwordHash,
                roleResult.rows[0].id
            ]
        );

        const user = result.rows[0];

        return res.status(201).json({
            success: true,
            message: "User created successfully",
            data: {
                user: {
                    id: user.id,
                    name: user.name,
                    email: user.email,
                    role: roleResult.rows[0].name,
                    status: user.status,
                    createdAt: user.created_at
                }
            }
        });

    } catch (error) {
        console.error("Create user error:", error);

        return res.status(500).json({
            success: false,
            message: "Internal server error"
        });
    }
};


// GET ALL USERS
const getUsers = async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT
                u.id,
                u.name,
                u.email,
                r.name AS role,
                u.status,
                u.created_at,
                u.updated_at
             FROM users u
             JOIN roles r ON u.role_id = r.id
             ORDER BY u.created_at DESC`
        );

        return res.status(200).json({
            success: true,
            message: "Users fetched successfully",
            data: {
                users: result.rows
            }
        });

    } catch (error) {
        console.error("Get users error:", error);

        return res.status(500).json({
            success: false,
            message: "Internal server error"
        });
    }
};


// GET SINGLE USER
const getUserById = async (req, res) => {
    try {
        const { id } = req.params;

        const result = await pool.query(
            `SELECT
                u.id,
                u.name,
                u.email,
                r.name AS role,
                u.status,
                u.created_at,
                u.updated_at
             FROM users u
             JOIN roles r ON u.role_id = r.id
             WHERE u.id = $1`,
            [id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: "User not found"
            });
        }

        return res.status(200).json({
            success: true,
            message: "User fetched successfully",
            data: {
                user: result.rows[0]
            }
        });

    } catch (error) {
        console.error("Get user error:", error);

        return res.status(500).json({
            success: false,
            message: "Internal server error"
        });
    }
};


// UPDATE USER
const updateUser = async (req, res) => {
    try {
        const { id } = req.params;
        const { name, email } = req.body;

        if (!name || !email) {
            return res.status(400).json({
                success: false,
                message: "Name and email are required"
            });
        }

        const normalizedEmail = email.trim().toLowerCase();

        // Check user exists
        const existingUser = await pool.query(
            "SELECT id FROM users WHERE id = $1",
            [id]
        );

        if (existingUser.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: "User not found"
            });
        }

        // Check if another user has this email
        const emailCheck = await pool.query(
            `SELECT id FROM users
             WHERE email = $1 AND id != $2`,
            [normalizedEmail, id]
        );

        if (emailCheck.rows.length > 0) {
            return res.status(409).json({
                success: false,
                message: "Email already used by another user"
            });
        }

        const result = await pool.query(
            `UPDATE users
             SET name = $1,
                 email = $2,
                 updated_at = CURRENT_TIMESTAMP
             WHERE id = $3
             RETURNING id, name, email, role_id, status, updated_at`,
            [
                name.trim(),
                normalizedEmail,
                id
            ]
        );

        return res.status(200).json({
            success: true,
            message: "User updated successfully",
            data: {
                user: result.rows[0]
            }
        });

    } catch (error) {
        console.error("Update user error:", error);

        return res.status(500).json({
            success: false,
            message: "Internal server error"
        });
    }
};


// UPDATE USER STATUS
const updateUserStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body;

        if (!["ACTIVE", "INACTIVE"].includes(status)) {
            return res.status(400).json({
                success: false,
                message: "Status must be ACTIVE or INACTIVE"
            });
        }

        const result = await pool.query(
            `UPDATE users
             SET status = $1,
                 updated_at = CURRENT_TIMESTAMP
             WHERE id = $2
             RETURNING id, name, email, status`,
            [status, id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: "User not found"
            });
        }

        return res.status(200).json({
            success: true,
            message: "User status updated successfully",
            data: {
                user: result.rows[0]
            }
        });

    } catch (error) {
        console.error("Update status error:", error);

        return res.status(500).json({
            success: false,
            message: "Internal server error"
        });
    }
};


// CHANGE USER ROLE
const updateUserRole = async (req, res) => {
    try {
        const { id } = req.params;
        const { role } = req.body;

        if (!role) {
            return res.status(400).json({
                success: false,
                message: "Role is required"
            });
        }

        const normalizedRole = role.trim().toUpperCase();

        const roleResult = await pool.query(
            "SELECT id, name FROM roles WHERE name = $1",
            [normalizedRole]
        );

        if (roleResult.rows.length === 0) {
            return res.status(400).json({
                success: false,
                message: "Invalid role"
            });
        }

        const result = await pool.query(
            `UPDATE users
             SET role_id = $1,
                 updated_at = CURRENT_TIMESTAMP
             WHERE id = $2
             RETURNING id, name, email, role_id, status`,
            [
                roleResult.rows[0].id,
                id
            ]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: "User not found"
            });
        }

        return res.status(200).json({
            success: true,
            message: "User role updated successfully",
            data: {
                user: {
                    id: result.rows[0].id,
                    name: result.rows[0].name,
                    email: result.rows[0].email,
                    role: roleResult.rows[0].name,
                    status: result.rows[0].status
                }
            }
        });

    } catch (error) {
        console.error("Update role error:", error);

        return res.status(500).json({
            success: false,
            message: "Internal server error"
        });
    }
};


// DELETE USER
const deleteUser = async (req, res) => {
    try {
        const { id } = req.params;

        if (Number(id) === Number(req.user.id)) {
            return res.status(400).json({
                success: false,
                message: "You cannot delete your own account"
            });
        }

        const result = await pool.query(
            "DELETE FROM users WHERE id = $1 RETURNING id",
            [id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: "User not found"
            });
        }

        return res.status(200).json({
            success: true,
            message: "User deleted successfully"
        });
    } catch (error) {
        console.error("Delete user error:", error);

        if (error.code === "23503") {
            return res.status(409).json({
                success: false,
                message: "This user cannot be deleted because they have related CRM records. Deactivate the user instead."
            });
        }

        return res.status(500).json({
            success: false,
            message: "Internal server error"
        });
    }
};


module.exports = {
    getRoles,
    createUser,
    getUsers,
    getUserById,
    updateUser,
    updateUserStatus,
    updateUserRole,
    deleteUser
};