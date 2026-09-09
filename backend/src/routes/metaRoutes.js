const express = require("express");
const crypto = require("crypto");
const pool = require("../config/db");

const router = express.Router();

const VERIFY_TOKEN = process.env.META_VERIFY_TOKEN || "qiro_meta_leadgen_verify_token_2026";
const DEFAULT_SOURCE_NAME = "INSTAGRAM ADS";

let leadExtraColumnsReady = false;

/**
 * Ensures required columns exist on the leads table.
 */
const ensureLeadExtraColumns = async () => {
    if (leadExtraColumnsReady) return;
    try {
        await pool.query(`
            ALTER TABLE leads
            ADD COLUMN IF NOT EXISTS whatsapp VARCHAR(50),
            ADD COLUMN IF NOT EXISTS website TEXT,
            ADD COLUMN IF NOT EXISTS designation VARCHAR(150),
            ADD COLUMN IF NOT EXISTS amount NUMERIC(15, 2),
            ADD COLUMN IF NOT EXISTS meta_leadgen_id VARCHAR(100)
        `);
        leadExtraColumnsReady = true;
    } catch (err) {
        console.warn("Could not alter leads table columns:", err.message);
    }
};

/**
 * Ensures the specified lead source exists in lead_sources table.
 */
const getOrCreateMetaLeadSource = async (sourceName = DEFAULT_SOURCE_NAME) => {
    try {
        const cleanName = sourceName.trim();
        const existing = await pool.query(
            `SELECT id FROM lead_sources WHERE LOWER(name) = LOWER($1) LIMIT 1`,
            [cleanName]
        );
        if (existing.rows.length > 0) {
            return existing.rows[0].id;
        }

        const created = await pool.query(
            `INSERT INTO lead_sources (name, description, is_active)
             VALUES ($1, $2, true)
             RETURNING id`,
            [cleanName, "Leads captured automatically from Meta (Facebook & Instagram) Lead Ads"]
        );
        return created.rows[0].id;
    } catch (error) {
        console.error("Error ensuring lead source:", error.message);
        return null;
    }
};

/**
 * Parses Meta field_data array into normalized lead fields and custom notes.
 */
const parseMetaFieldData = (fieldData = []) => {
    const fields = {};
    const customQuestions = [];

    for (const item of fieldData) {
        const name = (item.name || "").toLowerCase().trim();
        const value = Array.isArray(item.values) ? item.values[0] : item.values;
        if (!value) continue;

        if (name === "full_name") {
            fields.full_name = String(value).trim();
        } else if (name === "first_name") {
            fields.first_name = String(value).trim();
        } else if (name === "last_name") {
            fields.last_name = String(value).trim();
        } else if (name === "email") {
            fields.email = String(value).trim().toLowerCase();
        } else if (name === "phone_number" || name === "phone") {
            fields.phone = String(value).replace(/^p:/i, "").trim();
        } else if (name === "company_name" || name === "company") {
            fields.company = String(value).trim();
        } else if (name === "job_title" || name === "designation") {
            fields.designation = String(value).trim();
        } else if (name === "city") {
            fields.city = String(value).trim();
        } else if (name === "whatsapp" || name === "whatsapp_number") {
            fields.whatsapp = String(value).replace(/^p:/i, "").trim();
        } else {
            customQuestions.push(`${item.name}: ${value}`);
        }
    }

    // If first_name not split, parse from full_name
    if (!fields.first_name && fields.full_name) {
        const parts = fields.full_name.split(/\s+/);
        fields.first_name = parts[0];
        fields.last_name = parts.slice(1).join(" ") || null;
    }

    if (!fields.first_name) {
        fields.first_name = fields.email ? fields.email.split("@")[0] : "Instagram Lead";
    }

    fields.customQuestions = customQuestions;
    return fields;
};

/**
 * Automatically picks the next active salesperson for lead assignment.
 * Uses round-robin / least-loaded distribution so leads are fairly divided.
 */
