const express = require("express");

const router = express.Router();

const authenticate = require("../middleware/authMiddleware");
const authorize = require("../middleware/roleMiddleware");

const {
    getDashboardReport,
    getLeadReport,
    getSalesReport,
    getPerformanceReport,
    getFollowUpReport,
    getSalesPersonPerformance
} = require("../controllers/reportController");


// Dashboard
router.get(
    "/dashboard",
    authenticate,
    authorize("ADMIN", "SALES_MANAGER", "SALES_PERSON"),
    getDashboardReport
);


// Lead analytics
router.get(
    "/leads",
    authenticate,
    authorize("ADMIN", "SALES_MANAGER"),
    getLeadReport
);


// Sales analytics
router.get(
    "/sales",
    authenticate,
    authorize("ADMIN", "SALES_MANAGER"),
    getSalesReport
);


// Salesperson performance
router.get(
    "/performance",
    authenticate,
    authorize("ADMIN", "SALES_MANAGER"),
    getPerformanceReport
);


// Individual salesperson performance
router.get(
    "/performance/:userId",
    authenticate,
    authorize("ADMIN", "SALES_PERSON"),
    getSalesPersonPerformance
);


// Follow-up analytics
router.get(
    "/follow-ups",
    authenticate,
    authorize("ADMIN", "SALES_MANAGER"),
    getFollowUpReport
);


module.exports = router;