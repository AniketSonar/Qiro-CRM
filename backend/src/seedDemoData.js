const pool = require("./config/db");

const marker = "QIRO_DEMO_2026";

const leads = [
    ["Aisha", "Kapoor", "aisha@northstarfoods.in", "+91 98765 12001", "Northstar Foods", "WEBSITE", "NEW", 0, "Retail expansion inquiry"],
    ["Rahul", "Mehta", "rahul@orbitlogistics.in", "+91 98765 12002", "Orbit Logistics", "REFERRAL", "CONTACTED", 850000, "Needs fleet visibility across three hubs"],
    ["Sana", "Khan", "sana@lumeninteriors.in", "+91 98765 12003", "Lumen Interiors", "INSTAGRAM ADS", "QUALIFIED", 1250000, "Interested in a multi-site rollout"],
    ["Vivek", "Shah", "vivek@greenfieldsolar.in", "+91 98765 12004", "Greenfield Solar", "LINKEDIN", "PROPOSAL", 2400000, "Proposal shared for commercial installation"],
    ["Maya", "Iyer", "maya@harborhealth.in", "+91 98765 12005", "Harbor Health", "WEBSITE", "NEGOTIATION", 3100000, "Final pricing discussion"],
    ["Arjun", "Rao", "arjun@vertexmanufacturing.in", "+91 98765 12006", "Vertex Manufacturing", "EXHIBITION", "CONVERTED", 1800000, "Won after trade show follow-up"],
    ["Nikhil", "Patel", "nikhil@bluepeakretail.in", "+91 98765 12007", "Bluepeak Retail", "INSTAGRAM ADS", "NEW", 450000, "Instagram lead form test record"],
    ["Tara", "Desai", "tara@brightlineconsulting.in", "+91 98765 12008", "Brightline Consulting", "REFERRAL", "QUALIFIED", 975000, "Requested a tailored demo"],
    ["Kabir", "Malhotra", "kabir@urbanbuild.in", "+91 98765 12009", "UrbanBuild Projects", "WEBSITE", "PROPOSAL", 2750000, "Procurement team reviewing proposal"],
    ["Riya", "Menon", "riya@freshcart.in", "+91 98765 12010", "FreshCart", "WHATSAPP", "NEGOTIATION", 1450000, "Ready for contract review"]
];

