const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const pool = require("../config/db");


const register = async (req, res) => {
    try {
        const { name, email, password } = req.body;

        // 1. Validate required fields
        if (!name || !email || !password) {
            return res.status(400).json({
                success: false,
                message: "Name, email and password are required"
            });
        }

        // 2. Basic password validation
        if (password.length < 6) {
            return res.status(400).json({
                success: false,
                message: "Password must be at least 6 characters long"
            });
        }

        // 3. Normalize email
        const normalizedEmail = email.trim().toLowerCase();

        // 4. Check if user already exists
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

        // 5. Find default CUSTOMER role
        const roleResult = await pool.query(
            "SELECT id, name FROM roles WHERE name = $1",
            ["CUSTOMER"]
        );

        if (roleResult.rows.length === 0) {
            return res.status(500).json({
                success: false,
                message: "Default user role is not configured"
            });
        }

        const role = roleResult.rows[0];

        // 6. Hash password
        const passwordHash = await bcrypt.hash(password, 10);

        // 7. Insert user
        const result = await pool.query(
            `INSERT INTO users
                (name, email, password_hash, role_id)
             VALUES
                ($1, $2, $3, $4)
             RETURNING id, name, email, role_id, status, created_at`,
            [
                name.trim(),
                normalizedEmail,
                passwordHash,
                role.id
            ]
        );

        const user = result.rows[0];

        // 8. Return safe response
        return res.status(201).json({
            success: true,
            message: "Registration successful",
            data: {
                user: {
                    id: user.id,
                    name: user.name,
                    email: user.email,
                    role: role.name,
                    status: user.status,
                    createdAt: user.created_at
                }
            }
        });

    } catch (error) {
        console.error("Registration error:", error);

        return res.status(500).json({
            success: false,
            message: "Internal server error"
        });
    }
};

const login = async (req, res) => {
    try {
        const { email, password } = req.body;

        // 1. Validate input
        if (!email || !password) {
            return res.status(400).json({
                success: false,
                message: "Email and password are required"
            });
        }

        // 2. Normalize email
        const normalizedEmail = email.trim().toLowerCase();

        // 3. Find user
        const result = await pool.query(
            `SELECT 
                u.id,
                u.name,
                u.email,
                u.password_hash,
                u.status,
                u.token_version,
                r.name AS role
             FROM users u
             JOIN roles r ON u.role_id = r.id
             WHERE u.email = $1`,
            [normalizedEmail]
        );

        // 4. User not found
        if (result.rows.length === 0) {
            return res.status(401).json({
                success: false,
                message: "Invalid email or password"
            });
        }

        const user = result.rows[0];

        // 5. Check account status
        if (user.status !== "ACTIVE") {
            return res.status(403).json({
                success: false,
                message: "Your account is inactive"
            });
        }

        // 6. Compare password
        const passwordMatch = await bcrypt.compare(
            password,
            user.password_hash
        );

        if (!passwordMatch) {
            return res.status(401).json({
                success: false,
                message: "Invalid email or password"
            });
        }

        // 7. Generate JWT
        const token = jwt.sign(
    {
        userId: user.id,
        tokenVersion: user.token_version
    },
    process.env.JWT_SECRET,
    {
        expiresIn: "1d"
    }
);

        // 8. Send response
        return res.status(200).json({
            success: true,
            message: "Login successful",
            data: {
                token,
                user: {
                    id: user.id,
                    name: user.name,
                    email: user.email,
                    role: user.role,
                    status: user.status
                }
            }
        });

    } catch (error) {
        console.error("Login error:", error);

        return res.status(500).json({
            success: false,
            message: "Internal server error"
        });
    }
};

const updateProfile = async (req, res) => {
    try {
        const userId = req.user.id;
        const { name, email } = req.body;

        if (!name || !email) {
            return res.status(400).json({
                success: false,
                message: "Name and email are required"
            });
        }

        const normalizedEmail = email.trim().toLowerCase();

        const emailCheck = await pool.query(
            `SELECT id
             FROM users
             WHERE email = $1 AND id != $2`,
            [normalizedEmail, userId]
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
             RETURNING id, name, email, status`,
            [
                name.trim(),
                normalizedEmail,
                userId
            ]
        );

        return res.status(200).json({
            success: true,
            message: "Profile updated successfully",
            data: {
                user: result.rows[0]
            }
        });

    } catch (error) {
        console.error("Update profile error:", error);

        return res.status(500).json({
            success: false,
            message: "Internal server error"
        });
    }
};

const changePassword = async (req, res) => {
    try {
        const userId = req.user.id;
        const { currentPassword, newPassword } = req.body;

        if (!currentPassword || !newPassword) {
            return res.status(400).json({
                success: false,
                message: "Current password and new password are required"
            });
        }

        if (newPassword.length < 6) {
            return res.status(400).json({
                success: false,
                message: "New password must be at least 6 characters long"
            });
        }

        const result = await pool.query(
            `SELECT password_hash
             FROM users
             WHERE id = $1`,
            [userId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: "User not found"
            });
        }

        const passwordMatch = await bcrypt.compare(
            currentPassword,
            result.rows[0].password_hash
        );

        if (!passwordMatch) {
            return res.status(401).json({
                success: false,
                message: "Current password is incorrect"
            });
        }

        const newPasswordHash = await bcrypt.hash(
            newPassword,
            10
        );

        await pool.query(
            `UPDATE users
             SET password_hash = $1,
                 token_version = token_version + 1,
                 updated_at = CURRENT_TIMESTAMP
             WHERE id = $2`,
            [
                newPasswordHash,
                userId
            ]
        );

        return res.status(200).json({
            success: true,
            message: "Password changed successfully. Please login again."
        });

    } catch (error) {
        console.error("Change password error:", error);

        return res.status(500).json({
            success: false,
            message: "Internal server error"
        });
    }
};

const logout = async (req, res) => {
    try {
        await pool.query(
            `UPDATE users
             SET token_version = token_version + 1,
                 updated_at = CURRENT_TIMESTAMP
             WHERE id = $1`,
            [req.user.id]
        );

        return res.status(200).json({
            success: true,
            message: "Logout successful"
        });

    } catch (error) {
        console.error("Logout error:", error);

        return res.status(500).json({
            success: false,
            message: "Internal server error"
        });
    }
};

module.exports = {
    register,
    login,
    updateProfile,
    changePassword,
    logout
};