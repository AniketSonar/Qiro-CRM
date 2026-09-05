const express = require("express");
const cors = require("cors");
require("dotenv").config();

const pool = require("./config/db");
const authRoutes = require("./routes/authRoutes");
const userRoutes = require("./routes/userRoutes");
const dashboardRoutes = require("./routes/dashboardRoutes");
const leadRoutes = require("./routes/leadRoutes");
const leadSourceRoutes = require("./routes/leadSourceRoutes");
const contactRoutes = require("./routes/contactRoutes");
const followUpRoutes = require("./routes/followUpRoutes");
const activityRoutes = require("./routes/activityRoutes");
const followUpOutcomeRoutes = require("./routes/followUpOutcomeRoutes");
const dealRoutes = require("./routes/dealRoutes");
const customerRoutes = require("./routes/customerRoutes");
const salesRoutes = require("./routes/salesRoutes");
const notificationRoutes = require("./routes/notificationRoutes");
const reportRoutes = require("./routes/reportRoutes");

const app = express();

app.use(cors());
app.use(cors({
    origin: true,
    credentials: true
}));

app.use(express.json());

app.get("/api/health", (req, res) => {
    res.json({
        success: true,
        message: "CRM Backend is running"
    });
});

app.get("/api/db-test", async (req, res) => {
    try {
        const result = await pool.query("SELECT NOW()");

        res.json({
            success: true,
            message: "Supabase PostgreSQL connected successfully",
            databaseTime: result.rows[0].now
        });
    } catch (error) {
        console.error("Database test failed:", error);

        res.status(500).json({
            success: false,
            message: "Database connection failed"
        });
    }
});

app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/leads", leadRoutes);
app.use("/api/lead-sources", leadSourceRoutes);
app.use("/api/contacts", contactRoutes);
app.use("/api/follow-ups", followUpRoutes);
app.use("/api/activities", activityRoutes);
app.use("/api/follow-up-outcomes",followUpOutcomeRoutes);
app.use("/api/deals", dealRoutes);
app.use("/api/customers", customerRoutes);
app.use("/api/sales", salesRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/reports", reportRoutes);

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
    console.log(`CRM Backend running on port ${PORT}`);
});