async function seed() {
    const client = await pool.connect();
    try {
        await client.query("BEGIN");
        await client.query(`
            ALTER TABLE leads
            ADD COLUMN IF NOT EXISTS whatsapp VARCHAR(50),
            ADD COLUMN IF NOT EXISTS website TEXT,
            ADD COLUMN IF NOT EXISTS amount NUMERIC(15, 2)
        `);

        const existing = await client.query(
            "SELECT id FROM leads WHERE notes LIKE $1 LIMIT 1",
            [`%${marker}%`]
        );
        if (existing.rows.length > 0) {
            const wonDeal = await client.query(
                `SELECT d.id, d.lead_id, d.assigned_to
                 FROM deals d
                 JOIN leads l ON l.id = d.lead_id
                 WHERE d.description LIKE $1 AND d.stage = 'CLOSED_WON'
                 LIMIT 1`,
                [`%${marker}%`]
            );
            if (wonDeal.rows.length > 0) {
                const customer = await client.query(
                    "SELECT id FROM customers WHERE deal_id = $1 LIMIT 1",
                    [wonDeal.rows[0].id]
                );
                if (customer.rows.length === 0) {
                    await client.query(
                        `INSERT INTO customers (
                            lead_id, deal_id, assigned_to, customer_code, customer_type, status
                        ) VALUES ($1, $2, $3, $4, 'BUSINESS', 'ACTIVE')`,
                        [
                            wonDeal.rows[0].lead_id,
                            wonDeal.rows[0].id,
                            wonDeal.rows[0].assigned_to,
                            `CUS-DEMO-${Date.now()}`
                        ]
                    );
                    console.log("Demo customer account created.");
                }
            }
            console.log("Demo lead, deal, and follow-up data already exists.");
            await client.query("ROLLBACK");
            return;
        }

        const users = await client.query(`
            SELECT u.id
            FROM users u
            JOIN roles r ON r.id = u.role_id
            WHERE u.status = 'ACTIVE'
              AND r.name IN ('ADMIN', 'SALES_MANAGER', 'SALES_PERSON')
            ORDER BY u.id
            LIMIT 4
        `);
        const assignees = users.rows.map((row) => row.id);

        const sourceNames = [...new Set(leads.map((lead) => lead[5]))];
        const sourceIds = {};
        for (const name of sourceNames) {
            const result = await client.query(
                `SELECT id FROM lead_sources WHERE LOWER(name) = LOWER($1) LIMIT 1`,
                [name]
            );
            if (result.rows.length > 0) {
                sourceIds[name] = result.rows[0].id;
            } else {
                const created = await client.query(
                    `INSERT INTO lead_sources (name, description) VALUES ($1, $2) RETURNING id`,
                    [name, "Demo source created for CRM preview data"]
                );
                sourceIds[name] = created.rows[0].id;
            }
        }

        const createdLeads = [];
        for (let index = 0; index < leads.length; index += 1) {
            const [firstName, lastName, email, phone, company, source, status, amount, note] = leads[index];
            const result = await client.query(
                `INSERT INTO leads (
                    first_name, last_name, email, phone, whatsapp, company, website,
                    amount, source_id, status, assigned_to, notes
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
                RETURNING id`,
                [
                    firstName, lastName, email, phone, phone, company, "https://example.com",
                    amount, sourceIds[source], status, assignees[index % Math.max(assignees.length, 1)] || null,
                    `${note} [${marker}]`
                ]
            );
            createdLeads.push({ id: result.rows[0].id, status });
        }

        const deals = [
            [createdLeads[2].id, "Lumen Interiors rollout", 1250000, "QUALIFIED", 30],
            [createdLeads[3].id, "Greenfield commercial solar", 2400000, "PROPOSAL", 14],
            [createdLeads[4].id, "Harbor Health partnership", 3100000, "NEGOTIATION", 7],
            [createdLeads[5].id, "Vertex Manufacturing contract", 1800000, "CLOSED_WON", -20],
            [createdLeads[8].id, "UrbanBuild procurement", 2750000, "PROPOSAL", 21]
        ];
        const createdDeals = [];
        for (const [leadId, title, amount, stage, days] of deals) {
            const result = await client.query(
                `INSERT INTO deals (lead_id, assigned_to, title, description, amount, stage, expected_close_date)
                 VALUES ($1, $2, $3, $4, $5, $6, CURRENT_DATE + ($7 * INTERVAL '1 day'))
                 RETURNING id`,
                [leadId, assignees[0] || null, title, `Demo opportunity [${marker}]`, amount, stage, days]
            );
            createdDeals.push(result.rows[0].id);
        }

        const followUps = [
            [createdLeads[0].id, "CALL", "CURRENT_TIMESTAMP - INTERVAL '2 days'", "Call to qualify budget and timeline", "PENDING"],
            [createdLeads[2].id, "MEETING", "CURRENT_TIMESTAMP", "Discovery meeting for rollout scope", "PENDING"],
            [createdLeads[3].id, "EMAIL", "CURRENT_TIMESTAMP + INTERVAL '2 days'", "Send proposal walkthrough", "PENDING"],
            [createdLeads[4].id, "DEMO", "CURRENT_TIMESTAMP + INTERVAL '5 days'", "Product demo with procurement", "PENDING"],
            [createdLeads[5].id, "CALL", "CURRENT_TIMESTAMP - INTERVAL '6 days'", "Confirm signed agreement", "COMPLETED"]
        ];
        for (const [leadId, type, scheduledAt, note, status] of followUps) {
            await client.query(
                `INSERT INTO follow_ups (lead_id, assigned_to, follow_up_type, scheduled_at, notes, status)
                 VALUES ($1, $2, $3, ${scheduledAt}, $4, $5)`,
                [leadId, assignees[0] || null, type, `${note} [${marker}]`, status]
            );
        }

        await client.query("COMMIT");
        console.log(`Inserted ${createdLeads.length} leads, ${createdDeals.length} deals, and ${followUps.length} follow-ups.`);
    } catch (error) {
        await client.query("ROLLBACK");
        throw error;
    } finally {
        client.release();
        await pool.end();
    }
}

seed().catch((error) => {
    console.error("Demo seed failed:", error.message);
    process.exitCode = 1;
});