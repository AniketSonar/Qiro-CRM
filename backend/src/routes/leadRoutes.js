const express = require("express");

const {
    createLead,
    getLeads,
    getLeadById,
    updateLead,
    deleteLead,
    updateLeadStatus,
    assignLead
} = require("../controllers/leadController");

const authenticate = require("../middleware/authMiddleware");
const authorize = require("../middleware/roleMiddleware");

const router = express.Router();

router.post(
    "/",
    authenticate,
    authorize("ADMIN", "SALES_MANAGER", "SALES_PERSON"),
    createLead
);

router.get(
    "/",
    authenticate,
    authorize("ADMIN", "SALES_MANAGER", "SALES_PERSON"),
    getLeads
);

router.get(
    "/:id",
    authenticate,
    authorize("ADMIN", "SALES_MANAGER", "SALES_PERSON"),
    getLeadById
);

router.put(
    "/:id",
    authenticate,
    authorize("ADMIN", "SALES_MANAGER", "SALES_PERSON"),
    updateLead
);

router.delete(
    "/:id",
    authenticate,
    authorize("ADMIN", "SALES_PERSON"),
    deleteLead
);

router.patch(
    "/:id/status",
    authenticate,
    authorize("ADMIN", "SALES_MANAGER", "SALES_PERSON"),
    updateLeadStatus
);

router.patch(
    "/:id/assign",
    authenticate,
    authorize("ADMIN", "SALES_MANAGER"),
    assignLead
);

module.exports = router;