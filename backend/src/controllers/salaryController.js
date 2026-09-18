const pool = require("../config/db");

/**
 * IT Industry Standard Commission & Bonus Calculator:
 * - < 80% target: 0% bonus (threshold not reached)
 * - 80% - 99% target: Partial bonus (50% of declared incentive)
 * - 100% - 120% target: 100% of declared incentive/bonus %
 * - > 120% target (Accelerator Tier): 100% bonus + 2.5% accelerator on the surplus overachievement
 */
function calculateBonus(achieved, target, incentivePercent, fixedBonus = 0) {
    const ach = Number(achieved) || 0;
    const tgt = Number(target) || 0;
    const rate = Number(incentivePercent) || 0;
    const baseBonus = Number(fixedBonus) || 0;

    if (tgt <= 0) {
        return {
            completionRate: 0,
            earnedBonus: baseBonus,
            status: "No Target",
            tier: "STANDARD",
            acceleratorAmount: 0
        };
    }

    const completionRate = Math.round((ach / tgt) * 100 * 10) / 10;
    let earnedBonus = 0;
    let acceleratorAmount = 0;
    let status = "In Progress";
    let tier = "BELOW_TARGET";

    if (completionRate >= 120) {
        // Accelerator tier: Full incentive on target + bonus rate + 2.5% on surplus
        const standardIncentive = (tgt * rate) / 100;
        const surplus = ach - tgt;
        const surplusBonus = (surplus * (rate + 2.5)) / 100;
        acceleratorAmount = Math.round(surplusBonus);
        earnedBonus = Math.round(standardIncentive + surplusBonus + baseBonus);
        status = "Overachieved 🚀";
        tier = "ACCELERATOR";
    } else if (completionRate >= 100) {
        // 100% - 119%: Full standard incentive on achieved
        earnedBonus = Math.round(((ach * rate) / 100) + baseBonus);
        status = "Target Achieved 🎉";
        tier = "ACHIEVED";
    } else if (completionRate >= 80) {
        // 80% - 99%: Partial payout (50% of incentive)
        earnedBonus = Math.round(((ach * (rate * 0.5)) / 100));
        status = "Near Target";
        tier = "PARTIAL";
    } else {
        earnedBonus = 0;
        status = "In Progress";
        tier = "BELOW_TARGET";
    }

    return {
        completionRate,
        earnedBonus,
        status,
        tier,
        acceleratorAmount
    };
}

/**
 * Fetch achieved sales for a salesperson within a given month & year
 */
async function getAchievedSales(userId, month, year) {
    try {
        const salesQuery = `
            SELECT COALESCE(SUM(final_amount), 0) AS total_sales
            FROM sales
            WHERE assigned_to = $1
              AND (
                (EXTRACT(MONTH FROM sale_date) = $2 AND EXTRACT(YEAR FROM sale_date) = $3)
                OR (sale_date IS NULL AND EXTRACT(MONTH FROM created_at) = $2 AND EXTRACT(YEAR FROM created_at) = $3)
              )
        `;
        const salesRes = await pool.query(salesQuery, [userId, month, year]);
        let total = Number(salesRes.rows[0]?.total_sales) || 0;

        if (total === 0) {
            const dealsQuery = `
                SELECT COALESCE(SUM(amount), 0) AS total_deals
                FROM deals
                WHERE assigned_to = $1
                  AND stage = 'CLOSED_WON'
                  AND (
                    (EXTRACT(MONTH FROM actual_close_date) = $2 AND EXTRACT(YEAR FROM actual_close_date) = $3)
                    OR (actual_close_date IS NULL AND EXTRACT(MONTH FROM updated_at) = $2 AND EXTRACT(YEAR FROM updated_at) = $3)
                    OR (actual_close_date IS NULL AND EXTRACT(MONTH FROM created_at) = $2 AND EXTRACT(YEAR FROM created_at) = $3)
                  )
            `;
            const dealsRes = await pool.query(dealsQuery, [userId, month, year]);
            total = Number(dealsRes.rows[0]?.total_deals) || 0;
        }

        if (total === 0) {
            const allDeals = await pool.query(
                `SELECT COALESCE(SUM(amount), 0) AS total_deals FROM deals WHERE assigned_to = $1 AND stage = 'CLOSED_WON'`,
                [userId]
            );
            total = Number(allDeals.rows[0]?.total_deals) || 0;
        }

        return total;
    } catch (err) {
        console.error("Error calculating achieved sales:", err.message);
        return 0;
    }
}