const getNextAssignedSalesperson = async () => {
    try {
        const result = await pool.query(`
            SELECT u.id, u.name, COUNT(l.id) AS assigned_count
            FROM users u
            JOIN roles r ON u.role_id = r.id
            LEFT JOIN leads l ON l.assigned_to = u.id AND l.status NOT IN ('LOST', 'CONVERTED')
            WHERE u.status = 'ACTIVE'
              AND r.name = 'SALES_PERSON'
            GROUP BY u.id, u.name
            ORDER BY assigned_count ASC, u.id ASC
            LIMIT 1
        `);

        if (result.rows.length > 0) {
            return result.rows[0];
        }

        const fallback = await pool.query(`
            SELECT u.id, u.name
            FROM users u
            JOIN roles r ON u.role_id = r.id
            WHERE u.status = 'ACTIVE'
              AND r.name IN ('SALES_PERSON', 'SALES_MANAGER')
            ORDER BY u.id ASC
            LIMIT 1
        `);

        return fallback.rows[0] || null;
    } catch (err) {
        console.error("Error determining auto-assigned salesperson:", err.message);
        return null;
    }
};

/**
 * Dispatches in-app notifications to active sales reps and managers when a new Meta lead arrives.
 */
const notifyTeamOfNewLead = async (lead, sourceTitle = "Instagram Ad", assignedUser = null) => {
    try {
        const users = await pool.query(`
            SELECT u.id
            FROM users u
            JOIN roles r ON u.role_id = r.id
            WHERE u.status = 'ACTIVE'
              AND r.name IN ('ADMIN', 'SALES_MANAGER', 'SALES_PERSON')
            LIMIT 5
        `);

        const leadName = [lead.first_name, lead.last_name].filter(Boolean).join(" ");
        const companyPart = lead.company ? ` from ${lead.company}` : "";
        const assignmentPart = assignedUser ? ` (Assigned to: ${assignedUser.name})` : "";
        const title = `🎯 New ${sourceTitle} Lead: ${leadName}`;
        const message = `${leadName}${companyPart} just submitted an Instant Form on ${sourceTitle}${assignmentPart}. Review their details and follow up.`;

        for (const u of users.rows) {
            await pool.query(
                `INSERT INTO notifications (user_id, title, message, notification_type, related_id, related_type)
                 VALUES ($1, $2, $3, 'LEAD_CREATED', $4, 'LEADS')`,
                [u.id, title, message, lead.id]
            );
        }

        // Direct notification to assigned salesperson if not in the initial 5
        if (assignedUser && !users.rows.some(u => u.id === assignedUser.id)) {
            await pool.query(
                `INSERT INTO notifications (user_id, title, message, notification_type, related_id, related_type)
                 VALUES ($1, $2, $3, 'LEAD_CREATED', $4, 'LEADS')`,
                [
                    assignedUser.id,
                    `🎯 New ${sourceTitle} Lead Assigned: ${leadName}`,
                    `You have been assigned ${leadName}${companyPart}. Follow up now.`,
                    lead.id
                ]
            );
        }
    } catch (err) {
        console.warn("Failed to dispatch in-app notifications for lead:", err.message);
    }
};

/**
 * Logs an activity record for the newly ingested lead.
 */
const logLeadActivity = async (lead, sourceTitle = "Instagram Ad", details = "", assignedUser = null) => {
    try {
        const assignmentNote = assignedUser ? ` • Automatically assigned to ${assignedUser.name}.` : "";
        await pool.query(
            `INSERT INTO activities (lead_id, activity_type, subject, description, activity_at)
             VALUES ($1, 'NOTE', $2, $3, CURRENT_TIMESTAMP)`,
            [
                lead.id,
                `Captured via ${sourceTitle}`,
                (details || `Lead automatically captured from Meta Instant Form.`) + assignmentNote
            ]
        );
    } catch (err) {
        console.warn("Failed to log activity for lead:", err.message);
    }
};

