import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, RefreshCw } from "lucide-react";
import { AppShell, GhostButton } from "../components/crm/AppShell";
import {
  Avatar,
  Chip,
  leadTemperature,
  leadTemperatureTone,
  stageTone
} from "../components/crm/ui-bits";
import { FilterPills, SearchField } from "../components/crm/form";
import { currency } from "../lib/crm-data";
import { crud, invalidate, useLookups, usePipeline } from "../lib/crm-store";
import { LeadForm } from "./Leads";
import { useAuth } from "../lib/auth";

const STATUS_OF_STAGE = {
  New: "NEW",
  Contacted: "CONTACTED",
  Qualified: "QUALIFIED",
  Proposal: "PROPOSAL",
  Negotiation: "NEGOTIATION",
  "Deal done": "CONVERTED"
};

const STAGES = Object.keys(STATUS_OF_STAGE);
const PIPELINE_FILTERS = ["All", ...STAGES];

const leadArrival = (lead) => {
  if (!lead.updatedAt) return lead.updated || "—";
  const timestamp = new Date(lead.updatedAt).getTime();
  if (Number.isNaN(timestamp)) return lead.updated || "—";

  const elapsedMinutes = Math.max(0, Math.floor((Date.now() - timestamp) / 60000));
  if (elapsedMinutes < 1) return "just now";
  if (elapsedMinutes < 60) return `${elapsedMinutes} min ago`;
  if (elapsedMinutes < 24 * 60) return `${Math.floor(elapsedMinutes / 60)}h ago`;
  return new Date(timestamp).toLocaleDateString("en-US", { month: "short", day: "numeric" });
};

