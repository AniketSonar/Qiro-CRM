const express = require("express");

const {
    convertDealToCustomer,
    getCustomers,
    getCustomerById,
    updateCustomer
} = require("../controllers/customerController");

const authenticate = require("../middleware/authMiddleware");
const authorize = require("../middleware/roleMiddleware");

const router = express.Router();


// Convert CLOSED_WON deal → customer
router.post(
    "/convert/:dealId",
    authenticate,
    authorize(
        "ADMIN",
        "SALES_MANAGER",
        "SALES_PERSON"
    ),
    convertDealToCustomer
);


// Get customers
router.get(
    "/",
    authenticate,
    authorize(
        "ADMIN",
        "SALES_MANAGER",
        "SALES_PERSON"
    ),
    getCustomers
);


// Get customer
router.get(
    "/:id",
    authenticate,
    authorize(
        "ADMIN",
        "SALES_MANAGER",
        "SALES_PERSON"
    ),
    getCustomerById
);


// Update customer
router.put(
    "/:id",
    authenticate,
    authorize(
        "ADMIN",
        "SALES_MANAGER",
        "SALES_PERSON"
    ),
    updateCustomer
);


module.exports = router;