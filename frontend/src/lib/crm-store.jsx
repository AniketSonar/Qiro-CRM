import { useEffect, useMemo, useState } from "react";
import { api } from "./api";
import * as demo from "./crm-data";

/* ---------- helpers ---------- */

const num = (v) => (v === null || v === undefined || v === "" ? 0 : Number(v));

const titleCase = (v) =>
  String(v ?? "")
    .toLowerCase()
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());

const fullName = (first, last) => [first, last].filter(Boolean).join(" ").trim();

const relative = (iso) => {
  if (!iso) return "—";
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "—";
  const mins = Math.round((Date.now() - then) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.round(hrs / 24);
  if (days === 1) return "Yesterday";
  if (days < 30) return `${days}d ago`;
  return new Date(iso).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
};

const dateLabel = (iso) =>
  iso
    ? new Date(iso).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })
    : "—";

const dateTimeLabel = (iso) =>
  iso
    ? new Date(iso).toLocaleString("en-IN", {
        day: "2-digit",
        month: "short",
        hour: "2-digit",
        minute: "2-digit"
      })
    : "—";

/* ---------- refresh bus: any mutation refetches every list ---------- */

let version = 0;
const subscribers = new Set();
const requestCache = new Map();
const inflight = new Map();

function fetchCached(path) {
  if (requestCache.has(path)) return Promise.resolve(requestCache.get(path));
  if (inflight.has(path)) return inflight.get(path);

  const request = api
    .get(path)
    .then((res) => {
      requestCache.set(path, res);
      inflight.delete(path);
      return res;
    })
    .catch((error) => {
      inflight.delete(path);
      throw error;
    });

  inflight.set(path, request);
  return request;
}

/** Call after any create/update/delete so every open list refetches. */
export function invalidate() {
  version += 1;
  requestCache.clear();
  subscribers.forEach((fn) => fn(version));
}

/** Fetches on mount and after any mutation; demo rows only if the call fails. */
function useApi(path, mapper, fallback) {
  const [state, setState] = useState({ data: [], loading: true, error: null, live: false });
  const [v, setV] = useState(version);

  useEffect(() => {
    const fn = (n) => setV(n);
    subscribers.add(fn);
    return () => subscribers.delete(fn);
  }, []);

  useEffect(() => {
    let alive = true;
    setState((prev) => ({ ...prev, loading: true }));
    fetchCached(path)
      .then((res) => {
        if (!alive) return;
        setState({ data: mapper(res), loading: false, error: null, live: true });
      })
      .catch((error) => {
        if (!alive) return;
        console.warn(`[crm] ${path} failed: ${error.message} — showing demo rows`);
        setState({ data: fallback, loading: false, error, live: false });
      });
    return () => {
      alive = false;
    };
  }, [path, v]);

  return { ...state, refresh: invalidate };
}

/* ---------- mappers ---------- */

const STAGE_FROM_STATUS = {
  NEW: "New",
  CONTACTED: "Contacted",
  QUALIFIED: "Qualified",
  PROPOSAL: "Proposal",
  NEGOTIATION: "Negotiation",
  CONVERTED: "Deal done",
  WON: "Deal done",
  LOST: "Lost"
};

const mapLeads = (res) =>
  (res?.data?.leads ?? []).map((l) => ({
    id: l.id,
    name: fullName(l.first_name, l.last_name) || l.email || `Lead ${l.id}`,
    company: l.company || "—",
    city: l.designation || l.city || "—",
    email: l.email || "—",
    phone: l.phone || "—",
    stage: STAGE_FROM_STATUS[l.status] ?? titleCase(l.status) ?? "New",
    value: num(l.amount ?? l.value),
    source: l.source || "Direct",
    owner: l.assigned_user || "Unassigned",
    score: l.score == null ? null : Number(l.score),
    updatedAt: l.updated_at || l.created_at || null,
    updated: relative(l.updated_at || l.created_at),
    raw: l
  }));

const DEAL_STAGE = {
  QUALIFIED: "Qualified",
  DEMO: "Demo",
  PROPOSAL: "Proposal",
  NEGOTIATION: "Negotiation",
  CLOSED_WON: "Deal done",
  CLOSED_LOST: "Lost"
};

