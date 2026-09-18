const express = require("express");
const {
    getSalaryProfiles,
    getMySalaryProfile,
    updateSalaryProfile
} = require("../controllers/salaryController");

const authenticate = require("../middleware/authMiddleware");
const authorize = require("../middleware/roleMiddleware");

const router = express.Router();

// Salesperson / authenticated user: View their own salary & target progress (READ ONLY)
router.get(
    "/my",
    authenticate,
    getMySalaryProfile
);

// Admin: View all sales persons salaries, targets & bonus performances
router.get(
    "/",
    authenticate,
    authorize("ADMIN"),
    getSalaryProfiles
);

// Admin: Declare / modify salary and target for a sales person
router.put(
    "/:userId",
    authenticate,
    authorize("ADMIN"),
    updateSalaryProfile
);

module.exports = router;
