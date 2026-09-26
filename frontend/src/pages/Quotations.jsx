import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  FileText,
  Plus,
  Trash2,
  Edit,
  Eye,
  Send,
  Download,
  Share2,
  CheckCircle2,
  Building,
  Calendar,
  Layers,
  Clock,
  Sparkles,
  ArrowUpDown,
  FileCheck
} from "lucide-react";
import { AppShell, GhostButton, TableShell, Td, Th } from "../components/crm/AppShell";
import { StatCard, Chip } from "../components/crm/ui-bits";
import {
  Field,
  FormModal,
  Input,
  SearchField,
  Select,
  Textarea
} from "../components/crm/form";
import { currency } from "../lib/crm-data";
import { crud, useQuotations, useLeads, useLookups } from "../lib/crm-store";
import {
  buildDynamicQuotationPdf,
  shareQuotationPdf,
  COMPANY_DETAILS,
  BANK_DETAILS
} from "../lib/quotation";

const QUOTATION_TYPES = [
  "Website Quotation",
  "Software Quotation",
  "Digital Marketing Quotation"
];

// Scope Section suggestions by quotation type
const SCOPE_SUGGESTIONS = {
  "Website Quotation": [
    { title: "Project Overview", content: "The project aims to design, develop and launch a professional, secure and user-friendly corporate website. The site will serve as the company's digital presence providing information about products, services and contact details." },
    { title: "Objectives", content: "• Establish a credible online presence\n• Ensure the website is secure and reliable\n• Provide infrastructure including Domain, Hosting, SSL and Email\n• Enable fast updates via WhatsApp communication\n• Maintain performance via Annual Maintenance Contract (AMC)" },
    { title: "Deliverables", content: "1. Website Hosting setup\n2. SSL Certificate installation\n3. Attractive & Industry oriented design\n4. Annual Maintenance and technical support\n5. Fast-track updates via WhatsApp\n6. Handover of the code after development" },
    { title: "Technology", content: "• Frontend: React, Next.js, HTML5, CSS3, Tailwind CSS\n• Backend & Database: Node.js, PostgreSQL / Supabase\n• Cloud & Deployment: Vercel / AWS Cloud Infrastructure" }
  ],
  "Software Quotation": [
    {
      title: "1. Project Overview & Executive Summary",
      content: "The objective of this project is the end-to-end design, custom development, testing, and cloud deployment of a scalable enterprise-grade software system tailored to the client's exact operational workflows. The software will serve as the centralized business operational platform, streamlining processes, eliminating data fragmentation, and enabling real-time analytics with role-based access security."
    },
    {
      title: "2. System Architecture & Performance Standards",
      content: "• Modular Architecture: Layered architecture decoupling frontend presentation, backend business logic, and database persistence layers.\n• High Availability: Designed for 99.9% uptime with automated health monitoring and graceful degradation.\n• Performance Benchmark: Sub-second API response times (<500ms) utilizing connection pooling and optimized database indexing.\n• Security Standards: OWASP Top 10 compliance, SSL/TLS 1.3 encryption, SQL injection/XSS prevention, and stateless JWT token authentication."
    },
    {
      title: "3. Core Functional Modules & Specifications",
      content: "1. Multi-Tier Role-Based Access Control (RBAC): SuperAdmin, Manager, Staff, and Client roles with granular module-level permissions.\n2. Central Executive Dashboard: Real-time visual KPIs, graphical business trends, upcoming task counters, and operational shortcuts.\n3. Operational Entity Lifecycle & Workflows: Dynamic forms, validation rules, status pipelines, and transaction history tracking.\n4. Notification & Communication Engine: Real-time in-app alerts, automated transaction emails, and WhatsApp status updates.\n5. Reporting, Audit Trail & Data Export: Filterable reporting tables, custom date ranges, and one-click export to formatted Excel and PDF documents."
    },
    {
      title: "4. Technology Stack & Cloud Infrastructure",
      content: "• Frontend Layer: React.js, Next.js, TypeScript, Tailwind CSS, Lucide Icons, Headless UI\n• Backend & Application Layer: Node.js, Express.js REST APIs, JWT authentication middleware\n• Database Tier: PostgreSQL relational database with foreign-key constraints and ACID transaction compliance\n• Cloud & DevOps: Vercel / AWS Cloud Infrastructure, Docker containerization, GitHub Actions CI/CD pipeline, Cloudflare CDN"
    },
    {
      title: "5. Quality Assurance, Security Audit & Testing",
      content: "• Comprehensive Unit and Integration testing for critical business logic workflows.\n• Cross-browser testing across Google Chrome, Mozilla Firefox, Apple Safari, and Microsoft Edge.\n• Multi-viewport responsive UI verification across desktop, tablet, and mobile devices.\n• Security penetration checks including authorization bypass tests, parameter validation, and rate-limiting stress testing."
    },
    {
      title: "6. Post-Launch Warranty, Maintenance & SLA",
      content: "• 90 Days of complimentary post-launch warranty covering all bug fixes, defect rectifications, and system stability maintenance.\n• Service Level Agreement (SLA): Critical severity issues addressed within 4 hours; general operational queries resolved within 24 hours.\n• Database maintenance, automated weekly backup monitoring, and operating environment security patches."
    }
  ],
  "Digital Marketing Quotation": [
    { title: "Project Overview", content: "This Scope of Work covers the digital marketing services for creating and managing social media content for the client. The main focus will be on platforms such as Instagram and Facebook, with regular communication and approvals via email or agreed tools." },
    { title: "Objectives", content: "• Increase brand awareness and visibility among the target audience through consistent posting.\n• Maintain a unified brand identity, tone, and visual style across all content.\n• Provide monthly insights to track performance and refine future content strategy." },
    { title: "Deliverables (Monthly)", content: "• 12 static posts (single images or carousels) with captions, hashtags, and CTAs.\n• 4 reels (short videos of 15–30 seconds) with on-screen text, background audio, and hooks.\n• One monthly content calendar (themes, posting dates/times, platform-wise plan).\n• One monthly performance report (reach, impressions, engagement, best-performing content)." },
    { title: "Features", content: "• Aligned with the client’s brand guidelines (colors, fonts, logo placement, tone of voice).\n• Platform-optimized sizing and formats (e.g., Instagram 9:16 for reels, 1:1 or 4:5 for posts).\n• Trend-aware content: use of trending sounds, visual styles, and content formats where suitable.\n• Simple AB-testing of 1–2 posts/reels per month (different CTAs or hooks) to check performance." }
  ]
};