const mapDeals = (res) =>
  (res?.data?.deals ?? []).map((d) => ({
    id: `D-${d.id}`,
    title: d.title || "Untitled deal",
    customer:
      fullName(d.lead_first_name, d.lead_last_name) ||
      fullName(d.contact_first_name, d.contact_last_name) ||
      "—",
    value: num(d.amount),
    stage: DEAL_STAGE[d.stage] ?? titleCase(d.stage),
    probability: Number(d.probability ?? 0),
    close: dateLabel(d.actual_close_date || d.expected_close_date),
    owner: d.assigned_user || "Unassigned",
    raw: d
  }));

const mapCustomers = (res) =>
  (res?.data?.customers ?? []).map((c) => ({
    id: c.id,
    company: c.deal_title || fullName(c.lead_first_name, c.lead_last_name) || c.customer_code,
    contact:
      fullName(c.lead_first_name, c.lead_last_name) ||
      fullName(c.contact_first_name, c.contact_last_name) ||
      "—",
    industry: titleCase(c.customer_type) || "—",
    since: dateLabel(c.converted_at || c.created_at),
    lifetime: num(c.deal_amount),
    health: c.status === "ACTIVE" ? "Healthy" : titleCase(c.status),
    owner: c.assigned_user || "Unassigned",
    raw: c
  }));

const mapContacts = (res) =>
  (res?.data?.contacts ?? []).map((c) => ({
    id: c.id,
    name: fullName(c.first_name, c.last_name) || c.email,
    title: c.designation || "—",
    company: c.company || "—",
    email: c.email || "—",
    phone: c.phone || "—",
    type: [c.city, c.state].filter(Boolean).join(", ") || "Contact",
    raw: c
  }));

const FU_STATUS = {
  PENDING: "Upcoming",
  SCHEDULED: "Upcoming",
  COMPLETED: "Done",
  CANCELLED: "Cancelled"
};

const mapFollowUps = (res) =>
  (res?.data?.followUps ?? []).map((f) => {
    const scheduled = f.scheduled_at ? new Date(f.scheduled_at) : null;
    const isPast = scheduled ? scheduled.getTime() < Date.now() : false;
    const isToday =
      scheduled && scheduled.toDateString() === new Date().toDateString() ? true : false;
    let status = FU_STATUS[f.status] ?? titleCase(f.status);
    if (f.status !== "COMPLETED" && f.status !== "CANCELLED") {
      status = isToday ? "Today" : isPast ? "Overdue" : "Upcoming";
    }
    return {
      id: f.id,
      leadId: f.lead_id,
      lead:
        fullName(f.lead_first_name, f.lead_last_name) ||
        fullName(f.contact_first_name, f.contact_last_name) ||
        "—",
      company: f.outcome_name || titleCase(f.outcome) || "—",
      channel: titleCase(f.follow_up_type) || "Task",
      outcome: f.outcome_name || titleCase(f.outcome) || "—",
      due: dateTimeLabel(f.scheduled_at),
      status,
      owner: f.assigned_user || "Unassigned",
      note: f.notes || "No notes yet",
      raw: f
    };
  });

const mapActivities = (res) =>
  (res?.data ?? []).map((a) => ({
    id: a.id,
    type: titleCase(a.activity_type),
    actor: a.performed_by_name || "System",
    subject:
      fullName(a.lead_first_name, a.lead_last_name) ||
      fullName(a.contact_first_name, a.contact_last_name) ||
      a.subject ||
      "—",
    detail: a.description || a.subject || "—",
    when: relative(a.activity_at || a.created_at),
    raw: a
  }));

const mapUsers = (res) =>
  (res?.data?.users ?? []).map((u) => ({
    id: u.id,
    name: u.name,
    email: u.email,
    role: titleCase(u.role),
    status: titleCase(u.status),
    lastSeen: relative(u.updated_at || u.created_at),
    raw: u
  }));

const mapSales = (res) =>
  (res?.data?.sales ?? []).map((s) => ({
    id: s.invoice_number || `INV-${s.id}`,
    customer: s.deal_title || s.customer_code || "—",
    amount: num(s.final_amount ?? s.sale_amount),
    date: dateLabel(s.sale_date || s.created_at),
    status: titleCase(s.payment_status),
    owner: s.assigned_user || "Unassigned",
    raw: s
  }));