export default function Pipeline() {
  const { leads, pipelineStages, loading } = usePipeline();
  const { users, sources } = useLookups();
  const { user } = useAuth();
  const [quick, setQuick] = useState(null);
  const [stageFilter, setStageFilter] = useState(PIPELINE_FILTERS[0]);
  const [query, setQuery] = useState("");
  const navigate = useNavigate();

  const visibleLeads = useMemo(() => {
    const q = query.trim().toLowerCase();
    return leads.filter((lead) =>
      (!q || [lead.name, lead.company, lead.email, lead.phone, lead.owner, lead.source, lead.stage]
        .join(" ")
        .toLowerCase()
        .includes(q)) &&
      (stageFilter === "All" || lead.stage === stageFilter)
    );
  }, [leads, query, stageFilter]);

  const assignable = users.filter((u) =>
    ["SALES_PERSON", "SALES_MANAGER"].includes(String(u.role).toUpperCase().replace(/\s+/g, "_"))
  );

  return (
    <AppShell
      title="Pipeline"
      subtitle={
        loading
          ? "Loading board…"
          : `${visibleLeads.length} opportunities across ${pipelineStages.length} stages`
      }
      actions={
        <>
          <GhostButton onClick={() => invalidate()}>
            <RefreshCw className="size-4" /> Refresh
          </GhostButton>
          <button
            onClick={() => setQuick("New")}
            className="brand-surface inline-flex h-10 items-center gap-2 rounded-xl px-4 text-sm font-semibold text-primary-foreground"
          >
            <Plus className="size-4" /> New lead
          </button>
        </>
      }
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <FilterPills options={PIPELINE_FILTERS} value={stageFilter} onChange={setStageFilter} />
        <SearchField
          value={query}
          onChange={setQuery}
          placeholder="Search pipeline…"
          className="w-full sm:ml-auto sm:w-72"
        />
      </div>

      <div className={stageFilter === "All" ? "flex gap-4 overflow-x-auto pb-4" : "pb-4"}>
        {pipelineStages
          .filter((col) => stageFilter === "All" || col.stage === stageFilter)
          .map((col) => {
          const cards = col.leadIds
            .map((id) => visibleLeads.find((l) => l.id === id))
            .filter(Boolean);
          const total = cards.reduce((sum, c) => sum + c.value, 0);

          return (
            <div key={col.stage} className={stageFilter === "All" ? "w-[280px] shrink-0" : "w-full"}>
              <div className="panel flex h-full flex-col bg-muted/40 p-3">
                <div className="flex items-center justify-between px-1 pb-3">
                  <div className="flex items-center gap-2">
                    <Chip tone={stageTone(col.stage)} dot>
                      {col.stage}
                    </Chip>
                    <span className="numeric text-xs font-bold text-muted-foreground">
                      {cards.length}
                    </span>
                  </div>
                  <span className="numeric text-xs font-semibold text-muted-foreground">
                    {currency(total)}
                  </span>
                </div>

                <button
                  onClick={() => setQuick(col.stage)}
                  className="mb-3 inline-flex h-9 w-full items-center justify-center gap-2 rounded-xl border border-dashed border-border text-xs font-semibold text-muted-foreground transition-colors hover:border-ring hover:text-foreground"
                >
                  <Plus className="size-4" /> Add card
                </button>

                <div
                  className={
                    stageFilter === "All"
                      ? "space-y-3"
                      : "grid grid-cols-1 items-start gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
                  }
                >
                  {cards.map((c) => (
                    <article
                      key={c.id}
                      role="link"
                      tabIndex={0}
                      onClick={() => navigate(`/leads/${c.id}`)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          navigate(`/leads/${c.id}`);
                        }
                      }}
                      className="panel group p-3 transition-transform hover:-translate-y-0.5 hover:shadow-float"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-bold leading-tight text-primary">{c.name}</p>
                          <p className="mt-1 truncate text-xs text-muted-foreground">{c.company || "—"}</p>
                        </div>
                        <div className="flex shrink-0 flex-col items-end gap-1">
                          <Chip tone={leadTemperatureTone(leadTemperature(c))} dot>
                            {leadTemperature(c)}
                          </Chip>
                        </div>
                      </div>
                      <div className="mt-2 flex items-center justify-between gap-2">
                        <p className="numeric text-base font-extrabold">{currency(c.value)}</p>
                        <span className="text-[11px] text-muted-foreground">{leadArrival(c)}</span>
                      </div>
                      <div className="mt-2 max-h-0 overflow-hidden opacity-0 transition-all duration-200 group-hover:max-h-96 group-hover:opacity-100 group-focus:max-h-96 group-focus:opacity-100">
                        <div className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2 border-t border-border pt-3 text-xs">
                          <div className="col-span-2 min-w-0">
                            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Email</p>
                            <p className="truncate font-medium">{c.email || "—"}</p>
                          </div>
                          <div>
                            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Phone</p>
                            <p className="font-medium">{c.phone || "—"}</p>
                          </div>
                          <div className="min-w-0">
                            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Company</p>
                            <p className="truncate font-medium">{c.company || "—"}</p>
                          </div>
                          <div>
                            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Amount</p>
                            <p className="numeric font-bold">{currency(c.value)}</p>
                          </div>
                          <div>
                            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Source</p>
                            <p className="truncate font-medium">{c.source || "—"}</p>
                          </div>
                          <div className="min-w-0">
                            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Assigned to</p>
                            <p className="truncate font-medium">{c.owner || "—"}</p>
                          </div>
                          <div>
                            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Stage</p>
                            <Chip tone={stageTone(c.stage)} dot>{c.stage}</Chip>
                          </div>
                        </div>
                      </div>
                    </article>
                  ))}
                </div>
              </div>
            </div>
          );
          })}
      </div>

      {!loading && (query || stageFilter !== "All") && visibleLeads.length === 0 && (
        <p className="py-8 text-center text-sm text-muted-foreground">No pipeline opportunities match these filters.</p>
      )}

      <LeadForm
        open={Boolean(quick)}
        mode="create"
        lead={null}
        users={assignable}
        sources={sources}
        currentUser={user}
        defaultStatus={STATUS_OF_STAGE[quick] ?? "NEW"}
        onClose={() => setQuick(null)}
      />
    </AppShell>
  );
}
