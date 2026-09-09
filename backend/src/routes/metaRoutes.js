const express = require("express");
const crypto = require("crypto");
const pool = require("../config/db");

const router = express.Router();

const VERIFY_TOKEN = process.env.META_VERIFY_TOKEN || "qiro_meta_leadgen_verify_token_2026";

// Known default platform sources in lead_sources table
const PLATFORM_SOURCES = {
    INSTAGRAM: "Instagram",
    FACEBOOK: "Facebook",
    LINKEDIN: "LinkedIn"
};

/**
 * Resolves the source_id from lead_sources table for a given platform name.
 * Falls back to case-insensitive match or inserts if missing.
 */
const getPlatformSourceId = async (platformName = "Instagram") => {
    try {
        const clean = (platformName || "Instagram").trim();
        const existing = await pool.query(
            `SELECT id FROM lead_sources WHERE LOWER(name) = LOWER($1) LIMIT 1`,
            [clean]
        );
        if (existing.rows.length > 0) {
            return existing.rows[0].id;
        }

        // Try fuzzy match
        const fuzzy = await pool.query(
            `SELECT id FROM lead_sources WHERE LOWER(name) LIKE LOWER($1) LIMIT 1`,
            [`%${clean}%`]
        );
        if (fuzzy.rows.length > 0) {
            return fuzzy.rows[0].id;
        }

        // Insert new source if not present
        const created = await pool.query(
            `INSERT INTO lead_sources (name, description, is_active)
             VALUES ($1, $2, true)
             RETURNING id`,
            [clean, `Automated leads captured from ${clean} Ads`]
        );
        return created.rows[0].id;
    } catch (err) {
        console.error("Error resolving lead source ID:", err.message);
        return null;
    }
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

        // Fallback to active sales manager if no sales person is available
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
 * Dispatches in-app notifications to active sales reps and managers when a new lead arrives.
 */
const notifyTeamOfNewLead = async (lead, platform = "Instagram", assignedUser = null) => {
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
        const title = `🎯 New ${platform} Lead: ${leadName}`;
        const message = `${leadName}${companyPart} just submitted an ad form on ${platform}${assignmentPart}. Review their details and follow up.`;

        for (const u of users.rows) {
            await pool.query(
                `INSERT INTO notifications (user_id, title, message, notification_type, related_id, related_type)
                 VALUES ($1, $2, $3, 'LEAD_CREATED', $4, 'LEADS')`,
                [u.id, title, message, lead.id]
            );
        }

        // Direct notification to assigned salesperson if not already in the initial batch
        if (assignedUser && !users.rows.some(u => u.id === assignedUser.id)) {
            await pool.query(
                `INSERT INTO notifications (user_id, title, message, notification_type, related_id, related_type)
                 VALUES ($1, $2, $3, 'LEAD_CREATED', $4, 'LEADS')`,
                [
                    assignedUser.id,
                    `🎯 New ${platform} Lead Assigned: ${leadName}`,
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
const logLeadActivity = async (lead, platform = "Instagram", details = "", assignedUser = null) => {
    try {
        const assignmentNote = assignedUser ? ` • Automatically assigned to ${assignedUser.name}.` : "";
        await pool.query(
            `INSERT INTO activities (lead_id, activity_type, subject, description, activity_at)
             VALUES ($1, 'NOTE', $2, $3, CURRENT_TIMESTAMP)`,
            [
                lead.id,
                `Captured via ${platform} Ad`,
                (details || `Lead automatically captured from ${platform} Lead Ad form.`) + assignmentNote
            ]
        );
    } catch (err) {
        console.warn("Failed to log activity for lead:", err.message);
    }
};

/**
 * Validates Meta HMAC SHA256 signature if META_APP_SECRET is set.
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
        console.error("Meta signature verification error:", err);
        return false;
    }
};

/**
 * Parses Meta field_data array into normalized lead fields.
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
        } else if (name === "job_title" || name === "designation" || name === "title") {
            fields.designation = String(value).trim();
        } else if (name === "city") {
            fields.city = String(value).trim();
        } else if (name === "whatsapp" || name === "whatsapp_number") {
            fields.whatsapp = String(value).replace(/^p:/i, "").trim();
        } else {
            customQuestions.push(`${item.name}: ${value}`);
        }
    }

    if (!fields.first_name && fields.full_name) {
        const parts = fields.full_name.split(/\s+/);
        fields.first_name = parts[0];
        fields.last_name = parts.slice(1).join(" ") || null;
    }

    if (!fields.first_name) {
        fields.first_name = fields.email ? fields.email.split("@")[0] : "Meta Lead";
    }

    fields.customQuestions = customQuestions;
    return fields;
};

/**
 * Core processor for Meta (Instagram / Facebook) leadgen events.
 */
const processMetaLeadgenEvent = async ({ leadgenId, formId, adId, pageId, adgroupId, directPayload = null }) => {
    // 1. Deduplication
    if (leadgenId) {
        const existing = await pool.query(
            `SELECT * FROM leads WHERE meta_leadgen_id = $1 LIMIT 1`,
            [String(leadgenId)]
        );
        if (existing.rows.length > 0) {
            console.log(`Lead with meta_leadgen_id ${leadgenId} already ingested, skipping.`);
            return { lead: existing.rows[0], platform: "Instagram", assignedUser: null };
        }
    }

    let fieldData = [];
    let platform = "Instagram"; // Default Meta Lead Ads platform preference
    let campaignName = null;
    let adName = null;

    // 2. Fetch from Meta Graph API if access token configured
    const pageAccessToken = process.env.META_PAGE_ACCESS_TOKEN;
    if (pageAccessToken && leadgenId) {
        try {
            const graphUrl = `https://graph.facebook.com/v20.0/${leadgenId}?access_token=${pageAccessToken}`;
            const response = await fetch(graphUrl);
            if (response.ok) {
                const leadJson = await response.json();
                fieldData = leadJson.field_data || [];
                
                // Detect whether lead came from Instagram or Facebook
                if (leadJson.platform === "ig" || /instagram/i.test(leadJson.platform || "")) {
                    platform = "Instagram";
                } else if (leadJson.platform === "fb" || /facebook/i.test(leadJson.platform || "")) {
                    platform = "Facebook";
                }

                campaignName = leadJson.campaign_name || null;
                adName = leadJson.ad_name || null;
            } else {
                console.error(`Meta Graph API returned status ${response.status}`);
            }
        } catch (fetchErr) {
            console.error("Failed to fetch lead details from Meta Graph API:", fetchErr.message);
        }
    }

    // 3. Fallback to direct payload if supplied
    if (directPayload) {
        if (directPayload.platform) {
            platform = /facebook/i.test(directPayload.platform) ? "Facebook" : "Instagram";
        }
        if (directPayload.field_data) {
            fieldData = directPayload.field_data;
        }
    }

    const parsed = parseMetaFieldData(fieldData);

    if (directPayload) {
        parsed.first_name = directPayload.first_name || parsed.first_name;
        parsed.last_name = directPayload.last_name || parsed.last_name;
        parsed.email = directPayload.email || parsed.email;
        parsed.phone = directPayload.phone || parsed.phone;
        parsed.company = directPayload.company || parsed.company;
        parsed.designation = directPayload.designation || parsed.designation;
    }

    // 4. Resolve source_id in DB ("Instagram" -> id: 4, "Facebook" -> id: 3)
    const sourceId = await getPlatformSourceId(platform);

    // 5. Notes
    const noteLines = [
        `Captured automatically from ${platform} Lead Ad`,
        formId ? `Form ID: ${formId}` : null,
        adId ? `Ad ID: ${adId}` : null,
        leadgenId ? `Meta Leadgen ID: ${leadgenId}` : null,
        campaignName ? `Campaign: ${campaignName}` : null,
        adName ? `Ad: ${adName}` : null,
        ...(parsed.customQuestions || [])
    ].filter(Boolean);

    // 6. Auto-assign round-robin to active salesperson
    const assignedUser = await getNextAssignedSalesperson();
    const assignedToId = assignedUser ? assignedUser.id : null;
    if (assignedUser) {
        noteLines.push(`Auto-assigned to: ${assignedUser.name}`);
    }

    // 7. Insert into leads table
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
            form_id,
            ad_id,
            campaign_name,
            ad_name,
            notes
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'NEW', $11, $12, $13, $14, $15, $16, $17)
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
            formId ? String(formId) : null,
            adId ? String(adId) : null,
            campaignName,
            adName,
            noteLines.join("\n")
        ]
    );

    const newLead = insertResult.rows[0];

    // 8. Notifications & activity log
    await notifyTeamOfNewLead(newLead, platform, assignedUser);
    await logLeadActivity(newLead, platform, noteLines.join("\n"), assignedUser);

    return { lead: newLead, platform, assignedUser };
};

/**
 * Core processor for LinkedIn Lead Gen Form events.
 */
const processLinkedInLeadEvent = async (data = {}) => {
    const leadId = data.lead_id || data.leadId || data.id || data.external_lead_id || null;

    // Deduplication
    if (leadId) {
        const existing = await pool.query(
            `SELECT * FROM leads WHERE external_lead_id = $1 LIMIT 1`,
            [String(leadId)]
        );
        if (existing.rows.length > 0) {
            console.log(`LinkedIn lead with ID ${leadId} already ingested, skipping.`);
            return { lead: existing.rows[0], platform: "LinkedIn", assignedUser: null };
        }
    }

    const firstName = data.first_name || data.firstName || (data.name ? data.name.split(" ")[0] : "LinkedIn Lead");
    const lastName = data.last_name || data.lastName || (data.name ? data.name.split(" ").slice(1).join(" ") : null);
    const email = data.email || null;
    const phone = data.phone || data.phone_number || null;
    const company = data.company || data.company_name || null;
    const designation = data.designation || data.job_title || data.title || null;
    const formName = data.form_name || data.formName || null;
    const campaignName = data.campaign_name || data.campaignName || null;

    // Resolve source_id for LinkedIn (id: 2)
    const sourceId = await getPlatformSourceId("LinkedIn");

    // Auto-assign round-robin to active salesperson
    const assignedUser = await getNextAssignedSalesperson();
    const assignedToId = assignedUser ? assignedUser.id : null;

    const noteLines = [
        "Captured automatically from LinkedIn Lead Gen Ad",
        formName ? `Form: ${formName}` : null,
        campaignName ? `Campaign: ${campaignName}` : null,
        leadId ? `LinkedIn Lead ID: ${leadId}` : null,
        assignedUser ? `Auto-assigned to: ${assignedUser.name}` : null
    ].filter(Boolean);

    const insertResult = await pool.query(
        `INSERT INTO leads (
            first_name,
            last_name,
            email,
            phone,
            company,
            website,
            designation,
            amount,
            source_id,
            status,
            assigned_to,
            external_lead_id,
            campaign_name,
            notes
        )
        VALUES ($1, $2, $3, $4, $5, 'No', $6, 0, $7, 'NEW', $8, $9, $10, $11)
        RETURNING *`,
        [
            firstName,
            lastName,
            email,
            phone,
            company,
            designation,
            sourceId,
            assignedToId,
            leadId ? String(leadId) : null,
            campaignName,
            noteLines.join("\n")
        ]
    );

    const newLead = insertResult.rows[0];

    await notifyTeamOfNewLead(newLead, "LinkedIn", assignedUser);
    await logLeadActivity(newLead, "LinkedIn", noteLines.join("\n"), assignedUser);

    return { lead: newLead, platform: "LinkedIn", assignedUser };
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
        console.log("Meta webhook verified successfully with challenge:", challenge);
        return res.status(200).send(challenge);
    }

    console.warn("Meta webhook verification failed: Invalid verify token or mode");
    return res.status(403).send("Verification token mismatch");
});

