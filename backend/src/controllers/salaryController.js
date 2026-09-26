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

const MONTHS = Array.from({ length: 12 }, (_, index) => index);
const STATUSES = ["Pending", "Processed", "Paid"];

const numeric = (value) => Math.max(0, Number(value) || 0);

const canAccessUser = (req, userId) =>
    req.user.role === "ADMIN" || Number(req.user.id) === Number(userId);

const getUser = async (userId) => {
    const result = await pool.query(
        `SELECT u.id, u.name, u.email, r.name AS role
         FROM users u JOIN roles r ON r.id = u.role_id WHERE u.id = $1`,
        [userId]
    );
    return result.rows[0] || null;
};

const getSalaryData = async (userId, month, year) => {
    const profileResult = await pool.query(
        `SELECT user_id, basic_salary, allowances, deductions, bonus, incentive,
                working_days, present_days, paid_leave, target_amount, target_period,
                target_month, target_year, target_week_start
         FROM salary_profiles WHERE user_id = $1`,
        [userId]
    );
    const profile = profileResult.rows[0] || {
        user_id: Number(userId), basic_salary: 50000, allowances: 8000, deductions: 2500,
        bonus: 0, incentive: 0, working_days: 26, present_days: 26, paid_leave: 0,
        target_amount: 500000, target_period: "MONTHLY", target_month: month,
        target_year: year, target_week_start: null
    };
    const targetPeriod = String(profile.target_period ?? "MONTHLY").toUpperCase();
    const targetMonth = Number(profile.target_month ?? month);
    const targetYear = Number(profile.target_year ?? year);
    const leaveResult = await pool.query(
        `SELECT
            COALESCE(SUM(CASE WHEN leave_type = 'PAID' THEN
                GREATEST(0, LEAST(end_date, make_date($3, $2 + 1, 1) + INTERVAL '1 month - 1 day')::date - GREATEST(start_date, make_date($3, $2 + 1, 1)) + 1)
                ELSE 0 END), 0) AS paid_leave,
            COALESCE(SUM(CASE WHEN leave_type = 'UNPAID' THEN
                GREATEST(0, LEAST(end_date, make_date($3, $2 + 1, 1) + INTERVAL '1 month - 1 day')::date - GREATEST(start_date, make_date($3, $2 + 1, 1)) + 1)
                ELSE 0 END), 0) AS unpaid_leave
         FROM employee_leaves
         WHERE user_id = $1 AND status = 'APPROVED'
           AND start_date <= (make_date($3, $2 + 1, 1) + INTERVAL '1 month - 1 day')::date
           AND end_date >= make_date($3, $2 + 1, 1)`,
        [userId, Number(month), Number(year)]
    );
    const paidLeave = numeric(leaveResult.rows[0].paid_leave);
    const unpaidLeave = numeric(leaveResult.rows[0].unpaid_leave);
    const achievedResult = targetPeriod === "WEEKLY"
        ? await pool.query(
            `SELECT COALESCE(SUM(final_amount), 0) AS achieved_sales FROM sales
             WHERE assigned_to = $1 AND sale_date >= $2::date AND sale_date < ($2::date + INTERVAL '7 days')`,
            [userId, profile.target_week_start]
        )
        : await pool.query(
            `SELECT COALESCE(SUM(final_amount), 0) AS achieved_sales FROM sales
             WHERE assigned_to = $1 AND EXTRACT(MONTH FROM sale_date) = $2 AND EXTRACT(YEAR FROM sale_date) = $3`,
            [userId, targetMonth + 1, targetYear]
        );
    const achievedSales = Number(achievedResult.rows[0].achieved_sales || 0);
    const targetAmount = numeric(profile.target_amount);
    const targetBonus = targetAmount > 0 && achievedSales >= targetAmount ? targetAmount * 0.02 : 0;
    const workingDays = numeric(profile.working_days);
    const presentDays = Math.min(workingDays, Math.max(0, numeric(profile.present_days) - unpaidLeave + paidLeave));
    return {
        profile: { ...profile, paid_leave: paidLeave, present_days: presentDays },
        targetPeriod, targetMonth, targetYear, targetWeekStart: profile.target_week_start,
        achievedSales, targetAmount, targetBonus,
        leaveSummary: { paidLeave, unpaidLeave, presentDays, workingDays }
    };
};

