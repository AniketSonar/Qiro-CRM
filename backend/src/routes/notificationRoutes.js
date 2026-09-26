const express = require("express");

const router = express.Router();

const authenticate = require("../middleware/authMiddleware");
const authorize = require("../middleware/roleMiddleware");

const {
    createNotification,
    getMyNotifications,
    getUnreadNotifications,
    markAsRead,
    markAllAsRead,
    deleteNotification
} = require("../controllers/notificationController");


// Create notification
router.post(
    "/",
    authenticate,
    authorize("ADMIN", "SALES_MANAGER", "SALES_PERSON"),
    createNotification
);


// Get current user's notifications
router.get(
    "/",
    authenticate,
    getMyNotifications
);


// Get unread notifications
router.get(
    "/unread",
    authenticate,
    getUnreadNotifications
);


// Mark all as read
router.put(
    "/read-all",
    authenticate,
    markAllAsRead
);


// Mark one as read
router.put(
    "/:id/read",
    authenticate,
    markAsRead
);


// Delete notification
router.delete(
    "/:id",
    authenticate,
    deleteNotification
);


module.exports = router;