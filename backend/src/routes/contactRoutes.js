const express = require("express");

const {
    createContact,
    getContacts,
    getContactById,
    updateContact,
    deleteContact,
    assignContact
} = require("../controllers/contactController");

const authenticate = require("../middleware/authMiddleware");
const authorize = require("../middleware/roleMiddleware");

const router = express.Router();


// Create
router.post(
    "/",
    authenticate,
    authorize("ADMIN", "SALES_MANAGER", "SALES_PERSON"),
    createContact
);


// Get all
router.get(
    "/",
    authenticate,
    authorize("ADMIN", "SALES_MANAGER", "SALES_PERSON"),
    getContacts
);


// Get one
router.get(
    "/:id",
    authenticate,
    authorize("ADMIN", "SALES_MANAGER", "SALES_PERSON"),
    getContactById
);


// Update
router.put(
    "/:id",
    authenticate,
    authorize("ADMIN", "SALES_MANAGER", "SALES_PERSON"),
    updateContact
);


// Delete
router.delete(
    "/:id",
    authenticate,
    authorize("ADMIN", "SALES_MANAGER"),
    deleteContact
);


// Assign / reassign
router.patch(
    "/:id/assign",
    authenticate,
    authorize("ADMIN", "SALES_MANAGER"),
    assignContact
);


module.exports = router;