const getSalary = async (req, res) => {
    try {
        const user = await getUser(req.params.userId);
        if (!user) return res.status(404).json({ success: false, message: "User not found" });
        if (user.role !== "SALES_PERSON") return res.status(400).json({ success: false, message: "Selected user is not a sales person" });
        if (!canAccessUser(req, req.params.userId)) return res.status(403).json({ success: false, message: "You can only view your own salary" });
        const data = await getSalaryData(req.params.userId, req.query.month ?? new Date().getMonth(), req.query.year ?? new Date().getFullYear());
        const records = await pool.query(
            `SELECT id, month, year, net_salary, achieved_sales, target_amount, target_bonus,
                    working_days, present_days, paid_leave, status
             FROM salary_records WHERE user_id = $1 ORDER BY year DESC, month DESC`,
            [req.params.userId]
        );
        return res.json({ success: true, data: { user, ...data, records: records.rows } });
    } catch (error) {
        console.error("Get salary error:", error);
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
};

const getLeaves = async (req, res) => {
    try {
        const user = await getUser(req.params.userId);
        if (!user) return res.status(404).json({ success: false, message: "User not found" });
        if (user.role !== "SALES_PERSON") return res.status(400).json({ success: false, message: "Selected user is not a sales person" });
        if (!canAccessUser(req, req.params.userId)) return res.status(403).json({ success: false, message: "You can only view your own leave" });
        const result = await pool.query(
                `SELECT l.id, l.user_id, to_char(l.start_date::date, 'YYYY-MM-DD') AS start_date,
                    to_char(l.end_date::date, 'YYYY-MM-DD') AS end_date, l.leave_type,
                    l.days, l.reason, l.status, l.reviewed_by, l.created_at, l.updated_at,
                    reviewer.name AS reviewed_by_name
             FROM employee_leaves l LEFT JOIN users reviewer ON reviewer.id = l.reviewed_by
             WHERE l.user_id = $1 ORDER BY l.start_date DESC, l.created_at DESC`,
            [req.params.userId]
        );
        return res.json({ success: true, data: { leaves: result.rows } });
    } catch (error) {
        console.error("Get leaves error:", error);
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
};

const createLeave = async (req, res) => {
    try {
        const user = await getUser(req.params.userId);
        if (!user) return res.status(404).json({ success: false, message: "User not found" });
        if (user.role !== "SALES_PERSON") return res.status(400).json({ success: false, message: "Selected user is not a sales person" });
        if (!canAccessUser(req, req.params.userId)) return res.status(403).json({ success: false, message: "You can only request leave for yourself" });
        const { startDate, endDate, leaveType, days, reason } = req.body || {};
        if (!startDate || !endDate || !["PAID", "UNPAID"].includes(leaveType) || numeric(days) <= 0) {
            return res.status(400).json({ success: false, message: "Start date, end date, leave type and days are required" });
        }
        const result = await pool.query(
            `INSERT INTO employee_leaves (user_id, start_date, end_date, leave_type, days, reason)
             VALUES ($1, $2::date, $3::date, $4, $5, $6) RETURNING *`,
            [req.params.userId, String(startDate).slice(0, 10), String(endDate).slice(0, 10), leaveType, numeric(days), reason?.trim() || null]
        );
        return res.status(201).json({ success: true, data: { leave: result.rows[0] } });
    } catch (error) {
        console.error("Create leave error:", error);
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
};

const updateLeaveStatus = async (req, res) => {
    try {
        if (!["PENDING", "APPROVED", "REJECTED"].includes(req.body?.status)) return res.status(400).json({ success: false, message: "Invalid leave status" });
        const result = await pool.query(
            `UPDATE employee_leaves SET status = $1, reviewed_by = $2, updated_at = CURRENT_TIMESTAMP
             WHERE id = $3 RETURNING *`,
            [req.body.status, req.user.id, req.params.leaveId]
        );
        if (result.rows.length === 0) return res.status(404).json({ success: false, message: "Leave request not found" });
        return res.json({ success: true, data: { leave: result.rows[0] } });
    } catch (error) {
        console.error("Update leave status error:", error);
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
};

const deleteLeave = async (req, res) => {
    try {
        const result = await pool.query(
            `DELETE FROM employee_leaves
             WHERE id = $1 AND user_id = $2 AND status = 'PENDING'
             RETURNING id`,
            [req.params.leaveId, req.user.id]
        );
        if (result.rows.length === 0) return res.status(404).json({ success: false, message: "Only your pending leave requests can be deleted" });
        return res.json({ success: true, message: "Leave request deleted" });
    } catch (error) {
        console.error("Delete leave error:", error);
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
};

const saveProfile = async (req, res) => {
    try {
        const user = await getUser(req.params.userId);
        if (!user) return res.status(404).json({ success: false, message: "User not found" });
        if (user.role !== "SALES_PERSON") return res.status(400).json({ success: false, message: "Selected user is not a sales person" });
        const body = req.body || {};
        const values = [
            req.params.userId, numeric(body.basicSalary), numeric(body.allowances), numeric(body.deductions),
            numeric(body.bonus), numeric(body.incentive), numeric(body.workingDays), numeric(body.presentDays),
            numeric(body.paidLeave), numeric(body.targetAmount),
            ["MONTHLY", "WEEKLY"].includes(String(body.targetPeriod).toUpperCase()) ? String(body.targetPeriod).toUpperCase() : "MONTHLY",
            Number(body.targetMonth), Number(body.targetYear), body.targetWeekStart || null
        ];
        const result = await pool.query(
            `INSERT INTO salary_profiles
                (user_id, basic_salary, allowances, deductions, bonus, incentive, working_days,
                 present_days, paid_leave, target_amount, target_period, target_month, target_year, target_week_start)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
             ON CONFLICT (user_id) DO UPDATE SET
                basic_salary = EXCLUDED.basic_salary, allowances = EXCLUDED.allowances,
                deductions = EXCLUDED.deductions, bonus = EXCLUDED.bonus, incentive = EXCLUDED.incentive,
                working_days = EXCLUDED.working_days, present_days = EXCLUDED.present_days,
                paid_leave = EXCLUDED.paid_leave, target_amount = EXCLUDED.target_amount,
                target_period = EXCLUDED.target_period, target_month = EXCLUDED.target_month,
                target_year = EXCLUDED.target_year, target_week_start = EXCLUDED.target_week_start,
                updated_at = CURRENT_TIMESTAMP
             RETURNING *`, values
        );
        return res.json({ success: true, data: { profile: result.rows[0] } });
    } catch (error) {
        console.error("Save salary profile error:", error);
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
};

const createRecord = async (req, res) => {
    try {
        const user = await getUser(req.params.userId);
        if (!user) return res.status(404).json({ success: false, message: "User not found" });
        const month = Number(req.body?.month);
        const year = Number(req.body?.year);
        if (!MONTHS.includes(month) || !Number.isInteger(year) || year < 2020) return res.status(400).json({ success: false, message: "Valid month and year are required" });
        const data = await getSalaryData(req.params.userId, month, year);
        const profile = data.profile;
        const attendanceDays = data.leaveSummary.presentDays;
        const factor = Math.min(1, attendanceDays / Math.max(1, numeric(profile.working_days)));
        const netSalary = Math.max(0, (numeric(profile.basic_salary) + numeric(profile.allowances) + numeric(profile.bonus) + numeric(profile.incentive) + data.targetBonus) * factor - numeric(profile.deductions));
        const status = STATUSES.includes(req.body.status) ? req.body.status : "Pending";
        const result = await pool.query(
            `INSERT INTO salary_records
                (user_id, month, year, net_salary, achieved_sales, target_amount, target_bonus,
                 working_days, present_days, paid_leave, status)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
             ON CONFLICT (user_id, month, year) DO UPDATE SET
                net_salary = EXCLUDED.net_salary, achieved_sales = EXCLUDED.achieved_sales,
                target_amount = EXCLUDED.target_amount, target_bonus = EXCLUDED.target_bonus,
                working_days = EXCLUDED.working_days, present_days = EXCLUDED.present_days,
                paid_leave = EXCLUDED.paid_leave
             RETURNING *`,
            [req.params.userId, month, year, netSalary, data.achievedSales, data.targetAmount, data.targetBonus, data.leaveSummary.workingDays, data.leaveSummary.presentDays, data.leaveSummary.paidLeave, status]
        );
        return res.status(201).json({ success: true, data: { record: result.rows[0] } });
    } catch (error) {
        console.error("Create salary record error:", error);
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
};

const updateRecordStatus = async (req, res) => {
    try {
        if (!STATUSES.includes(req.body?.status)) return res.status(400).json({ success: false, message: "Invalid salary status" });
        const result = await pool.query("UPDATE salary_records SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING *", [req.body.status, req.params.recordId]);
        if (result.rows.length === 0) return res.status(404).json({ success: false, message: "Salary record not found" });
        return res.json({ success: true, data: { record: result.rows[0] } });
    } catch (error) {
        console.error("Update salary status error:", error);
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
};

module.exports = {
    getSalaryProfiles,
    getMySalaryProfile,
    updateSalaryProfile,
    getSalary,
    saveProfile,
    createRecord,
    updateRecordStatus,
    getLeaves,
    createLeave,
    updateLeaveStatus,
    deleteLeave
};
