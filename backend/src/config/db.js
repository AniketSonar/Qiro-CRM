const { Pool } = require("pg");
require("dotenv").config();

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
        rejectUnauthorized: false
    }
});

pool.on("connect", () => {
    console.log("Connected to Supabase PostgreSQL");
});

pool.on("error", (err) => {
    console.error("Unexpected PostgreSQL error:", err);
});

module.exports = pool;

const initSalarySchema = async () => {
    await pool.query(`
        CREATE TABLE IF NOT EXISTS salary_profiles (
            user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
            basic_salary NUMERIC(12,2) NOT NULL DEFAULT 0,
            allowances NUMERIC(12,2) NOT NULL DEFAULT 0,
            deductions NUMERIC(12,2) NOT NULL DEFAULT 0,
            bonus NUMERIC(12,2) NOT NULL DEFAULT 0,
            incentive NUMERIC(12,2) NOT NULL DEFAULT 0,
            working_days INTEGER NOT NULL DEFAULT 26,
            present_days INTEGER NOT NULL DEFAULT 26,
            paid_leave INTEGER NOT NULL DEFAULT 0,
            target_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
            target_period VARCHAR(10) NOT NULL DEFAULT 'MONTHLY' CHECK (target_period IN ('MONTHLY', 'WEEKLY')),
            target_month INTEGER NOT NULL DEFAULT 0 CHECK (target_month BETWEEN 0 AND 11),
            target_year INTEGER NOT NULL DEFAULT 2026,
            target_week_start DATE,
            created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
        ALTER TABLE salary_profiles ADD COLUMN IF NOT EXISTS target_period VARCHAR(10) NOT NULL DEFAULT 'MONTHLY';
        ALTER TABLE salary_profiles ADD COLUMN IF NOT EXISTS target_week_start DATE;
        CREATE TABLE IF NOT EXISTS salary_records (
            id SERIAL PRIMARY KEY,
            user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            month INTEGER NOT NULL CHECK (month BETWEEN 0 AND 11),
            year INTEGER NOT NULL,
            net_salary NUMERIC(12,2) NOT NULL DEFAULT 0,
            achieved_sales NUMERIC(12,2) NOT NULL DEFAULT 0,
            target_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
            target_bonus NUMERIC(12,2) NOT NULL DEFAULT 0,
            working_days INTEGER NOT NULL DEFAULT 26,
            present_days INTEGER NOT NULL DEFAULT 26,
            paid_leave INTEGER NOT NULL DEFAULT 0,
            status VARCHAR(20) NOT NULL DEFAULT 'Pending' CHECK (status IN ('Pending', 'Processed', 'Paid')),
            created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            UNIQUE (user_id, month, year)
        );
        CREATE TABLE IF NOT EXISTS employee_leaves (
            id SERIAL PRIMARY KEY,
            user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            start_date DATE NOT NULL,
            end_date DATE NOT NULL,
            leave_type VARCHAR(10) NOT NULL CHECK (leave_type IN ('PAID', 'UNPAID')),
            days NUMERIC(5,2) NOT NULL CHECK (days > 0),
            reason TEXT,
            status VARCHAR(20) NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED')),
            reviewed_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
            created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            CHECK (end_date >= start_date)
        );
        CREATE TABLE IF NOT EXISTS company_holidays (
            id SERIAL PRIMARY KEY,
            holiday_date DATE NOT NULL UNIQUE,
            name VARCHAR(160) NOT NULL,
            description TEXT,
            created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
            created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
        ALTER TABLE employee_leaves
            ALTER COLUMN start_date TYPE DATE USING start_date::date,
            ALTER COLUMN end_date TYPE DATE USING end_date::date;
    `);
};

module.exports.initSalarySchema = initSalarySchema;


