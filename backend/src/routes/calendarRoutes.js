const express = require("express");
const authenticate = require("../middleware/authMiddleware");
const authorize = require("../middleware/roleMiddleware");
const { getCalendar, createHoliday, deleteHoliday } = require("../controllers/calendarController");

const router = express.Router();

router.get("/", authenticate, authorize("ADMIN", "SALES_PERSON"), getCalendar);
router.post("/holidays", authenticate, authorize("ADMIN"), createHoliday);
router.delete("/holidays/:id", authenticate, authorize("ADMIN"), deleteHoliday);

module.exports = router;