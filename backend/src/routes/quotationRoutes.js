const express = require("express");
const {
    getQuotations,
    getQuotationById,
    createQuotation,
    updateQuotation,
    deleteQuotation,
    sendQuotationEmail
} = require("../controllers/quotationController");

const authenticate = require("../middleware/authMiddleware");
const authorize = require("../middleware/roleMiddleware");

const router = express.Router();

router.get(
    "/",
    authenticate,
    authorize("ADMIN", "SALES_MANAGER", "SALES_PERSON"),
    getQuotations
);

router.get(
    "/:id",
    authenticate,
    authorize("ADMIN", "SALES_MANAGER", "SALES_PERSON"),
    getQuotationById
);

router.post(
    "/",
    authenticate,
    authorize("ADMIN", "SALES_MANAGER", "SALES_PERSON"),
    createQuotation
);

router.put(
    "/:id",
    authenticate,
    authorize("ADMIN", "SALES_MANAGER", "SALES_PERSON"),
    updateQuotation
);

router.delete(
    "/:id",
    authenticate,
    authorize("ADMIN", "SALES_MANAGER"),
    deleteQuotation
);

router.post(
    "/:id/send-email",
    authenticate,
    authorize("ADMIN", "SALES_MANAGER", "SALES_PERSON"),
    sendQuotationEmail
);

module.exports = router;