const DEFAULT_TIMELINES = {
  "Website Quotation": [
    { phase: "Discovery & Planning", key_activities: "Requirement gathering & wireframes", timeline: "Week 1" },
    { phase: "Infrastructure Setup", key_activities: "Domain, Hosting, SSL setup", timeline: "Week 1" },
    { phase: "Website Development", key_activities: "Design & responsive frontend build", timeline: "Week 2" },
    { phase: "Testing", key_activities: "Cross-device functionality & speed testing", timeline: "Week 2" },
    { phase: "Go-Live", key_activities: "Production deployment & launch", timeline: "Week 2" },
    { phase: "Maintenance", key_activities: "Ongoing support & updates", timeline: "Ongoing" }
  ],
  "Software Quotation": [
    { phase: "Phase 1: Discovery, SRS & UI/UX Wireframing", key_activities: "Requirement gathering, technical architecture blueprint, clickable interactive Figma wireframes", timeline: "Weeks 1 - 2" },
    { phase: "Phase 2: Database Modeling & Core API Engine", key_activities: "Relational DB schema, authentication & RBAC system, core RESTful API endpoints", timeline: "Weeks 3 - 4" },
    { phase: "Phase 3: Frontend Module Development", key_activities: "Responsive UI dashboard, operational form workflows, data grid state integration", timeline: "Weeks 5 - 6" },
    { phase: "Phase 4: Integrations & Gateway Automation", key_activities: "Payment gateway, automated email & WhatsApp alerts, Excel/PDF reporting engine", timeline: "Week 7" },
    { phase: "Phase 5: User Acceptance Testing (UAT) & Staging", key_activities: "Staging deployment, stakeholder demo walkthrough, feedback incorporation & bug fixing", timeline: "Week 8" },
    { phase: "Phase 6: Production Cloud Go-Live & Launch", key_activities: "DNS routing, SSL certificates, cloud production launch, complete repository code handover", timeline: "Week 9" },
    { phase: "Phase 7: 90-Day Post-Launch Warranty & Support", key_activities: "Complimentary bug rectification, SLA support, live user & admin training sessions", timeline: "Post-Launch" }
  ],
  "Digital Marketing Quotation": [
    { phase: "Strategy & Onboarding", key_activities: "Brand audit, audience research & tone setting", timeline: "Days 1-5" },
    { phase: "Content Calendar Creation", key_activities: "Drafting 12 posts + 4 reels concept plan", timeline: "Monthly (Week 1)" },
    { phase: "Design & Production", key_activities: "Asset creation, copywriting & client approval", timeline: "Ongoing" },
    { phase: "Publishing & Engagement", key_activities: "Scheduled posting and active monitoring", timeline: "Daily / Weekly" },
    { phase: "Monthly Reporting", key_activities: "Analytics compilation and review meeting", timeline: "Month-end" }
  ]
};

const DEFAULT_INCLUSIONS = {
  "Website Quotation": [
    "Hosting setup for 1 year",
    "SSL certificate installation",
    "Website maintenance support",
    "WhatsApp update support"
  ],
  "Software Quotation": [
    "Complete Full-Stack Source Code repository access (GitHub/GitLab) with full intellectual property (IP) rights transfer.",
    "Comprehensive Database Schema, ER Diagrams, and API documentation for internal records.",
    "Cloud staging and production infrastructure configuration on client cloud accounts (AWS / Vercel / DigitalOcean).",
    "Automated Daily Database Backups and point-in-time disaster recovery configuration.",
    "90 Days complimentary post-launch bug fixing, system monitoring, and stability warranty.",
    "Live interactive admin and operational team training sessions via Google Meet.",
    "SSL certificates, security hardening, CDN setup, and DDOS mitigation."
  ],
  "Digital Marketing Quotation": [
    "Content strategy and monthly theme planning based on client’s business goals.",
    "Design and copywriting for all 12 posts and 4 reels using provided brand assets.",
    "One round of minor revisions (changes to text, hashtags, or small design tweaks).",
    "Monthly performance review and basic optimization suggestions based on analytics."
  ]
};

/**
 * Full Dynamic Quotation Builder Modal
 */
