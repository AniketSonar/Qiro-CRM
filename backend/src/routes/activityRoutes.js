const express = require("express");

const router = express.Router();

const authenticate = require("../middleware/authMiddleware");
const authorize = require("../middleware/roleMiddleware");

const {
    createActivity,
    getActivities,
    getActivityById,
    updateActivity,
    deleteActivity
} = require("../controllers/activityController");


// GET ALL
router.get(
    "/",
    authenticate,
    authorize("ADMIN", "SALES_MANAGER", "SALES_PERSON"),
    getActivities
);


// GET ONE
router.get(
    "/:id",
    authenticate,
    authorize("ADMIN", "SALES_MANAGER", "SALES_PERSON"),
    getActivityById
);


// CREATE
router.post(
    "/",
    authenticate,
    authorize("ADMIN", "SALES_MANAGER", "SALES_PERSON"),
    createActivity
);


// UPDATE
router.put(
    "/:id",
    authenticate,
    authorize("ADMIN", "SALES_MANAGER", "SALES_PERSON"),
    updateActivity
);


// DELETE
router.delete(
    "/:id",
    authenticate,
    authorize("ADMIN", "SALES_MANAGER"),
    deleteActivity
);


module.exports = router;