/**
 * Validates the HMAC SHA256 signature if META_APP_SECRET is configured.
 */
const verifyMetaSignature = (req) => {
    const signature = req.headers["x-hub-signature-256"];
    const appSecret = process.env.META_APP_SECRET;

    if (!appSecret || !signature) {
        return true;
    }

    try {
        const hmac = crypto.createHmac("sha256", appSecret);
        const expectedSignature = "sha256=" + hmac.update(JSON.stringify(req.body)).digest("hex");
        return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature));
    } catch (err) {
        console.error("Signature verification error:", err);
        return false;
    }
};

/**
 * Ingests a lead from a Meta leadgen ID by fetching from Graph API and saving into DB.
 */
const processLeadgenEvent = async ({ leadgenId, formId, adId, pageId, adgroupId }) => {
    await ensureLeadExtraColumns();

    // 1. Check idempotency / duplicates
    if (leadgenId) {
        const existing = await pool.query(
            `SELECT * FROM leads WHERE meta_leadgen_id = $1 LIMIT 1`,
            [String(leadgenId)]
        );
        if (existing.rows.length > 0) {
            console.log(`Lead with leadgen_id ${leadgenId} already ingested, skipping.`);
            return existing.rows[0];
        }
    }

    // 2. Fetch details from Meta Graph API
    const pageAccessToken = process.env.META_PAGE_ACCESS_TOKEN;
    let fieldData = [];

    if (pageAccessToken && leadgenId) {
        try {
            const graphUrl = `https://graph.facebook.com/v20.0/${leadgenId}?access_token=${pageAccessToken}`;
            const response = await fetch(graphUrl);
            if (!response.ok) {
                const errText = await response.text();
                console.error(`Meta Graph API error (${response.status}):`, errText);
            } else {
                const leadJson = await response.json();
                fieldData = leadJson.field_data || [];
            }
        } catch (fetchErr) {
            console.error("Failed to fetch lead details from Meta Graph API:", fetchErr);
        }
    } else {
        console.warn("META_PAGE_ACCESS_TOKEN not configured or empty. Saving lead metadata.");
    }

    // 3. Parse fields
    const parsed = parseMetaFieldData(fieldData);

    // 4. Source
    const sourceId = await getOrCreateMetaLeadSource(DEFAULT_SOURCE_NAME);

    // 5. Notes
    const noteLines = [
        "Captured from Meta / Instagram Ad Instant Form",
        formId ? `Form ID: ${formId}` : null,
        adId ? `Ad ID: ${adId}` : null,
        leadgenId ? `Leadgen ID: ${leadgenId}` : null,
        ...(parsed.customQuestions || [])
    ].filter(Boolean);

    // 6. Auto-assign to salesperson (round-robin)
    const assignedUser = await getNextAssignedSalesperson();
    const assignedToId = assignedUser ? assignedUser.id : null;
    if (assignedUser) {
        noteLines.push(`Auto-assigned to: ${assignedUser.name}`);
    }

    // 7. Insert lead
    const insertResult = await pool.query(
        `INSERT INTO leads (
            first_name,
            last_name,
            email,
            phone,
            whatsapp,
            company,
            website,
            designation,
            amount,
            source_id,
            status,
            assigned_to,
            meta_leadgen_id,
            notes
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'NEW', $11, $12, $13)
        RETURNING *`,
        [
            parsed.first_name,
            parsed.last_name || null,
            parsed.email || null,
            parsed.phone || null,
            parsed.whatsapp || null,
            parsed.company || null,
            "No",
            parsed.designation || null,
            0,
            sourceId,
            assignedToId,
            leadgenId ? String(leadgenId) : null,
            noteLines.join("\n")
        ]
    );

    const newLead = insertResult.rows[0];

    // 8. Team notifications & activity log
    await notifyTeamOfNewLead(newLead, "Instagram Ad", assignedUser);
    await logLeadActivity(newLead, "Instagram Ad", noteLines.join("\n"), assignedUser);

    return newLead;
};

