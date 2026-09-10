const LEAD_STAGE_RANK = {
    NEW: 0,
    CONTACTED: 1,
    QUALIFIED: 2,
    PROPOSAL: 3,
    NEGOTIATION: 4,
    CONVERTED: 5,
    LOST: 6
};

const DEAL_TO_LEAD_STATUS = {
    QUALIFIED: "QUALIFIED",
    DEMO: "QUALIFIED",
    PROPOSAL: "PROPOSAL",
    NEGOTIATION: "NEGOTIATION",
    CLOSED_WON: "CONVERTED",
    CLOSED_LOST: "LOST"
};

const advanceLeadStage = async (pool, leadId, targetStatus) => {
    if (!leadId || !targetStatus) return;

    const target = targetStatus.toUpperCase();
    const targetRank = LEAD_STAGE_RANK[target];
    if (targetRank === undefined) return;

    await pool.query(
        `UPDATE leads
         SET status = $1,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $2
         AND status <> 'LOST'
         AND status <> 'CONVERTED'
         AND CASE UPPER(status)
             WHEN 'NEW' THEN 0
             WHEN 'CONTACTED' THEN 1
             WHEN 'QUALIFIED' THEN 2
             WHEN 'PROPOSAL' THEN 3
             WHEN 'NEGOTIATION' THEN 4
             ELSE 0
         END < $3`,
        [target, leadId, targetRank]
    );
};

const setLeadLost = async (pool, leadId) => {
    if (!leadId) return;

    await pool.query(
        `UPDATE leads
         SET status = 'LOST',
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $1
         AND status NOT IN ('CONVERTED', 'LOST')`,
        [leadId]
    );
};

module.exports = { advanceLeadStage, setLeadLost, DEAL_TO_LEAD_STATUS };