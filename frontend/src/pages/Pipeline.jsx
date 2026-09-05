import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, RefreshCw } from "lucide-react";
import { AppShell, GhostButton } from "../components/crm/AppShell";
import {
  Avatar,
  Chip,
  initialsOf,
  leadTemperature,
  leadTemperatureTone,
  stageTone
} from "../components/crm/ui-bits";
import { FilterPills, SearchField, Select } from "../components/crm/form";
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

                <div
                  className={
                    stageFilter === "All"
                      ? "space-y-3"
                      : "grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
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
                      className="panel p-4 transition-transform hover:-translate-y-0.5 hover:shadow-float"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-sm font-bold leading-tight">{c.company}</p>
                        <Avatar initials={initialsOf(c.owner)} className="size-7" />
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {c.name} · {c.city}
                      </p>
                      <p className="numeric mt-3 font-display text-lg font-extrabold">
                        {currency(c.value)}
                      </p>
                      <div className="mt-3 flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <Chip tone="info">{c.source}</Chip>
                          <Chip tone={leadTemperatureTone(leadTemperature(c))} dot>
                            {leadTemperature(c)}
                          </Chip>
                        </div>
                        <span className="text-[11px] text-muted-foreground">{c.updated}</span>
                      </div>
                      <Select
                        className="mt-3 h-8 text-xs font-semibold"
                        value={col.stage}
                        onClick={(e) => e.stopPropagation()}
                        onChange={(e) => crud.leads.setStatus(c.id, STATUS_OF_STAGE[e.target.value])}
                      >
                        {STAGES.map((s) => (
                          <option key={s} value={s}>
                            Move to {s}
                          </option>
                        ))}
                      </Select>
                    </article>
                  ))}
                  <button
                    onClick={() => setQuick(col.stage)}
                    className={`w-full rounded-xl border border-dashed border-border py-2.5 text-xs font-semibold text-muted-foreground transition-colors hover:border-ring hover:text-foreground ${
                      stageFilter === "All" ? "" : "sm:col-span-2 lg:col-span-3 xl:col-span-4"
                    }`}
                  >
                    + Add card
                  </button>
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
