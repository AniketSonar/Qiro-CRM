const express = require("express");

const {
    createLeadSource,
    getLeadSources,
    getLeadSourceById,
    updateLeadSource,
    updateLeadSourceStatus,
    deleteLeadSource
} = require("../controllers/leadSourceController");

const authenticate = require("../middleware/authMiddleware");
const authorize = require("../middleware/roleMiddleware");

const router = express.Router();


// Create
router.post(
    "/",
    authenticate,
    authorize("ADMIN"),
    createLeadSource
);


// Get all
router.get(
    "/",
    authenticate,
    authorize("ADMIN", "SALES_MANAGER", "SALES_PERSON"),
    getLeadSources
);


// Get by ID
router.get(
    "/:id",
    authenticate,
    authorize("ADMIN", "SALES_MANAGER", "SALES_PERSON"),
    getLeadSourceById
);


// Update
router.put(
    "/:id",
    authenticate,
    authorize("ADMIN"),
    updateLeadSource
);


// Activate / deactivate
router.patch(
    "/:id/status",
    authenticate,
    authorize("ADMIN"),
    updateLeadSourceStatus
);


// Delete
router.delete(
    "/:id",
    authenticate,
    authorize("ADMIN"),
    deleteLeadSource
);


module.exports = router;