export function QuotationBuilderModal({ open, quotation, initialLeadId, onClose, onSaved }) {
  const { data: leads } = useLeads();
  const isEdit = Boolean(quotation?.id);

  // Form State
  const [selectedLeadId, setSelectedLeadId] = useState(
    quotation?.lead_id || initialLeadId || (leads[0]?.id ?? "")
  );
  const [quotationType, setQuotationType] = useState(quotation?.quotation_type || QUOTATION_TYPES[0]);
  const [discount, setDiscount] = useState(quotation?.discount ?? 0);
  const [taxRate, setTaxRate] = useState(quotation?.pricing_breakdown?.tax_rate ?? 18);
  const [validUntil, setValidUntil] = useState(
    quotation?.valid_until ? quotation.valid_until.split("T")[0] : ""
  );
  const [terms, setTerms] = useState(
    quotation?.terms_conditions || "50% advance payment. Remaining 50% on completion. Taxes applicable as per GST regulations."
  );

  // Dynamic Items
  const [items, setItems] = useState(() => {
    if (quotation?.items && quotation.items.length > 0) return quotation.items;
    return [
      {
        description: "Web Application Development",
        technology: "HTML, CSS, JS, Next JS",
        deliverables: "1) Hosting\n2) Domain\n3) SSL Certificate\n4) Corporate mail id",
        quantity: 1,
        unit_price: 25000,
        total: 25000
      }
    ];
  });

  // Dynamic Scope Sections
  const [scopeSections, setScopeSections] = useState(() => {
    if (quotation?.scope_sections && quotation.scope_sections.length > 0) return quotation.scope_sections;
    return SCOPE_SUGGESTIONS["Website Quotation"];
  });

  // Dynamic Timeline
  const [timelineItems, setTimelineItems] = useState(() => {
    if (quotation?.timeline_items && quotation.timeline_items.length > 0) return quotation.timeline_items;
    return DEFAULT_TIMELINES["Website Quotation"];
  });

  // Dynamic Inclusions
  const [inclusions, setInclusions] = useState(() => {
    if (quotation?.inclusions && quotation.inclusions.length > 0) return quotation.inclusions;
    return DEFAULT_INCLUSIONS["Website Quotation"];
  });

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  // Find selected lead
  const selectedLead = useMemo(() => {
    return leads.find((l) => String(l.id) === String(selectedLeadId)) || leads[0];
  }, [leads, selectedLeadId]);

  // Handle Quotation Type change -> Auto-update suggestions if user wants
  const handleTypeChange = (newType) => {
    setQuotationType(newType);
    if (!isEdit) {
      if (SCOPE_SUGGESTIONS[newType]) setScopeSections(SCOPE_SUGGESTIONS[newType]);
      if (DEFAULT_TIMELINES[newType]) setTimelineItems(DEFAULT_TIMELINES[newType]);
      if (DEFAULT_INCLUSIONS[newType]) setInclusions(DEFAULT_INCLUSIONS[newType]);

      if (newType === "Digital Marketing Quotation") {
        setItems([
          {
            description: "Digital Marketing",
            technology: "1) Adobe Tool\n2) Canva",
            deliverables: "1) Static Posts (12 Per Month)\n2) Reels (4 Per Month)",
            quantity: 1,
            unit_price: 15000,
            total: 15000
          }
        ]);
      } else if (newType === "Software Quotation") {
        setItems([
          {
            description: "UI/UX Design System, Wireframes & Interactive Prototype",
            technology: "Figma, Tailwind CSS, Responsive Web",
            deliverables: "1) User Journey Mapping\n2) Clickable High-Fidelity Prototype\n3) Design System & Tokens",
            quantity: 1,
            unit_price: 25000,
            total: 25000
          },
          {
            description: "Core Software Engine & Custom Business Logic Modules",
            technology: "React.js, Next.js, Node.js, TypeScript",
            deliverables: "1) Multi-Tier Role RBAC\n2) Central KPI Dashboard\n3) Entity Lifecycle Workflows\n4) System Audit Trail Logs",
            quantity: 1,
            unit_price: 65000,
            total: 65000
          },
          {
            description: "RESTful API Engine, Database Architecture & Security",
            technology: "PostgreSQL, Express.js, JWT, TLS 1.3",
            deliverables: "1) Relational DB Modeling\n2) Stateless Token Authentication\n3) Data Encryption at Rest\n4) Automated Daily Backups",
            quantity: 1,
            unit_price: 35000,
            total: 35000
          },
          {
            description: "Third-Party Integrations & Automation Hub",
            technology: "Webhooks, SMTP, SMS / WhatsApp APIs",
            deliverables: "1) Payment Gateway (Razorpay/Stripe)\n2) Automated Email & WhatsApp Alerts\n3) Excel & PDF Export Engine",
            quantity: 1,
            unit_price: 25000,
            total: 25000
          },
          {
            description: "DevOps, Cloud Hosting Setup, CI/CD & QA Testing",
            technology: "Docker, AWS / Vercel Cloud, GitHub Actions",
            deliverables: "1) Production Cloud Hosting Setup\n2) Automated CI/CD Pipeline\n3) End-to-End QA Testing Audit\n4) Source Code Handover",
            quantity: 1,
            unit_price: 20000,
            total: 20000
          }
        ]);
      } else {
        setItems([
          {
            description: "Web Application Development",
            technology: "HTML, CSS, JS, Next JS",
            deliverables: "1) Hosting\n2) Domain\n3) SSL Certificate\n4) Corporate mail id",
            quantity: 1,
            unit_price: 25000,
            total: 25000
          }
        ]);
      }
    }
  };

  // Pricing calculations
  const subtotal = useMemo(() => {
    return items.reduce((acc, it) => acc + (Number(it.total) || 0), 0);
  }, [items]);

  const discountAmount = Number(discount) || 0;
  const taxableAmount = Math.max(0, subtotal - discountAmount);
  const taxAmount = (taxableAmount * (Number(taxRate) || 18)) / 100;
  const grandTotal = Math.round(taxableAmount + taxAmount);

  // Item helpers
  const addItem = () => {
    setItems([
      ...items,
      {
        description: "New Service / Feature",
        technology: "Modern Stack",
        deliverables: "Detailed deliverables",
        quantity: 1,
        unit_price: 10000,
        total: 10000
      }
    ]);
  };

  const updateItem = (index, field, val) => {
    setItems((prev) => {
      const next = [...prev];
      const cur = { ...next[index], [field]: val };
      if (field === "quantity" || field === "unit_price") {
        const q = Number(field === "quantity" ? val : cur.quantity) || 1;
        const p = Number(field === "unit_price" ? val : cur.unit_price) || 0;
        cur.total = q * p;
      }
      next[index] = cur;
      return next;
    });
  };

  const removeItem = (index) => {
    if (items.length <= 1) return;
    setItems(items.filter((_, i) => i !== index));
  };

  // Scope Section helpers
  const addScopeSection = () => {
    setScopeSections([
      ...scopeSections,
      { title: "Custom Scope Section", content: "• Bullet 1\n• Bullet 2" }
    ]);
  };

  const updateScopeSection = (index, field, val) => {
    setScopeSections((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: val };
      return next;
    });
  };

  const removeScopeSection = (index) => {
    setScopeSections(scopeSections.filter((_, i) => i !== index));
  };

  // Timeline helpers
  const addTimelineItem = () => {
    setTimelineItems([
      ...timelineItems,
      { phase: "New Phase", key_activities: "Activities description", timeline: "Week X" }
    ]);
  };

  const updateTimelineItem = (index, field, val) => {
    setTimelineItems((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: val };
      return next;
    });
  };

  const removeTimelineItem = (index) => {
    setTimelineItems(timelineItems.filter((_, i) => i !== index));
  };

  // Inclusions helpers
  const addInclusion = () => {
    setInclusions([...inclusions, "New inclusion item"]);
  };

  const updateInclusion = (index, val) => {
    const next = [...inclusions];
    next[index] = val;
    setInclusions(next);
  };

  const removeInclusion = (index) => {
    setInclusions(inclusions.filter((_, i) => i !== index));
  };

  // Preview PDF directly in browser
  const handlePreview = () => {
    const previewPayload = {
      quotation_number: quotation?.quotation_number || "PREVIEW-0001",
      created_at: new Date().toISOString(),
      quotation_type: quotationType,
      subject: `Quotation for ${quotationType.replace(" Quotation", "")}`,
      customer_name: selectedLead?.name || "Client",
      client_details: {
        name: selectedLead?.name || "Client",
        company: selectedLead?.company || "",
        email: selectedLead?.email || "",
        phone: selectedLead?.phone || "",
        city: "Pune, Maharashtra"
      },
      items,
      scope_sections: scopeSections,
      timeline_items: timelineItems,
      inclusions,
      pricing_breakdown: {
        subtotal,
        discount: discountAmount,
        tax_rate: Number(taxRate) || 18,
        tax_amount: taxAmount,
        grand_total: grandTotal
      },
      terms_conditions: terms
    };

    const doc = buildDynamicQuotationPdf(previewPayload);
    window.open(doc.output("bloburl"), "_blank");
  };

  // Save / Submit
  const handleSave = async (status = "DRAFT") => {
    if (!selectedLead) {
      setError("Please select a Lead.");
      return;
    }
    if (items.length === 0) {
      setError("Please add at least one product or service item.");
      return;
    }

    setBusy(true);
    setError(null);
    try {
      const payload = {
        lead_id: selectedLead.id,
        quotation_type: quotationType,
        subject: `Quotation for ${quotationType.replace(" Quotation", "")}`,
        items,
        scope_sections: scopeSections,
        timeline_items: timelineItems,
        inclusions,
        client_details: {
          name: selectedLead.name,
          company: selectedLead.company,
          email: selectedLead.email,
          phone: selectedLead.phone,
          city: "Pune, Maharashtra"
        },
        discount: discountAmount,
        tax_rate: Number(taxRate) || 18,
        valid_until: validUntil || null,
        terms_conditions: terms,
        status
      };

      if (isEdit) {
        await crud.quotations.update(quotation.id, payload);
      } else {
        await crud.quotations.create(payload);
      }
      onSaved?.();
      onClose();
    } catch (err) {
      setError(err.message || "Failed to save quotation");
    } finally {
      setBusy(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/60 p-4 backdrop-blur-xs animate-in fade-in">
      <div className="relative flex max-h-[92vh] w-full max-w-5xl flex-col rounded-2xl bg-card border border-border shadow-2xl overflow-hidden">
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-border px-6 py-4 bg-muted/20">
          <div>
            <h3 className="font-display text-lg font-bold text-foreground flex items-center gap-2">
              <FileText className="size-5 text-primary" />
              {isEdit ? `Edit Quotation #${quotation.quotation_number}` : "Create Dynamic Quotation"}
            </h3>
            <p className="text-xs text-muted-foreground">
              Professional Qiro corporate proposal builder with dynamic items, customizable Scope of Work, and PDF export.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handlePreview}
              type="button"
              className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-card px-3 py-1.5 text-xs font-semibold text-foreground hover:bg-muted"
            >
              <Eye className="size-3.5" /> Preview PDF
            </button>
            <GhostButton onClick={onClose}>✕</GhostButton>
          </div>
        </div>

        {/* Modal Scrollable Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-8">
          {error && (
            <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive font-semibold">
              {error}
            </div>
          )}

          {/* Section 1 & 2: Lead and Type Selection */}
          <div className="grid gap-5 sm:grid-cols-2 rounded-xl border border-border p-4 bg-muted/10">
            <div>
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground block mb-1.5">
                Select Lead / Customer
              </label>
              <select
                className="w-full rounded-xl border border-input bg-card px-3 py-2 text-sm font-semibold text-foreground shadow-xs focus:ring-2 focus:ring-primary/20"
                value={selectedLeadId}
                onChange={(e) => setSelectedLeadId(e.target.value)}
                disabled={isEdit}
              >
                {leads.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name} {l.company ? `(${l.company})` : ""} · {l.email || l.phone}
                  </option>
                ))}
              </select>

              {selectedLead && (
                <div className="mt-2.5 rounded-lg border border-border/60 bg-card/60 p-2.5 text-xs text-muted-foreground space-y-0.5">
                  <p className="font-semibold text-foreground">{selectedLead.name} · {selectedLead.company || "No company"}</p>
                  <p>Email: {selectedLead.email || "—"} | Phone: {selectedLead.phone || "—"}</p>
                </div>
              )}
            </div>

            <div>
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground block mb-1.5">
                Quotation Type (Sets Subject Automatically)
              </label>
              <select
                className="w-full rounded-xl border border-input bg-card px-3 py-2 text-sm font-semibold text-foreground shadow-xs focus:ring-2 focus:ring-primary/20"
                value={quotationType}
                onChange={(e) => handleTypeChange(e.target.value)}
              >
                {QUOTATION_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
              <div className="mt-2.5 rounded-lg border border-border/60 bg-card/60 p-3.5 text-xs text-muted-foreground space-y-0.5">
                Subject: <strong>Quotation for {quotationType.replace(" Quotation", "")}</strong>
              </div>
            </div>
          </div>

          {/* Section 3: Dynamic Products / Services Table */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-sm font-bold text-foreground flex items-center gap-2">
                  <Layers className="size-4 text-primary" /> Products / Services & Pricing
                </h4>
                <p className="text-xs text-muted-foreground">Add products, technologies, deliverables, quantities and unit prices.</p>
              </div>
              <button
                type="button"
                onClick={addItem}
                className="inline-flex items-center gap-1.5 rounded-xl border border-primary/30 bg-primary-soft px-3 py-1.5 text-xs font-semibold text-primary hover:bg-primary-soft/80"
              >
                <Plus className="size-3.5" /> Add Item
              </button>
            </div>

            <div className="overflow-x-auto rounded-xl border border-border">
              <table className="w-full text-left text-xs">
                <thead className="bg-muted/50 font-bold text-muted-foreground border-b border-border">
                  <tr>
                    <th className="p-2.5 w-10 text-center">#</th>
                    <th className="p-2.5 w-44">Product Description</th>
                    <th className="p-2.5 w-36">Technology</th>
                    <th className="p-2.5 w-48">Deliverables</th>
                    <th className="p-2.5 w-20 text-center">Qty</th>
                    <th className="p-2.5 w-28">Price/Unit (₹)</th>
                    <th className="p-2.5 w-28 text-right">Total (₹)</th>
                    <th className="p-2.5 w-10 text-center"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {items.map((it, idx) => (
                    <tr key={idx} className="hover:bg-muted/20">
                      <td className="p-2 text-center font-semibold text-muted-foreground">{idx + 1}</td>
                      <td className="p-2">
                        <input
                          type="text"
                          className="w-full rounded-lg border border-input bg-card px-2 py-1 text-xs"
                          value={it.description}
                          onChange={(e) => updateItem(idx, "description", e.target.value)}
                          placeholder="e.g. Web Application Development"
                        />
                      </td>
                      <td className="p-2">
                        <textarea
                          rows={2}
                          className="w-full rounded-lg border border-input bg-card px-2 py-1 text-xs resize-none"
                          value={it.technology}
                          onChange={(e) => updateItem(idx, "technology", e.target.value)}
                          placeholder="e.g. Next.js, Tailwind, Node"
                        />
                      </td>
                      <td className="p-2">
                        <textarea
                          rows={2}
                          className="w-full rounded-lg border border-input bg-card px-2 py-1 text-xs resize-none"
                          value={it.deliverables}
                          onChange={(e) => updateItem(idx, "deliverables", e.target.value)}
                          placeholder="1) Hosting 2) SSL..."
                        />
                      </td>
                      <td className="p-2">
                        <input
                          type="number"
                          min="1"
                          className="w-full rounded-lg border border-input bg-card px-2 py-1 text-xs text-center"
                          value={it.quantity}
                          onChange={(e) => updateItem(idx, "quantity", e.target.value)}
                        />
                      </td>
                      <td className="p-2">
                        <input
                          type="number"
                          min="0"
                          step="500"
                          className="w-full rounded-lg border border-input bg-card px-2 py-1 text-xs"
                          value={it.unit_price}
                          onChange={(e) => updateItem(idx, "unit_price", e.target.value)}
                        />
                      </td>
                      <td className="p-2 text-right font-bold text-foreground">
                        {currency(it.total)}
                      </td>
                      <td className="p-2 text-center">
                        <button
                          type="button"
                          onClick={() => removeItem(idx)}
                          className="text-muted-foreground hover:text-destructive p-1"
                        >
                          <Trash2 className="size-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pricing Summary Row */}
            <div className="flex justify-end pt-2">
              <div className="w-72 rounded-xl border border-border p-3 space-y-2 bg-muted/10 text-xs">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Subtotal:</span>
                  <span className="font-semibold">{currency(subtotal)}</span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-muted-foreground">Discount (₹):</span>
                  <input
                    type="number"
                    min="0"
                    className="w-24 rounded border border-input bg-card px-2 py-0.5 text-right font-semibold"
                    value={discount}
                    onChange={(e) => setDiscount(e.target.value)}
                  />
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-muted-foreground">GST Rate (%):</span>
                  <input
                    type="number"
                    min="0"
                    max="28"
                    className="w-24 rounded border border-input bg-card px-2 py-0.5 text-right font-semibold"
                    value={taxRate}
                    onChange={(e) => setTaxRate(e.target.value)}
                  />
                </div>
                <div className="flex justify-between border-t border-border pt-1.5 font-bold text-sm text-primary">
                  <span>Grand Total:</span>
                  <span>{currency(grandTotal)}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Section 4: Scope of Work (SOW) */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-sm font-bold text-foreground flex items-center gap-2">
                  <Sparkles className="size-4 text-primary" /> Scope of Work (SOW) Sections
                </h4>
                <p className="text-xs text-muted-foreground">
                  Completely dynamic and editable per quotation. Uses corporate blue headings in PDF.
                </p>
              </div>
              <button
                type="button"
                onClick={addScopeSection}
                className="inline-flex items-center gap-1.5 rounded-xl border border-primary/30 bg-primary-soft px-3 py-1.5 text-xs font-semibold text-primary hover:bg-primary-soft/80"
              >
                <Plus className="size-3.5" /> Add Scope Section
              </button>
            </div>

            <div className="space-y-3">
              {scopeSections.map((sec, idx) => (
                <div key={idx} className="rounded-xl border border-border p-3.5 bg-card space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <input
                      type="text"
                      className="flex-1 font-bold text-xs text-primary bg-transparent border-b border-primary/30 pb-1 focus:outline-none"
                      value={sec.title}
                      onChange={(e) => updateScopeSection(idx, "title", e.target.value)}
                      placeholder="Section Heading"
                    />
                    <button
                      type="button"
                      onClick={() => removeScopeSection(idx)}
                      className="text-muted-foreground hover:text-destructive p-1"
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  </div>
                  <textarea
                    rows={3}
                    className="w-full rounded-lg border border-input bg-muted/20 p-2 text-xs font-normal resize-y"
                    value={sec.content}
                    onChange={(e) => updateScopeSection(idx, "content", e.target.value)}
                    placeholder="Enter paragraphs or bullet points starting with •"
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Section 5: Timeline */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-sm font-bold text-foreground flex items-center gap-2">
                  <Clock className="size-4 text-primary" /> Features & Timeline
                </h4>
                <p className="text-xs text-muted-foreground">Phases, Key Activities, and Schedule.</p>
              </div>
              <button
                type="button"
                onClick={addTimelineItem}
                className="inline-flex items-center gap-1.5 rounded-xl border border-primary/30 bg-primary-soft px-3 py-1.5 text-xs font-semibold text-primary hover:bg-primary-soft/80"
              >
                <Plus className="size-3.5" /> Add Phase
              </button>
            </div>

            <div className="overflow-x-auto rounded-xl border border-border">
              <table className="w-full text-left text-xs">
                <thead className="bg-muted/50 font-bold text-muted-foreground border-b border-border">
                  <tr>
                    <th className="p-2.5 w-44">Phase</th>
                    <th className="p-2.5">Key Activities</th>
                    <th className="p-2.5 w-32">Timeline</th>
                    <th className="p-2.5 w-10"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {timelineItems.map((t, idx) => (
                    <tr key={idx}>
                      <td className="p-2">
                        <input
                          type="text"
                          className="w-full rounded border border-input bg-card px-2 py-1 text-xs font-semibold"
                          value={t.phase}
                          onChange={(e) => updateTimelineItem(idx, "phase", e.target.value)}
                        />
                      </td>
                      <td className="p-2">
                        <input
                          type="text"
                          className="w-full rounded border border-input bg-card px-2 py-1 text-xs"
                          value={t.key_activities}
                          onChange={(e) => updateTimelineItem(idx, "key_activities", e.target.value)}
                        />
                      </td>
                      <td className="p-2">
                        <input
                          type="text"
                          className="w-full rounded border border-input bg-card px-2 py-1 text-xs"
                          value={t.timeline}
                          onChange={(e) => updateTimelineItem(idx, "timeline", e.target.value)}
                        />
                      </td>
                      <td className="p-2 text-center">
                        <button
                          type="button"
                          onClick={() => removeTimelineItem(idx)}
                          className="text-muted-foreground hover:text-destructive p-1"
                        >
                          <Trash2 className="size-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Section 6: Inclusions */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-sm font-bold text-foreground flex items-center gap-2">
                  <CheckCircle2 className="size-4 text-emerald-500" /> Inclusions
                </h4>
                <p className="text-xs text-muted-foreground">Key value-added deliverables included with this quotation.</p>
              </div>
              <button
                type="button"
                onClick={addInclusion}
                className="inline-flex items-center gap-1.5 rounded-xl border border-primary/30 bg-primary-soft px-3 py-1.5 text-xs font-semibold text-primary hover:bg-primary-soft/80"
              >
                <Plus className="size-3.5" /> Add Inclusion
              </button>
            </div>

            <div className="grid gap-2">
              {inclusions.map((inc, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <span className="text-primary font-bold">•</span>
                  <input
                    type="text"
                    className="flex-1 rounded-lg border border-input bg-card px-3 py-1.5 text-xs"
                    value={inc}
                    onChange={(e) => updateInclusion(idx, e.target.value)}
                  />
                  <button
                    type="button"
                    onClick={() => removeInclusion(idx)}
                    className="text-muted-foreground hover:text-destructive p-1"
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Section 7: Bank Details (Preserved) & Terms */}
          <div className="grid gap-4 sm:grid-cols-2 rounded-xl border border-border p-4 bg-muted/10">
            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">
                Bank Details (Printed on PDF)
              </h4>
              <div className="rounded-lg border border-border bg-card p-3 text-xs space-y-1 text-muted-foreground">
                <p className="font-semibold text-foreground">{BANK_DETAILS.companyName}</p>
                <p>Bank: <strong>{BANK_DETAILS.bankName}</strong> | Account: <strong>{BANK_DETAILS.accountNumber}</strong></p>
                <p>IFSC: <strong>{BANK_DETAILS.ifsc}</strong> | SWIFT: <strong>{BANK_DETAILS.swift}</strong></p>
                <p>Branch: {BANK_DETAILS.branch}</p>
              </div>
            </div>

            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">
                Terms & Conditions & Validity
              </h4>
              <textarea
                rows={4}
                className="w-full rounded-xl border border-input bg-card p-2.5 text-xs resize-none"
                value={terms}
                onChange={(e) => setTerms(e.target.value)}
              />
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-6 py-4 bg-muted/20">
          <GhostButton onClick={onClose}>Cancel</GhostButton>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => handleSave("DRAFT")}
              disabled={busy}
              className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-card px-4 py-2 text-sm font-semibold text-foreground hover:bg-muted shadow-xs disabled:opacity-60"
            >
              Save Draft
            </button>
            <button
              type="button"
              onClick={() => handleSave("READY")}
              disabled={busy}
              className="brand-surface inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-sm font-semibold text-primary-foreground shadow-sm disabled:opacity-60"
            >
              <FileCheck className="size-4" /> Save & Ready
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Main Quotations Page
 */
export default function Quotations() {
  const [searchParams] = useSearchParams();
  const leadId = searchParams.get("lead_id") || "";
  const { data: quotations, loading } = useQuotations();
  const [modalOpen, setModalOpen] = useState(false);
  const [activeQuotation, setActiveQuotation] = useState(null);
  const [query, setQuery] = useState("");
  const [sendingId, setSendingId] = useState(null);
  const [feedback, setFeedback] = useState(null);

  useEffect(() => {
    if (leadId) {
      setActiveQuotation(null);
      setModalOpen(true);
    }
  }, [leadId]);

  const filtered = useMemo(() => {
    if (!Array.isArray(quotations)) return [];
    const q = query.trim().toLowerCase();
    if (!q) return quotations;
    return quotations.filter((item) =>
      [item.quotation_number, item.customer_name, item.product_service, item.quotation_type, item.status]
        .join(" ")
        .toLowerCase()
        .includes(q)
    );
  }, [quotations, query]);

  // Statistics
  const totalValue = quotations.reduce((acc, q) => acc + (Number(q.total_amount) || 0), 0);
  const sentCount = quotations.filter((q) => q.status === "SENT").length;

  const handleDownloadPdf = (q) => {
    try {
      const doc = buildDynamicQuotationPdf(q);
      doc.save(`Quotation-${q.quotation_number || "Doc"}.pdf`);
      setFeedback({ type: "success", message: `Quotation PDF #${q.quotation_number} downloaded.` });
    } catch (err) {
      setFeedback({ type: "error", message: err.message || "Failed to download quotation PDF" });
    }
  };

  const handleSendEmail = async (q) => {
    setSendingId(q.id);
    setFeedback(null);
    try {
      const targetEmail = q.customer_email || q.client_details?.email;
      if (!targetEmail) {
        throw new Error("No recipient email found for this quotation. Please edit the quotation and add an email.");
      }
      const doc = buildDynamicQuotationPdf(q);
      const pdfBase64 = doc.output("datauristring");
      await crud.quotations.sendEmail(q.id, {
        pdf_base64: pdfBase64,
        recipient_email: targetEmail
      });
      setFeedback({ type: "success", message: `Quotation sent successfully to ${targetEmail}!` });
    } catch (err) {
      setFeedback({ type: "error", message: err.message || "Failed to send quotation email" });
    } finally {
      setSendingId(null);
    }
  };

  return (
    <AppShell
      title="Quotations & Proposals"
      subtitle={`${quotations.length} total proposals · Generate corporate multi-page PDFs with customizable Scope of Work.`}
      actions={
        <>
          <GhostButton onClick={() => setQuery("")}>Clear filter</GhostButton>
          <button
            onClick={() => {
              setActiveQuotation(null);
              setModalOpen(true);
            }}
            className="brand-surface inline-flex h-10 items-center gap-2 rounded-xl px-4 text-sm font-semibold text-primary-foreground shadow-sm"
          >
            <Plus className="size-4" /> Create Quotation
          </button>
        </>
      }
    >
      {/* Stat Cards */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Total Quotations" value={String(quotations.length)} hint="Created in CRM" />
        <StatCard label="Total Quoted Value" value={currency(totalValue)} hint="Across all proposals" />
        <StatCard label="Sent Proposals" value={String(sentCount)} delta={`${Math.round((sentCount / (quotations.length || 1)) * 100)}%`} trend="up" hint="Delivered to leads" />
        <StatCard label="Supported Types" value="3" hint="Website, Software, Marketing" />
      </div>

      {feedback && (
        <div
          className={`rounded-xl border p-3.5 text-xs font-semibold ${
            feedback.type === "success"
              ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-600"
              : "border-destructive/30 bg-destructive/10 text-destructive"
          }`}
        >
          {feedback.message}
        </div>
      )}

      <SearchField
        value={query}
        onChange={setQuery}
        placeholder="Search quotation by number, client, service or status…"
        className="max-w-sm"
      />

      <TableShell>
        <thead>
          <tr>
            <Th>Quotation #</Th>
            <Th>Client / Lead</Th>
            <Th>Type & Subject</Th>
            <Th className="text-right">Grand Total</Th>
            <Th>Date</Th>
            <Th>Status</Th>
            <Th className="text-right">Actions</Th>
          </tr>
        </thead>
        <tbody>
          {loading ? (
            <tr>
              <td colSpan={7} className="py-8 text-center text-sm text-muted-foreground">
                Loading quotations…
              </td>
            </tr>
          ) : filtered.length === 0 ? (
            <tr>
              <td colSpan={7} className="py-8 text-center text-sm text-muted-foreground">
                No quotations found. Click "Create Quotation" to build your first one.
              </td>
            </tr>
          ) : (
            filtered.map((q) => (
              <tr key={q.id} className="hover:bg-muted/40 transition-colors">
                <Td className="numeric font-bold text-foreground">{q.quotation_number}</Td>
                <Td>
                  <div>
                    <p className="font-semibold text-foreground">{q.customer_name || q.client_details?.name || "Customer"}</p>
                    <p className="text-xs text-muted-foreground">{q.client_details?.company || q.customer_email || "—"}</p>
                  </div>
                </Td>
                <Td>
                  <div>
                    <p className="font-semibold text-primary">{q.quotation_type || q.product_service}</p>
                    <p className="text-xs text-muted-foreground">{q.subject || "Quotation"}</p>
                  </div>
                </Td>
                <Td className="numeric text-right font-bold text-foreground text-sm">
                  {currency(q.total_amount)}
                </Td>
                <Td className="numeric text-xs text-muted-foreground">
                  {new Date(q.created_at).toLocaleDateString("en-IN", {
                    day: "2-digit",
                    month: "short",
                    year: "numeric"
                  })}
                </Td>
                <Td>
                  <Chip
                    tone={q.status === "SENT" ? "success" : q.status === "READY" ? "info" : "default"}
                    dot
                  >
                    {q.status || "DRAFT"}
                  </Chip>
                </Td>
                <Td className="text-right">
                  <div className="inline-flex items-center gap-1.5">
                    <button
                      onClick={() => handleDownloadPdf(q)}
                      title="Download PDF"
                      className="p-1.5 rounded-lg border border-border bg-card text-foreground hover:bg-muted transition-colors"
                    >
                      <Download className="size-3.5" />
                    </button>
                    <button
                      onClick={() => handleSendEmail(q)}
                      disabled={sendingId === q.id}
                      title="Send Quotation via Email"
                      className="p-1.5 rounded-lg border border-border bg-card text-foreground hover:bg-muted transition-colors disabled:opacity-50"
                    >
                      <Send className="size-3.5" />
                    </button>
                    <button
                      onClick={() => {
                        setActiveQuotation(q);
                        setModalOpen(true);
                      }}
                      title="Edit Quotation"
                      className="p-1.5 rounded-lg border border-border bg-card text-foreground hover:bg-muted transition-colors"
                    >
                      <Edit className="size-3.5" />
                    </button>
                  </div>
                </Td>
              </tr>
            ))
          )}
        </tbody>
      </TableShell>

      <QuotationBuilderModal
        key={`${activeQuotation?.id ?? "new"}-${leadId}`}
        open={modalOpen}
        quotation={activeQuotation}
        initialLeadId={leadId}
        onClose={() => setModalOpen(false)}
        onSaved={() => {
          if (leadId) window.history.replaceState({}, "", "/quotations");
          window.location.reload();
        }}
      />
    </AppShell>
  );
}
