const express = require("express");

const {
    createDeal,
    getDeals,
    getDealById,
    updateDeal,
    deleteDeal
} = require("../controllers/dealController");

const authenticate = require("../middleware/authMiddleware");
const authorize = require("../middleware/roleMiddleware");

const router = express.Router();


// CREATE
router.post(
    "/",
    authenticate,
    authorize("ADMIN", "SALES_MANAGER", "SALES_PERSON"),
    createDeal
);


// GET ALL
router.get(
    "/",
    authenticate,
    authorize("ADMIN", "SALES_MANAGER", "SALES_PERSON"),
    getDeals
);


// GET ONE
router.get(
    "/:id",
    authenticate,
    authorize("ADMIN", "SALES_MANAGER", "SALES_PERSON"),
    getDealById
);


// UPDATE
router.put(
    "/:id",
    authenticate,
    authorize("ADMIN", "SALES_MANAGER", "SALES_PERSON"),
    updateDeal
);


// DELETE
router.delete(
    "/:id",
    authenticate,
    authorize("ADMIN", "SALES_MANAGER"),
    deleteDeal
);


module.exports = router;