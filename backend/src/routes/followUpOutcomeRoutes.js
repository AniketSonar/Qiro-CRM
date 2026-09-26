const express = require("express");

const {
    getOutcomes,
    createOutcome,
    updateOutcome,
    deactivateOutcome,
    setFollowUpOutcome
} = require("../controllers/followUpOutcomeController");

const authenticate = require("../middleware/authMiddleware");
const authorize = require("../middleware/roleMiddleware");

const router = express.Router();


// Get active outcomes
router.get(
    "/",
    authenticate,
    authorize("ADMIN", "SALES_MANAGER", "SALES_PERSON"),
    getOutcomes
);


// Admin creates outcome
router.post(
    "/",
    authenticate,
    authorize("ADMIN"),
    createOutcome
);


// Admin updates outcome
router.put(
    "/:id",
    authenticate,
    authorize("ADMIN"),
    updateOutcome
);


// Admin deactivates outcome
router.delete(
    "/:id",
    authenticate,
    authorize("ADMIN"),
    deactivateOutcome
);


// Set outcome on follow-up
router.patch(
    "/follow-up/:id",
    authenticate,
    authorize("ADMIN", "SALES_MANAGER", "SALES_PERSON"),
    setFollowUpOutcome
);


module.exports = router;