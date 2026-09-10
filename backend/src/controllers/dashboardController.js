const pool = require("../config/db");

const getDashboard = async (req, res) => {
    try {
        const user = req.user;

        // Basic user information
        const userInfo = {
            id: user.id,
            name: user.name,
            email: user.email,
            role: user.role
        };

        return res.status(200).json({
            success: true,
            message: "Dashboard data fetched successfully",
            data: {
                user: userInfo,
                metrics: {
                    totalLeads: 0,
                    totalCustomers: 0,
                    totalFollowUps: 0,
                    totalSales: 0,
                    totalRevenue: 0,
                    conversionRate: 0
                }
            }
        });

    } catch (error) {
        console.error("Dashboard error:", error);

        return res.status(500).json({
            success: false,
            message: "Internal server error"
        });
    }
};

module.exports = {
    getDashboard
};