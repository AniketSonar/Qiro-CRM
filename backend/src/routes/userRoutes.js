const express = require("express");

const {
    getRoles,
    createUser,
    getUsers,
    getUserById,
    updateUser,
    updateUserStatus,
    updateUserRole,
    deleteUser
} = require("../controllers/userController");

const authenticate = require("../middleware/authMiddleware");
const authorize = require("../middleware/roleMiddleware");

const router = express.Router();

// All user management routes require authentication + ADMIN role

router.get(
    "/roles",
    authenticate,
    authorize("ADMIN"),
    getRoles
);

router.post(
    "/",
    authenticate,
    authorize("ADMIN"),
    createUser
);

router.get(
    "/",
    authenticate,
    authorize("ADMIN"),
    getUsers
);

router.get(
    "/:id",
    authenticate,
    authorize("ADMIN"),
    getUserById
);

router.put(
    "/:id",
    authenticate,
    authorize("ADMIN"),
    updateUser
);

router.patch(
    "/:id/status",
    authenticate,
    authorize("ADMIN"),
    updateUserStatus
);

router.patch(
    "/:id/role",
    authenticate,
    authorize("ADMIN"),
    updateUserRole
);

router.delete(
    "/:id",
    authenticate,
    authorize("ADMIN"),
    deleteUser
);

module.exports = router;