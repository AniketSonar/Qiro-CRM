import { useEffect, useState } from "react";
import {
  Copy,
  Check,
  ExternalLink,
  Sparkles,
  Info,
  CheckCircle2,
  Share2,
  Code2,
  ShieldCheck,
  Send
} from "lucide-react";
import { Modal, Field, Input, Textarea, PrimaryButton, SubtleButton } from "./form";
import { api } from "../../lib/api";
import { invalidate } from "../../lib/crm-store";

export function MetaAdsModal({ open, onClose }) {
  const [tab, setTab] = useState("guide"); // "guide" | "simulate" | "landing"
  const [copiedUrl, setCopiedUrl] = useState(false);
  const [copiedToken, setCopiedToken] = useState(false);
  const [copiedSnippet, setCopiedSnippet] = useState(false);

  // Status state
  const [status, setStatus] = useState(null);

  // Simulation form state
  const [simData, setSimData] = useState({
    first_name: "Priya",
    last_name: "Sharma",
    email: "priya.sharma@example.com",
    phone: "+91 98765 43210",
    company: "Sharma Tech Solutions",
    designation: "Founder & CEO",
    ad_campaign: "Instagram Reels Summer Promo",
    custom_note: "Interested in Qiro CRM enterprise plan for 15 sales reps."
  });
  const [simBusy, setSimBusy] = useState(false);
  const [simSuccess, setSimSuccess] = useState(null);
  const [simError, setSimError] = useState(null);

  const origin = typeof window !== "undefined" ? window.location.origin : "https://your-domain.com";
  const webhookUrl = `${origin}/api/webhooks/meta`;
  const verifyToken = status?.verifyToken || "qiro_meta_leadgen_verify_token_2026";

  useEffect(() => {
    if (!open) return;
    setSimSuccess(null);
    setSimError(null);
    api.get("/webhooks/meta/status")
      .then((res) => {
        if (res?.data) setStatus(res.data);
      })
      .catch(() => {});
  }, [open]);

  const copyToClipboard = (text, type) => {
    navigator.clipboard.writeText(text);
    if (type === "url") {
      setCopiedUrl(true);
      setTimeout(() => setCopiedUrl(false), 2000);
    } else if (type === "token") {
      setCopiedToken(true);
      setTimeout(() => setCopiedToken(false), 2000);
    } else if (type === "snippet") {
      setCopiedSnippet(true);
      setTimeout(() => setCopiedSnippet(false), 2000);
    }
  };

  const handleSimulate = async (e) => {
    e?.preventDefault?.();
    setSimBusy(true);
    setSimSuccess(null);
    setSimError(null);
    try {
      const res = await api.post("/webhooks/meta/simulate", simData);
      setSimSuccess(res?.data?.lead || true);
      invalidate(); // Automatically triggers full CRM reload so lead appears instantly!
    } catch (err) {
      setSimError(err.message || "Failed to simulate lead");
    } finally {
      setSimBusy(false);
    }
  };

  const embedSnippet = `// Submit website form lead directly to Qiro CRM from Instagram Ad clicks
fetch("${webhookUrl}/capture", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    first_name: document.getElementById("name").value,
    email: document.getElementById("email").value,
    phone: document.getElementById("phone").value,
    company: document.getElementById("company").value,
    source: "INSTAGRAM ADS",
    notes: "Submitted via Instagram Campaign Landing Page"
  })
}).then(res => res.json()).then(console.log);`;

  return (
    <Modal
      open={open}
      wide
      title={
        <div className="flex items-center gap-2.5">
          <div className="flex size-8 items-center justify-center rounded-lg bg-gradient-to-tr from-amber-500 via-rose-500 to-purple-600 text-white shadow-sm">
            <Share2 className="size-4" />
          </div>
          <span>Instagram & Facebook Ads Integration</span>
        </div>
      }
      description="Capture leads automatically into Qiro CRM the moment prospects submit an Instant Form or landing page form on Instagram & Facebook."
      onClose={onClose}
    >
      {/* Tabs */}
      <div className="flex border-b border-border pb-2 text-sm font-semibold">
        <button
          type="button"
          onClick={() => setTab("guide")}
          className={`flex items-center gap-2 border-b-2 px-4 py-2 transition-colors ${
            tab === "guide"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <ShieldCheck className="size-4" /> Setup & Webhook
        </button>
        <button
          type="button"
          onClick={() => setTab("simulate")}
          className={`flex items-center gap-2 border-b-2 px-4 py-2 transition-colors ${
            tab === "simulate"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <Sparkles className="size-4 text-amber-500" /> Test Simulator
          <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-bold text-amber-600">
            Live Test
          </span>
        </button>
        <button
          type="button"
          onClick={() => setTab("landing")}
          className={`flex items-center gap-2 border-b-2 px-4 py-2 transition-colors ${
            tab === "landing"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <Code2 className="size-4" /> Landing Page Webhook
        </button>
      </div>

      <div className="mt-4 space-y-6">
        {/* TAB 1: SETUP & WEBHOOK GUIDE */}
        {tab === "guide" && (
          <div className="space-y-6">
            {/* Status overview banner */}
            <div className="rounded-xl border border-border/80 bg-muted/40 p-4">
              <div className="flex items-start gap-3">
                <Info className="size-5 shrink-0 text-primary mt-0.5" />
                <div className="text-sm">
                  <p className="font-semibold text-foreground">How Meta Lead Ads Work</p>
                  <p className="mt-1 text-muted-foreground leading-relaxed">
                    When users scroll Instagram or Facebook and tap your ad, a native Instant Form opens with their profile name, email, and phone pre-filled. When submitted, Meta dispatches a webhook to Qiro CRM and creates a new lead in real-time.
                  </p>
                </div>
              </div>
            </div>

            {/* Endpoints & tokens */}
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-xl border border-border p-4 bg-card">
                <label className="text-xs font-bold uppercase tracking-wide text-muted-foreground block mb-2">
                  1. Webhook Callback URL
                </label>
                <div className="flex items-center gap-2">
                  <Input value={webhookUrl} readOnly className="font-mono text-xs bg-muted/40 select-all" />
                  <SubtleButton
                    type="button"
                    onClick={() => copyToClipboard(webhookUrl, "url")}
                    className="shrink-0"
                    title="Copy URL"
                  >
                    {copiedUrl ? <Check className="size-4 text-success" /> : <Copy className="size-4" />}
                  </SubtleButton>
                </div>
                <p className="mt-2 text-[11px] text-muted-foreground">
                  Paste this into Meta Developer App &rarr; Webhooks &rarr; Page &rarr; Callback URL.
                </p>
              </div>

              <div className="rounded-xl border border-border p-4 bg-card">
                <label className="text-xs font-bold uppercase tracking-wide text-muted-foreground block mb-2">
                  2. Webhook Verify Token
                </label>
                <div className="flex items-center gap-2">
                  <Input value={verifyToken} readOnly className="font-mono text-xs bg-muted/40 select-all" />
                  <SubtleButton
                    type="button"
                    onClick={() => copyToClipboard(verifyToken, "token")}
                    className="shrink-0"
                    title="Copy Token"
                  >
                    {copiedToken ? <Check className="size-4 text-success" /> : <Copy className="size-4" />}
                  </SubtleButton>
                </div>
                <p className="mt-2 text-[11px] text-muted-foreground">
                  Configured in <code className="text-[11px]">META_VERIFY_TOKEN</code> in your backend environment.
                </p>
              </div>
            </div>

            {/* Step-by-step checklist */}
            <div className="space-y-3">
              <h4 className="text-sm font-bold text-foreground">Step-by-Step Meta Setup Guide</h4>
              <ol className="space-y-3 text-sm text-muted-foreground">
                <li className="flex items-start gap-3 rounded-xl border border-border/60 p-3.5 bg-card">
                  <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary/10 font-bold text-primary text-xs">
                    1
                  </span>
                  <div>
                    <strong className="text-foreground">Create your Meta App</strong>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Go to <a href="https://developers.facebook.com" target="_blank" rel="noreferrer" className="text-primary hover:underline inline-flex items-center gap-0.5">Meta for Developers <ExternalLink className="size-3" /></a>, create a Business App, and add the <strong>Webhooks</strong> product.
                    </p>
                  </div>
                </li>

                <li className="flex items-start gap-3 rounded-xl border border-border/60 p-3.5 bg-card">
                  <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary/10 font-bold text-primary text-xs">
                    2
                  </span>
                  <div>
                    <strong className="text-foreground">Subscribe to Page &rarr; leadgen</strong>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      In the Webhooks section, select <strong>Page</strong> from the dropdown, click <strong>Subscribe to this object</strong>, and enter the Callback URL and Verify Token from above. Then subscribe to the <code className="rounded bg-muted px-1.5 py-0.5 text-xs text-foreground font-mono">leadgen</code> event field.
                    </p>
                  </div>
                </li>

                <li className="flex items-start gap-3 rounded-xl border border-border/60 p-3.5 bg-card">
                  <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary/10 font-bold text-primary text-xs">
                    3
                  </span>
                  <div>
                    <strong className="text-foreground">Connect Instagram & Create Lead Form</strong>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      In <strong>Meta Business Suite</strong>, connect your Instagram Business account to your Facebook Page. Go to <strong>All Tools &rarr; Instant Forms</strong> and create your ad lead generation form.
                    </p>
                  </div>
                </li>

                <li className="flex items-start gap-3 rounded-xl border border-border/60 p-3.5 bg-card">
                  <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary/10 font-bold text-primary text-xs">
                    4
                  </span>
                  <div>
                    <strong className="text-foreground">Configure Page Access Token</strong>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Add your <code className="rounded bg-muted px-1.5 py-0.5 text-xs text-foreground font-mono">META_PAGE_ACCESS_TOKEN</code> (with <code className="text-xs">leads_retrieval</code> permission) in your backend <code className="text-xs font-mono">.env</code> file.
                    </p>
                  </div>
                </li>
              </ol>
            </div>
          </div>
        )}

        {/* TAB 2: LIVE SIMULATOR */}
        {tab === "simulate" && (
          <div className="space-y-4">
            <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4 text-sm text-foreground">
              <div className="flex items-start gap-3">
                <Sparkles className="size-5 shrink-0 text-amber-500 mt-0.5" />
                <div>
                  <p className="font-semibold text-amber-600">Simulate Real Instagram Ad Submissions</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    No need to wait for live ad campaigns or spend ad spend. Fill out this simulated form or use the default values to test how leads are automatically ingested, stored with the source <strong>INSTAGRAM ADS</strong>, and trigger team notifications.
                  </p>
                </div>
              </div>
            </div>

            {simSuccess && (
              <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm text-emerald-800 dark:text-emerald-300">
                <div className="flex items-center gap-2 font-semibold">
                  <CheckCircle2 className="size-5 text-emerald-500 shrink-0" />
                  <span>Success! Instagram Ad Lead captured in Qiro CRM.</span>
                </div>
                <p className="mt-1 text-xs text-emerald-700 dark:text-emerald-400">
                  The lead has been recorded with ID #{simSuccess.id ?? "new"} under status <strong>NEW</strong> with source <strong>INSTAGRAM ADS</strong>. Check the Leads table right behind this modal!
                </p>
              </div>
            )}

            {simError && (
              <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
                Error simulating lead: {simError}
              </div>
            )}

            <form onSubmit={handleSimulate} className="grid gap-4 sm:grid-cols-2">
              <Field label="First name" required>
                <Input
                  value={simData.first_name}
                  onChange={(e) => setSimData({ ...simData, first_name: e.target.value })}
                  required
                />
              </Field>

              <Field label="Last name">
                <Input
                  value={simData.last_name}
                  onChange={(e) => setSimData({ ...simData, last_name: e.target.value })}
                />
              </Field>

              <Field label="Email" required>
                <Input
                  type="email"
                  value={simData.email}
                  onChange={(e) => setSimData({ ...simData, email: e.target.value })}
                  required
                />
              </Field>

              <Field label="Phone number" required>
                <Input
                  value={simData.phone}
                  onChange={(e) => setSimData({ ...simData, phone: e.target.value })}
                  required
                />
              </Field>

              <Field label="Company name">
                <Input
                  value={simData.company}
                  onChange={(e) => setSimData({ ...simData, company: e.target.value })}
                />
              </Field>

              <Field label="Job title / Designation">
                <Input
                  value={simData.designation}
                  onChange={(e) => setSimData({ ...simData, designation: e.target.value })}
                />
              </Field>

              <Field label="Instagram Ad Campaign" className="sm:col-span-2">
                <Input
                  value={simData.ad_campaign}
                  onChange={(e) => setSimData({ ...simData, ad_campaign: e.target.value })}
                  placeholder="e.g. Instagram Reels Summer Growth Ad"
                />
              </Field>

              <Field label="Prospect Notes / Form Message" className="sm:col-span-2">
                <Textarea
                  value={simData.custom_note}
                  onChange={(e) => setSimData({ ...simData, custom_note: e.target.value })}
                  placeholder="Additional question responses or requirements..."
                />
              </Field>

              <div className="sm:col-span-2 flex justify-end gap-3 pt-2">
                <SubtleButton type="button" onClick={onClose}>
                  Cancel
                </SubtleButton>
                <PrimaryButton type="submit" busy={simBusy}>
                  <Send className="size-4" /> Simulate Instagram Ad Lead
                </PrimaryButton>
              </div>
            </form>
          </div>
        )}

        {/* TAB 3: LANDING PAGE INTEGRATION */}
        {tab === "landing" && (
          <div className="space-y-4">
            <div className="rounded-xl border border-border bg-card p-4 text-sm">
              <h4 className="font-semibold text-foreground">External Website & Landing Page Ingestion</h4>
              <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
                If your Instagram or Facebook ads send traffic to a custom website landing page (e.g. Webflow, WordPress, Next.js, or HTML form) instead of native Instant Forms, use this public endpoint to ingest submissions directly into Qiro CRM.
              </p>
            </div>

            <div className="rounded-xl border border-border p-4 bg-card space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
                  JavaScript / HTML Integration Snippet
                </span>
                <SubtleButton
                  type="button"
                  onClick={() => copyToClipboard(embedSnippet, "snippet")}
                  className="h-8 text-xs"
                >
                  {copiedSnippet ? <Check className="size-3.5 text-success" /> : <Copy className="size-3.5" />}
                  {copiedSnippet ? "Copied" : "Copy snippet"}
                </SubtleButton>
              </div>

              <pre className="overflow-x-auto rounded-lg bg-muted/60 p-3 text-xs font-mono leading-relaxed text-foreground">
                {embedSnippet}
              </pre>

              <p className="text-xs text-muted-foreground">
                This endpoint accepts CORS from any landing page and creates a lead with status <code className="font-mono text-xs">NEW</code> and source <code className="font-mono text-xs">INSTAGRAM ADS</code>.
              </p>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
