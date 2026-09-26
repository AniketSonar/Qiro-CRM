const express = require("express");

const {
    createFollowUp,
    getFollowUps,
    getFollowUpById,
    updateFollowUp,
    completeFollowUp,
    cancelFollowUp
} = require("../controllers/followUpController");

const authenticate = require("../middleware/authMiddleware");
const authorize = require("../middleware/roleMiddleware");

const router = express.Router();


// Create
router.post(
    "/",
    authenticate,
    authorize("ADMIN", "SALES_MANAGER", "SALES_PERSON"),
    createFollowUp
);


// Get all
router.get(
    "/",
    authenticate,
    authorize("ADMIN", "SALES_MANAGER", "SALES_PERSON"),
    getFollowUps
);


// Get one
router.get(
    "/:id",
    authenticate,
    authorize("ADMIN", "SALES_MANAGER", "SALES_PERSON"),
    getFollowUpById
);


// Update
router.put(
    "/:id",
    authenticate,
    authorize("ADMIN", "SALES_MANAGER", "SALES_PERSON"),
    updateFollowUp
);


// Complete
router.patch(
    "/:id/complete",
    authenticate,
    authorize("ADMIN", "SALES_MANAGER", "SALES_PERSON"),
    completeFollowUp
);


// Cancel
router.patch(
    "/:id/cancel",
    authenticate,
    authorize("ADMIN", "SALES_MANAGER", "SALES_PERSON"),
    cancelFollowUp
);


module.exports = router;