// --------------------------------------------------------------------------
// ROUTES
// --------------------------------------------------------------------------

/**
 * 1. Meta Webhook Verification (Handshake)
 * Meta calls GET /api/webhooks/meta?hub.mode=subscribe&hub.challenge=...&hub.verify_token=...
 */
router.get("/meta", (req, res) => {
    const mode = req.query["hub.mode"];
    const token = req.query["hub.verify_token"];
    const challenge = req.query["hub.challenge"];

    if (mode === "subscribe" && token === VERIFY_TOKEN) {
        console.log("Meta webhook successfully verified with challenge:", challenge);
        return res.status(200).send(challenge);
    }

    console.warn("Meta webhook verification failed: Invalid verify token or mode");
    return res.status(403).send("Verification token mismatch");
});

/**
 * 2. Meta Webhook Event Receiver
 * Meta posts instant form lead submissions here.
 */
router.post("/meta", async (req, res) => {
    try {
        // Immediate acknowledgement as required by Meta (under 5s)
        res.status(200).send("EVENT_RECEIVED");

        // Signature check
        if (!verifyMetaSignature(req)) {
            console.error("Meta webhook signature verification failed");
            return;
        }

        const body = req.body || {};

        // Handle direct sample from Meta Developer test modal: { sample: { field: "leadgen", value: { ... } } }
        if (body.sample && body.sample.field === "leadgen") {
            const value = body.sample.value || {};
            console.log("Processing Meta test sample event:", value.leadgen_id);
            await processLeadgenEvent({
                leadgenId: value.leadgen_id,
                formId: value.form_id,
                adId: value.ad_id,
                pageId: value.page_id,
                adgroupId: value.adgroup_id
            });
            return;
        }

        // Standard live Meta webhook payload: { object: "page", entry: [ { changes: [ ... ] } ] }
        if (body.object === "page" || Array.isArray(body.entry)) {
            for (const entry of body.entry || []) {
                for (const change of entry.changes || []) {
                    if (change.field === "leadgen") {
                        const value = change.value || {};
                        console.log("Processing Meta leadgen event:", value.leadgen_id);

                        await processLeadgenEvent({
                            leadgenId: value.leadgen_id,
                            formId: value.form_id,
                            adId: value.ad_id,
                            pageId: value.page_id,
                            adgroupId: value.adgroup_id
                        });
                    }
                }
            }
        }
    } catch (error) {
        console.error("Error processing Meta webhook event:", error);
    }
});

/**
 * 3. Status & Configuration Inspector
 * Used by CRM frontend to check webhook configuration status.
 */
