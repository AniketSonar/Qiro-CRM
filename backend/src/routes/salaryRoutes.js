const express = require("express");
const {
    getSalaryProfiles,
    getMySalaryProfile,
    updateSalaryProfile,
    getSalary,
    saveProfile,
    createRecord,
    updateRecordStatus,
    getLeaves,
    createLeave,
    updateLeaveStatus,
    deleteLeave
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

router.get("/:userId", authenticate, authorize("ADMIN", "SALES_PERSON"), getSalary);
router.get("/:userId/leaves", authenticate, authorize("ADMIN", "SALES_PERSON"), getLeaves);
router.post("/:userId/leaves", authenticate, authorize("ADMIN", "SALES_PERSON"), createLeave);
router.delete("/leaves/:leaveId", authenticate, authorize("SALES_PERSON"), deleteLeave);
router.patch("/leaves/:leaveId/status", authenticate, authorize("ADMIN"), updateLeaveStatus);
router.put("/:userId/profile", authenticate, authorize("ADMIN"), saveProfile);
router.post("/:userId/records", authenticate, authorize("ADMIN"), createRecord);
router.patch("/records/:recordId/status", authenticate, authorize("ADMIN"), updateRecordStatus);

module.exports = router;
