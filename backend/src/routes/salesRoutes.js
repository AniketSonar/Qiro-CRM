const express = require("express");

const {
    createSale,
    getSales,
    getSaleById,
    updateSale
} = require("../controllers/salesController");

const authenticate =
    require("../middleware/authMiddleware");

const authorize =
    require("../middleware/roleMiddleware");

const router = express.Router();


// Create Sale
router.post(
    "/",
    authenticate,
    authorize(
        "ADMIN",
        "SALES_MANAGER",
        "SALES_PERSON"
    ),
    createSale
);


// Get all sales
router.get(
    "/",
    authenticate,
    authorize(
        "ADMIN",
        "SALES_MANAGER",
        "SALES_PERSON"
    ),
    getSales
);


// Get sale by ID
router.get(
    "/:id",
    authenticate,
    authorize(
        "ADMIN",
        "SALES_MANAGER",
        "SALES_PERSON"
    ),
    getSaleById
);


// Update sale
router.put(
    "/:id",
    authenticate,
    authorize(
        "ADMIN",
        "SALES_MANAGER",
        "SALES_PERSON"
    ),
    updateSale
);


module.exports = router;