router.get("/meta/status", async (req, res) => {
    try {
        const hasToken = Boolean(process.env.META_PAGE_ACCESS_TOKEN && process.env.META_PAGE_ACCESS_TOKEN.trim());
        const hasSecret = Boolean(process.env.META_APP_SECRET && process.env.META_APP_SECRET.trim());

        res.status(200).json({
            success: true,
            data: {
                webhookPath: "/api/webhooks/meta",
                verifyToken: VERIFY_TOKEN,
                pageAccessTokenConfigured: hasToken,
                appSecretConfigured: hasSecret,
                defaultSource: DEFAULT_SOURCE_NAME
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

/**
 * 4. Lead Simulation Endpoint
 * Allows testing the entire Instagram / Meta Ad lead capture flow right from the CRM UI.
 */
router.post("/meta/simulate", async (req, res) => {
    try {
        await ensureLeadExtraColumns();

        const {
            first_name = "Priya",
            last_name = "Sharma",
            email = "priya.sharma@example.com",
            phone = "+91 98765 43210",
            company = "Sharma Tech Solutions",
            designation = "Founder & CEO",
            ad_campaign = "Instagram Summer Growth Ad",
            custom_note = "Interested in CRM enterprise plan for 15 sales reps."
        } = req.body || {};

        const sourceId = await getOrCreateMetaLeadSource(DEFAULT_SOURCE_NAME);
        const simulatedLeadgenId = `sim_${Date.now()}`;

        // Auto-assign to salesperson (round-robin)
        const assignedUser = await getNextAssignedSalesperson();
        const assignedToId = assignedUser ? assignedUser.id : null;

        const noteLines = [
            `Captured from Instagram Ad Instant Form`,
            `Campaign: ${ad_campaign}`,
            `Leadgen ID: ${simulatedLeadgenId}`,
            assignedUser ? `Auto-assigned to: ${assignedUser.name}` : null,
            custom_note ? `Notes: ${custom_note}` : null
        ].filter(Boolean);

        const insertResult = await pool.query(
            `INSERT INTO leads (
                first_name,
                last_name,
                email,
                phone,
                whatsapp,
                company,
                website,
                designation,
                amount,
                source_id,
                status,
                assigned_to,
                meta_leadgen_id,
                notes
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'NEW', $11, $12, $13)
            RETURNING *`,
            [
                first_name.trim(),
                last_name?.trim() || null,
                email?.trim().toLowerCase() || null,
                phone?.trim() || null,
                phone?.trim() || null,
                company?.trim() || null,
                "No",
                designation?.trim() || null,
                0,
                sourceId,
                assignedToId,
                simulatedLeadgenId,
                noteLines.join("\n")
            ]
        );

        const newLead = insertResult.rows[0];

        await notifyTeamOfNewLead(newLead, "Instagram Ad", assignedUser);
        await logLeadActivity(newLead, "Instagram Ad", noteLines.join("\n"), assignedUser);

        return res.status(201).json({
            success: true,
            message: `Simulated Instagram Ad Lead added to CRM (Assigned to: ${assignedUser?.name || 'Unassigned'})`,
            data: {
                lead: newLead
            }
        });
    } catch (error) {
        console.error("Lead simulation error:", error);
        return res.status(500).json({
            success: false,
            message: error.message || "Failed to simulate lead"
        });
    }
});

/**
 * 5. Public External Lead Capture (Landing Page / Web Form)
 * For Instagram Ads directing users to external landing page forms.
 */
router.post("/meta/capture", async (req, res) => {
    try {
        await ensureLeadExtraColumns();

        const {
            first_name,
            last_name,
            email,
            phone,
            company,
            notes,
            source = DEFAULT_SOURCE_NAME
        } = req.body || {};

        if (!first_name || (!email && !phone)) {
            return res.status(400).json({
                success: false,
                message: "First name and at least one contact method (email or phone) are required"
            });
        }

        const sourceId = await getOrCreateMetaLeadSource(source);

        // Auto-assign to salesperson (round-robin)
        const assignedUser = await getNextAssignedSalesperson();
        const assignedToId = assignedUser ? assignedUser.id : null;

        const insertResult = await pool.query(
            `INSERT INTO leads (
                first_name,
                last_name,
                email,
                phone,
                company,
                website,
                amount,
                source_id,
                status,
                assigned_to,
                notes
            )
            VALUES ($1, $2, $3, $4, $5, 'No', 0, $6, 'NEW', $7, $8)
            RETURNING *`,
            [
                first_name.trim(),
                last_name?.trim() || null,
                email?.trim().toLowerCase() || null,
                phone?.trim() || null,
                company?.trim() || null,
                sourceId,
                assignedToId,
                notes?.trim() || `Captured via external web form (${source})`
            ]
        );

        const newLead = insertResult.rows[0];

        await notifyTeamOfNewLead(newLead, source, assignedUser);
        await logLeadActivity(newLead, source, notes || "Web form submission", assignedUser);

        return res.status(201).json({
            success: true,
            message: `Lead captured successfully (Assigned to: ${assignedUser?.name || 'Unassigned'})`,
            data: { lead: newLead }
        });
    } catch (error) {
        console.error("External lead capture error:", error);
        return res.status(500).json({
            success: false,
            message: "Internal server error"
        });
    }
});

module.exports = router;