const mapNotifications = (res) =>
  (res?.data ?? []).map((n) => ({
    id: n.id,
    title: n.title || titleCase(n.type) || "Notification",
    body: n.message || n.body || "—",
    when: relative(n.created_at),
    unread: !(n.is_read ?? n.read),
    raw: n
  }));

/* ---------- resource hooks ---------- */

export const useLeads = () => useApi("/leads?limit=100", mapLeads, demo.leads);
export const useDeals = () => useApi("/deals?limit=100", mapDeals, demo.deals);
export const useCustomers = () => useApi("/customers?limit=100", mapCustomers, demo.customers);
export const useContacts = () => useApi("/contacts?limit=100", mapContacts, demo.contacts);
export const useFollowUps = () => useApi("/follow-ups?limit=100", mapFollowUps, demo.followUps);
export const useActivities = () => useApi("/activities", mapActivities, demo.activities);
export const useUsers = () => useApi("/users?limit=100", mapUsers, demo.users);
export const useSales = () => useApi("/sales?limit=100", mapSales, demo.salesRows);
export const useNotifications = () =>
  useApi("/notifications", mapNotifications, demo.notifications);

/* ---------- derived views ---------- */

const inr = (n) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0
  }).format(n);

export function useDashboard() {
  const leads = useLeads();
  const deals = useDeals();
  const followUps = useFollowUps();

  return useMemo(() => {
    const leadRows = leads.data;
    const dealRows = deals.data;
    const fuRows = followUps.data;

    const open = dealRows.filter((d) => d.stage !== "Deal done" && d.stage !== "Lost");
    const won = dealRows.filter((d) => d.stage === "Deal done");
    const openValue = open.reduce((s, d) => s + d.value, 0);
    const wonValue = won.reduce((s, d) => s + d.value, 0);
    const overdue = fuRows.filter((f) => f.status === "Overdue").length;
    const activeLeads = leadRows.filter((l) => l.stage !== "Deal done" && l.stage !== "Lost").length;
    const unassigned = leadRows.filter((l) => l.owner === "Unassigned").length;

    const kpis = [
      {
        label: "Open pipeline",
        value: inr(openValue),
        delta: `${open.length} deals`,
        trend: "up",
        hint: "weighted across stages"
      },
      {
        label: "Deal done revenue",
        value: inr(wonValue),
        delta: `${won.length} closed`,
        trend: "up",
        hint: "all completed deals"
      },
      {
        label: "Active leads",
        value: String(activeLeads),
        delta: `${unassigned} unassigned`,
        trend: "up",
        hint: `${leadRows.length} total leads`
      },
      {
        label: "Overdue follow-ups",
        value: String(overdue),
        delta: `${fuRows.length} scheduled`,
        trend: overdue > 0 ? "down" : "up",
        hint: "needs attention today"
      }
    ];

    const bySource = new Map();
    leadRows.forEach((l) => bySource.set(l.source, (bySource.get(l.source) ?? 0) + 1));
    const sourceSplit = [...bySource.entries()]
      .map(([source, value]) => ({ source, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 6);

    const stageOrder = ["New", "Contacted", "Qualified", "Proposal", "Negotiation"];
    const stageFunnel = stageOrder.map((stage) => {
      const rows = leadRows.filter((l) => l.stage === stage);
      const dealRowsForStage = dealRows.filter((d) => d.stage === stage);
      return {
        stage,
        count: rows.length || dealRowsForStage.length,
        value: dealRowsForStage.reduce((s, d) => s + d.value, 0)
      };
    });

    const monthKey = (label) => label;
    const trend = new Map();
    dealRows.forEach((d) => {
      const parsed = new Date(d.close);
      const label = Number.isNaN(parsed.getTime())
        ? "—"
        : parsed.toLocaleDateString("en-IN", { month: "short" });
      const row = trend.get(monthKey(label)) ?? { month: label, won: 0, pipeline: 0 };
      const lakhs = d.value / 1e5;
      if (d.stage === "Deal done") row.won += lakhs;
      else row.pipeline += lakhs;
      trend.set(monthKey(label), row);
    });
    const revenueTrend = [...trend.values()].filter((r) => r.month !== "—");

    const repMap = new Map();
    dealRows.forEach((d) => {
      const row = repMap.get(d.owner) ?? { rep: d.owner, won: 0, target: 0 };
      if (d.stage === "Deal done") row.won += d.value / 1e5;
      row.target += d.value / 1e5;
      repMap.set(d.owner, row);
    });
    const repPerformance = [...repMap.values()].sort((a, b) => b.won - a.won).slice(0, 6);

    return {
      loading: leads.loading || deals.loading || followUps.loading,
      live: leads.live || deals.live || followUps.live,
      leads: leadRows,
      deals: dealRows,
      followUps: fuRows,
      kpis,
      sourceSplit,
      stageFunnel,
      revenueTrend,
      repPerformance
    };
  }, [leads, deals, followUps]);
}

export function usePipeline() {
  const leads = useLeads();
  return useMemo(() => {
    const stages = ["New", "Contacted", "Qualified", "Proposal", "Negotiation", "Deal done"];
    return {
      loading: leads.loading,
      live: leads.live,
      leads: leads.data,
      pipelineStages: stages.map((stage) => ({
        stage,
        leadIds: leads.data
          .filter((l) => l.stage === stage || (stage === "Deal done" && l.stage === "Deal done"))
          .map((l) => l.id)
      }))
    };
  }, [leads]);
}

export function useAgenda() {
  const followUps = useFollowUps();
  return useMemo(() => {
    const tones = ["primary", "info", "warning", "muted"];
    const agenda = followUps.data
      .filter((f) => f.status === "Today" || f.status === "Upcoming" || f.status === "Overdue")
      .slice(0, 8)
      .map((f, i) => ({
        time: (f.due.split(", ")[1] ?? f.due).slice(0, 5),
        title: `${f.channel} — ${f.lead}`,
        meta: f.note,
        tone: tones[i % tones.length]
      }));
    return {
      loading: followUps.loading,
      live: followUps.live,
      followUps: followUps.data,
      agenda
    };
  }, [followUps]);
}

/* ---------- lookups for form selects ---------- */

const LOOKUPS = [
  ["users", "/users?limit=200", (r) => r?.data?.users ?? []],
  ["roles", "/users/roles", (r) => r?.data?.roles ?? []],
  ["sources", "/lead-sources?limit=200", (r) => r?.data?.leadSources ?? r?.data?.sources ?? r?.data ?? []],
  ["leadRows", "/leads?limit=200", (r) => r?.data?.leads ?? []],
  ["contactRows", "/contacts?limit=200", (r) => r?.data?.contacts ?? []],
  ["dealRows", "/deals?limit=200", (r) => r?.data?.deals ?? []],
  ["customerRows", "/customers?limit=200", (r) => r?.data?.customers ?? []],
  ["outcomes", "/follow-up-outcomes?limit=200", (r) => r?.data?.outcomes ?? r?.data ?? []]
];

/** Reference data used by the create/edit forms. Never throws. */
export function useLookups() {
  const [state, setState] = useState({
    users: [],
    roles: [],
    sources: [],
    leadRows: [],
    contactRows: [],
    dealRows: [],
    customerRows: [],
    outcomes: [],
    loading: true
  });
  const [v, setV] = useState(version);

  useEffect(() => {
    const fn = (n) => setV(n);
    subscribers.add(fn);
    return () => subscribers.delete(fn);
  }, []);

  useEffect(() => {
    let alive = true;
    Promise.all(
      LOOKUPS.map(([key, path, pick]) =>
        fetchCached(path)
          .then((res) => [key, pick(res)])
          .catch(() => [key, []])
      )
    ).then((entries) => {
      if (!alive) return;
      const next = { loading: false };
      entries.forEach(([key, rows]) => {
        next[key] = Array.isArray(rows) ? rows : [];
      });
      setState((prev) => ({ ...prev, ...next }));
    });
    return () => {
      alive = false;
    };
  }, [v]);

  return state;
}

/* ---------- single-lead detail hooks ---------- */

function useRaw(path, pick, empty) {
  const [state, setState] = useState({ data: empty, loading: true, error: null });
  const [v, setV] = useState(version);

  useEffect(() => {
    const fn = (n) => setV(n);
    subscribers.add(fn);
    return () => subscribers.delete(fn);
  }, []);

  useEffect(() => {
    if (!path) return undefined;
    let alive = true;
    setState((prev) => ({ ...prev, loading: true }));
    fetchCached(path)
      .then((res) => alive && setState({ data: pick(res), loading: false, error: null }))
      .catch((error) => alive && setState({ data: empty, loading: false, error }));
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path, v]);

  return state;
}

export const useLeadRecord = (id) =>
  useRaw(id ? `/leads/${id}` : null, (r) => r?.data?.lead ?? null, null);

export const useLeadFollowUps = (id) =>
  useRaw(
    id ? `/follow-ups?lead_id=${id}&limit=100` : null,
    (r) => r?.data?.followUps ?? [],
    []
  );

export const useLeadDeals = (id) =>
  useRaw(id ? `/deals?lead_id=${id}&limit=100` : null, (r) => r?.data?.deals ?? [], []);

export const personLabel = (row) =>
  [row?.first_name, row?.last_name].filter(Boolean).join(" ").trim() ||
  row?.email ||
  row?.company ||
  `#${row?.id}`;

/* ---------- mutations ---------- */

const run = (promise) =>
  promise.then((res) => {
    invalidate();
    return res;
  });

export const crud = {
  leads: {
    create: (body) => run(api.post("/leads", body)),
    update: (id, body) => run(api.put(`/leads/${id}`, body)),
    remove: (id) => run(api.del(`/leads/${id}`)),
    setStatus: (id, status) => run(api.patch(`/leads/${id}/status`, { status })),
    assign: (id, assigned_to) => run(api.patch(`/leads/${id}/assign`, { assigned_to }))
  },
  deals: {
    create: (body) => run(api.post("/deals", body)),
    update: (id, body) => run(api.put(`/deals/${id}`, body)),
    setStage: (id, stage, extra) => run(api.put(`/deals/${id}`, { stage, ...(extra ?? {}) })),
    remove: (id) => run(api.del(`/deals/${id}`))
  },
  contacts: {
    create: (body) => run(api.post("/contacts", body)),
    update: (id, body) => run(api.put(`/contacts/${id}`, body)),
    remove: (id) => run(api.del(`/contacts/${id}`)),
    assign: (id, owner_id) => run(api.patch(`/contacts/${id}/assign`, { owner_id }))
  },
  followUps: {
    create: (body) => run(api.post("/follow-ups", body)),
    update: (id, body) => run(api.put(`/follow-ups/${id}`, body)),
    complete: (id, body) => run(api.patch(`/follow-ups/${id}/complete`, body)),
    cancel: (id, body) => run(api.patch(`/follow-ups/${id}/cancel`, body ?? {}))
  },
  activities: {
    create: (body) => run(api.post("/activities", body)),
    update: (id, body) => run(api.put(`/activities/${id}`, body)),
    remove: (id) => run(api.del(`/activities/${id}`))
  },
  customers: {
    convert: (dealId, body) => run(api.post(`/customers/convert/${dealId}`, body ?? {})),
    update: (id, body) => run(api.put(`/customers/${id}`, body))
  },
  sales: {
    create: (body) => run(api.post("/sales", body)),
    update: (id, body) => run(api.put(`/sales/${id}`, body))
  },
  users: {
    create: (body) => run(api.post("/users", body)),
    update: (id, body) => run(api.put(`/users/${id}`, body)),
    setStatus: (id, status) => run(api.patch(`/users/${id}/status`, { status })),
    setRole: (id, role) => run(api.patch(`/users/${id}/role`, { role })),
    remove: (id) => run(api.del(`/users/${id}`))
  },
  notifications: {
    markRead: (id) => run(api.put(`/notifications/${id}/read`)),
    markAllRead: () => run(api.put("/notifications/read-all")),
    remove: (id) => run(api.del(`/notifications/${id}`))
  }
};

export { relative, dateLabel, dateTimeLabel, titleCase };
