const express = require("express");
const authorize = require("../middleware/roleMiddleware");

const {
    register,
    login,
    updateProfile,
    changePassword,
    logout
} = require("../controllers/authController");

const authenticate = require("../middleware/authMiddleware");
// const { updateProfile } = require("../controllers/authController");

const router = express.Router();

router.post("/register", register);
router.post("/login", login);

router.get("/me", authenticate, (req, res) => {
    res.status(200).json({
        success: true,
        message: "Current user fetched successfully",
        data: {
            user: req.user
        }
    });
});

router.get(
    "/admin-test",
    authenticate,
    authorize("ADMIN"),
    (req, res) => {
        res.status(200).json({
            success: true,
            message: "Welcome Admin. You have access to this endpoint."
        });
    }
);

router.put(
    "/profile",
    authenticate,
    updateProfile
);

router.put(
    "/change-password",
    authenticate,
    changePassword
);

router.post(
    "/logout",
    authenticate,
    logout
);

module.exports = router;