/**
 * GET /api/salaries (ADMIN ONLY)
 */
const getSalaryProfiles = async (req, res) => {
    try {
        const now = new Date();
        const currentMonth = Number(req.query.month) || (now.getMonth() + 1);
        const currentYear = Number(req.query.year) || now.getFullYear();

        const usersQuery = `
            SELECT u.id, u.name, u.email, u.status, r.name AS role
            FROM users u
            JOIN roles r ON u.role_id = r.id
            WHERE r.name IN ('SALES_PERSON', 'SALES_MANAGER')
            ORDER BY u.name ASC
        `;
        const usersRes = await pool.query(usersQuery);

        const profiles = [];
        for (const user of usersRes.rows) {
            const profileRes = await pool.query(
                `SELECT * FROM salary_profiles WHERE user_id = $1`,
                [user.id]
            );

            let p = profileRes.rows[0];
            if (!p) {
                p = {
                    user_id: user.id,
                    basic_salary: 40000,
                    allowances: 5000,
                    deductions: 2000,
                    bonus: 0,
                    incentive_percent: 5,
                    target_amount: 300000,
                    target_month: currentMonth,
                    target_year: currentYear
                };
            }

            const achievedSales = await getAchievedSales(user.id, currentMonth, currentYear);
            const targetAmount = Number(p.target_amount) || 0;
            const incentivePercent = Number(p.incentive_percent) || 5;
            const fixedBonus = Number(p.bonus) || 0;

            const bonusCalc = calculateBonus(achievedSales, targetAmount, incentivePercent, fixedBonus);

            const basic = Number(p.basic_salary) || 0;
            const allowances = Number(p.allowances) || 0;
            const deductions = Number(p.deductions) || 0;
            const netBase = basic + allowances - deductions;
            const totalProjectedPayout = netBase + bonusCalc.earnedBonus;

            profiles.push({
                user: {
                    id: user.id,
                    name: user.name,
                    email: user.email,
                    role: user.role,
                    status: user.status
                },
                salary: {
                    basicSalary: basic,
                    allowances,
                    deductions,
                    netBaseSalary: netBase,
                    fixedBonus
                },
                target: {
                    month: currentMonth,
                    year: currentYear,
                    targetAmount,
                    achievedSales,
                    completionRate: bonusCalc.completionRate,
                    status: bonusCalc.status,
                    tier: bonusCalc.tier,
                    incentivePercent,
                    earnedBonus: bonusCalc.earnedBonus,
                    acceleratorAmount: bonusCalc.acceleratorAmount
                },
                totalProjectedPayout
            });
        }

        return res.status(200).json({
            success: true,
            data: profiles,
            period: { month: currentMonth, year: currentYear }
        });
    } catch (error) {
        console.error("getSalaryProfiles error:", error);
        return res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * GET /api/salaries/my (AUTHENTICATED SALES PERSON)
 */
const getMySalaryProfile = async (req, res) => {
    try {
        const userId = req.user.id;
        const now = new Date();
        const currentMonth = Number(req.query.month) || (now.getMonth() + 1);
        const currentYear = Number(req.query.year) || now.getFullYear();

        const userRes = await pool.query(
            `SELECT u.id, u.name, u.email, r.name AS role, u.status
             FROM users u
             JOIN roles r ON u.role_id = r.id
             WHERE u.id = $1`,
            [userId]
        );

        if (userRes.rows.length === 0) {
            return res.status(404).json({ success: false, message: "User not found" });
        }
        const user = userRes.rows[0];

        const profileRes = await pool.query(
            `SELECT * FROM salary_profiles WHERE user_id = $1`,
            [userId]
        );

        let p = profileRes.rows[0];
        if (!p) {
            p = {
                user_id: userId,
                basic_salary: 45000,
                allowances: 6000,
                deductions: 2000,
                bonus: 0,
                incentive_percent: 5,
                target_amount: 400000,
                target_month: currentMonth,
                target_year: currentYear
            };
        }

        const achievedSales = await getAchievedSales(userId, currentMonth, currentYear);
        const targetAmount = Number(p.target_amount) || 0;
        const incentivePercent = Number(p.incentive_percent) || 5;
        const fixedBonus = Number(p.bonus) || 0;

        const bonusCalc = calculateBonus(achievedSales, targetAmount, incentivePercent, fixedBonus);

        const basic = Number(p.basic_salary) || 0;
        const allowances = Number(p.allowances) || 0;
        const deductions = Number(p.deductions) || 0;
        const netBase = basic + allowances - deductions;
        const totalProjectedPayout = netBase + bonusCalc.earnedBonus;

        return res.status(200).json({
            success: true,
            data: {
                user: {
                    id: user.id,
                    name: user.name,
                    email: user.email,
                    role: user.role,
                    status: user.status
                },
                salary: {
                    basicSalary: basic,
                    allowances,
                    deductions,
                    netBaseSalary: netBase,
                    fixedBonus
                },
                target: {
                    month: currentMonth,
                    year: currentYear,
                    targetAmount,
                    achievedSales,
                    completionRate: bonusCalc.completionRate,
                    status: bonusCalc.status,
                    tier: bonusCalc.tier,
                    incentivePercent,
                    earnedBonus: bonusCalc.earnedBonus,
                    acceleratorAmount: bonusCalc.acceleratorAmount
                },
                totalProjectedPayout
            }
        });
    } catch (error) {
        console.error("getMySalaryProfile error:", error);
        return res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * PUT /api/salaries/:userId (ADMIN ONLY)
 */
const updateSalaryProfile = async (req, res) => {
    try {
        const targetUserId = req.params.userId;
        const {
            basic_salary,
            allowances = 0,
            deductions = 0,
            bonus = 0,
            target_amount = 0,
            incentive_percent = 5,
            target_month,
            target_year
        } = req.body;

        if (basic_salary === undefined || basic_salary === null) {
            return res.status(400).json({
                success: false,
                message: "Basic salary is required"
            });
        }

        const now = new Date();
        const month = target_month || (now.getMonth() + 1);
        const year = target_year || now.getFullYear();

        const userCheck = await pool.query(`SELECT id, name FROM users WHERE id = $1`, [targetUserId]);
        if (userCheck.rows.length === 0) {
            return res.status(404).json({ success: false, message: "Target user not found" });
        }

        const upsertQuery = `
            INSERT INTO salary_profiles (
                user_id,
                basic_salary,
                allowances,
                deductions,
                bonus,
                target_amount,
                incentive_percent,
                target_month,
                target_year,
                updated_at
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
            ON CONFLICT (user_id)
            DO UPDATE SET
                basic_salary = EXCLUDED.basic_salary,
                allowances = EXCLUDED.allowances,
                deductions = EXCLUDED.deductions,
                bonus = EXCLUDED.bonus,
                target_amount = EXCLUDED.target_amount,
                incentive_percent = EXCLUDED.incentive_percent,
                target_month = EXCLUDED.target_month,
                target_year = EXCLUDED.target_year,
                updated_at = NOW()
            RETURNING *
        `;

        const result = await pool.query(upsertQuery, [
            targetUserId,
            Number(basic_salary),
            Number(allowances),
            Number(deductions),
            Number(bonus),
            Number(target_amount),
            Number(incentive_percent),
            Number(month),
            Number(year)
        ]);

        return res.status(200).json({
            success: true,
            message: `Salary and target updated successfully for ${userCheck.rows[0].name}`,
            data: result.rows[0]
        });
    } catch (error) {
        console.error("updateSalaryProfile error:", error);
        return res.status(500).json({ success: false, message: error.message });
    }
};

module.exports = {
    getSalaryProfiles,
    getMySalaryProfile,
    updateSalaryProfile
};