/**
 * 2. Meta Webhook Event Receiver (Instagram & Facebook Lead Ads)
 * Meta posts instant form lead submissions here automatically.
 */
router.post("/meta", async (req, res) => {
    try {
        // Immediate acknowledgement as required by Meta (within 5s)
        res.status(200).send("EVENT_RECEIVED");

        if (!verifyMetaSignature(req)) {
            console.error("Meta webhook signature verification failed");
            return;
        }

        const body = req.body || {};

        // Handle Meta Developer test tool sample format
        if (body.sample && body.sample.field === "leadgen") {
            const value = body.sample.value || {};
            await processMetaLeadgenEvent({
                leadgenId: value.leadgen_id,
                formId: value.form_id,
                adId: value.ad_id,
                pageId: value.page_id,
                adgroupId: value.adgroup_id
            });
            return;
        }

        // Live Meta webhook payload: { object: "page", entry: [ { changes: [ ... ] } ] }
        if (body.object === "page" || Array.isArray(body.entry)) {
            for (const entry of body.entry || []) {
                for (const change of entry.changes || []) {
                    if (change.field === "leadgen") {
                        const value = change.value || {};
                        await processMetaLeadgenEvent({
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
        console.error("Error handling Meta webhook:", error);
    }
});

/**
 * 3. LinkedIn Webhook Verification Handshake
 * LinkedIn calls GET /api/webhooks/linkedin with challengeCode
 */
router.get("/linkedin", (req, res) => {
    const challengeCode = req.query.challengeCode || req.query.challenge || req.query["hub.challenge"];
    if (challengeCode) {
        return res.status(200).json({ challengeCode });
    }
    return res.status(200).send("LinkedIn Webhook endpoint ready");
});

/**
 * 4. LinkedIn Lead Gen Webhook Receiver
 * Receives LinkedIn Lead Gen Form notifications or payloads.
 */
router.post("/linkedin", async (req, res) => {
    try {
        res.status(200).json({ success: true, message: "LinkedIn lead received" });

        const body = req.body || {};
        await processLinkedInLeadEvent(body);
    } catch (error) {
        console.error("Error processing LinkedIn lead webhook:", error);
    }
});

/**
 * 5. Universal Automated Lead Capture Endpoint
 * Accepts leads from Instagram, Facebook, or LinkedIn automatically.
 * POST /api/webhooks/lead or /api/webhooks/capture
 */
const handleUnifiedCapture = async (req, res) => {
    try {
        const body = req.body || {};
        const rawPlatform = String(body.platform || body.source || "Instagram").toLowerCase();

        let result;
        if (rawPlatform.includes("linkedin")) {
            result = await processLinkedInLeadEvent(body);
        } else {
            const platform = rawPlatform.includes("facebook") ? "Facebook" : "Instagram";
            result = await processMetaLeadgenEvent({
                leadgenId: body.leadgen_id || body.leadgenId || body.id || null,
                formId: body.form_id || body.formId || null,
                adId: body.ad_id || body.adId || null,
                directPayload: {
                    ...body,
                    platform
                }
            });
        }

        return res.status(201).json({
            success: true,
            message: `Lead successfully captured from ${result.platform} and assigned.`,
            data: {
                leadId: result.lead.id,
                name: `${result.lead.first_name} ${result.lead.last_name || ""}`.trim(),
                platform: result.platform,
                assignedTo: result.assignedUser ? result.assignedUser.name : "Unassigned"
            }
        });
    } catch (error) {
        console.error("Error in universal lead capture:", error);
        return res.status(500).json({ success: false, message: error.message });
    }
};

router.post("/capture", handleUnifiedCapture);
router.post("/lead", handleUnifiedCapture);
router.post("/leads", handleUnifiedCapture);

/**
 * 6. Status Endpoint for diagnostics
 */
router.get("/status", async (req, res) => {
    try {
        const salespersons = await pool.query(`
            SELECT u.id, u.name, COUNT(l.id) AS active_leads
            FROM users u
            JOIN roles r ON u.role_id = r.id
            LEFT JOIN leads l ON l.assigned_to = u.id AND l.status NOT IN ('LOST', 'CONVERTED')
            WHERE u.status = 'ACTIVE' AND r.name = 'SALES_PERSON'
            GROUP BY u.id, u.name
            ORDER BY active_leads ASC
        `);

        res.status(200).json({
            success: true,
            supportedPlatforms: ["Instagram", "Facebook", "LinkedIn"],
            endpoints: {
                metaWebhook: "/api/webhooks/meta",
                linkedinWebhook: "/api/webhooks/linkedin",
                universalCapture: "/api/webhooks/capture"
            },
            autoAssign: {
                strategy: "Round-robin / Least active leads",
                availableSalespersons: salespersons.rows
            },
            diagnostics: {
                hasPageAccessToken: !!process.env.META_PAGE_ACCESS_TOKEN,
                tokenPrefix: process.env.META_PAGE_ACCESS_TOKEN ? process.env.META_PAGE_ACCESS_TOKEN.substring(0, 10) + "..." : null
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

module.exports = router;
