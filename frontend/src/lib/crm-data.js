const currency = (n) => new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0
}).format(n);
const owners = [
  { id: 1, name: "Aarav Menon", role: "Sales Manager", initials: "AM" },
  { id: 2, name: "Divya Nair", role: "Sales Executive", initials: "DN" },
  { id: 3, name: "Rohan Kulkarni", role: "Sales Executive", initials: "RK" },
  { id: 4, name: "Sara Iqbal", role: "Telecaller", initials: "SI" },
  { id: 5, name: "Neha Rathi", role: "Admin", initials: "NR" }
];
const kpis = [
  { label: "Open pipeline", value: currency(1845e4), delta: "+12.4%", trend: "up", hint: "vs last month" },
  { label: "Won this month", value: currency(426e4), delta: "+8.1%", trend: "up", hint: "17 deals closed" },
  { label: "Active leads", value: "248", delta: "+31", trend: "up", hint: "42 unassigned" },
  { label: "Overdue follow-ups", value: "14", delta: "-6", trend: "down", hint: "needs attention today" }
];
const revenueTrend = [
  { month: "Feb", won: 2.1, pipeline: 8.4 },
  { month: "Mar", won: 2.8, pipeline: 9.7 },
  { month: "Apr", won: 2.4, pipeline: 11.2 },
  { month: "May", won: 3.3, pipeline: 12.6 },
  { month: "Jun", won: 3.9, pipeline: 15.1 },
  { month: "Jul", won: 3.5, pipeline: 16.8 },
  { month: "Aug", won: 4.26, pipeline: 18.45 }
];
const sourceSplit = [
  { source: "Website", value: 84 },
  { source: "Referral", value: 61 },
  { source: "Cold call", value: 47 },
  { source: "Exhibition", value: 32 },
  { source: "LinkedIn", value: 24 }
];
const stageFunnel = [
  { stage: "New", count: 96, value: 52e5 },
  { stage: "Contacted", count: 64, value: 43e5 },
  { stage: "Qualified", count: 41, value: 38e5 },
  { stage: "Proposal", count: 27, value: 31e5 },
  { stage: "Negotiation", count: 15, value: 205e4 }
];
const leads = [
  { id: 1041, name: "Priya Sharma", company: "Northwind Textiles", city: "Surat", email: "priya@northwind.in", phone: "+91 98200 11223", stage: "Qualified", value: 125e4, source: "Website", owner: "Divya Nair", score: 82, updated: "2h ago" },
  { id: 1040, name: "Karan Bhatia", company: "Vertex Logistics", city: "Pune", email: "karan@vertexlog.com", phone: "+91 99870 44521", stage: "Proposal", value: 24e5, source: "Referral", owner: "Aarav Menon", score: 91, updated: "4h ago" },
  { id: 1039, name: "Meera Joshi", company: "Bluepeak Foods", city: "Nashik", email: "meera@bluepeak.co", phone: "+91 90045 77812", stage: "Contacted", value: 68e4, source: "Exhibition", owner: "Rohan Kulkarni", score: 58, updated: "Yesterday" },
  { id: 1038, name: "Imran Sheikh", company: "Sunrise Polymers", city: "Ahmedabad", email: "imran@sunrisepoly.in", phone: "+91 97120 33447", stage: "Negotiation", value: 315e4, source: "LinkedIn", owner: "Aarav Menon", score: 88, updated: "Yesterday" },
  { id: 1037, name: "Anita Desai", company: "Corepoint Health", city: "Mumbai", email: "anita@corepointhc.com", phone: "+91 98330 90012", stage: "New", value: 54e4, source: "Website", owner: "Unassigned", score: 44, updated: "2d ago" },
  { id: 1036, name: "Vikram Rao", company: "Helios Solar", city: "Hyderabad", email: "vikram@heliossolar.in", phone: "+91 96660 12009", stage: "Qualified", value: 1875e3, source: "Cold call", owner: "Sara Iqbal", score: 74, updated: "2d ago" },
  { id: 1035, name: "Farah Khan", company: "Lumen Interiors", city: "Bengaluru", email: "farah@lumen.design", phone: "+91 90190 55510", stage: "Won", value: 92e4, source: "Referral", owner: "Divya Nair", score: 96, updated: "3d ago" },
  { id: 1034, name: "Sanjay Pillai", company: "Marina Exports", city: "Kochi", email: "sanjay@marinaexp.com", phone: "+91 94470 88123", stage: "Lost", value: 76e4, source: "Website", owner: "Rohan Kulkarni", score: 31, updated: "4d ago" }
];
const pipelineStages = [
  { stage: "New", leadIds: [1037] },
  { stage: "Contacted", leadIds: [1039] },
  { stage: "Qualified", leadIds: [1041, 1036] },
  { stage: "Proposal", leadIds: [1040] },
  { stage: "Negotiation", leadIds: [1038] },
  { stage: "Won", leadIds: [1035] }
];
const followUps = [
  { id: 91, lead: "Imran Sheikh", company: "Sunrise Polymers", channel: "Call", due: "Today, 11:30", status: "Today", owner: "Aarav Menon", note: "Discuss revised pricing slab" },
  { id: 90, lead: "Meera Joshi", company: "Bluepeak Foods", channel: "Email", due: "Yesterday, 17:00", status: "Overdue", owner: "Rohan Kulkarni", note: "Send catalogue + MOQ sheet" },
  { id: 89, lead: "Priya Sharma", company: "Northwind Textiles", channel: "Meeting", due: "Today, 16:00", status: "Today", owner: "Divya Nair", note: "Plant visit walkthrough" },
  { id: 88, lead: "Vikram Rao", company: "Helios Solar", channel: "WhatsApp", due: "Tomorrow, 10:00", status: "Upcoming", owner: "Sara Iqbal", note: "Share installation timeline" },
  { id: 87, lead: "Karan Bhatia", company: "Vertex Logistics", channel: "Call", due: "Fri, 12:15", status: "Upcoming", owner: "Aarav Menon", note: "Legal review feedback" },
  { id: 86, lead: "Farah Khan", company: "Lumen Interiors", channel: "Email", due: "Mon, 09:30", status: "Done", owner: "Divya Nair", note: "Onboarding kit delivered" }
];
const deals = [
  { id: "D-2041", title: "Annual fabric supply contract", customer: "Northwind Textiles", value: 125e4, stage: "Qualified", probability: 55, close: "12 Sep 2026", owner: "Divya Nair" },
  { id: "D-2040", title: "Fleet telematics rollout", customer: "Vertex Logistics", value: 24e5, stage: "Proposal", probability: 70, close: "28 Aug 2026", owner: "Aarav Menon" },
  { id: "D-2039", title: "Cold-chain expansion phase 2", customer: "Bluepeak Foods", value: 68e4, stage: "Contacted", probability: 25, close: "04 Oct 2026", owner: "Rohan Kulkarni" },
  { id: "D-2038", title: "Polymer line automation", customer: "Sunrise Polymers", value: 315e4, stage: "Negotiation", probability: 85, close: "25 Aug 2026", owner: "Aarav Menon" },
  { id: "D-2037", title: "Rooftop solar 480 kW", customer: "Helios Solar", value: 1875e3, stage: "Qualified", probability: 50, close: "18 Sep 2026", owner: "Sara Iqbal" }
];
const customers = [
  { id: 501, company: "Lumen Interiors", contact: "Farah Khan", industry: "Design & build", since: "Jan 2025", lifetime: 342e4, health: "Healthy", owner: "Divya Nair" },
  { id: 502, company: "Trident Mobility", contact: "Nikhil Ahuja", industry: "Automotive", since: "Mar 2024", lifetime: 89e5, health: "Healthy", owner: "Aarav Menon" },
  { id: 503, company: "Sable Retail Group", contact: "Ritu Malhotra", industry: "Retail", since: "Aug 2023", lifetime: 512e4, health: "At risk", owner: "Rohan Kulkarni" },
  { id: 504, company: "Orbit Pharma", contact: "Dr. Ashwin Rao", industry: "Pharma", since: "Nov 2025", lifetime: 146e4, health: "Healthy", owner: "Sara Iqbal" },
  { id: 505, company: "Kestrel Infra", contact: "Manish Verma", industry: "Construction", since: "Feb 2023", lifetime: 734e4, health: "Churn risk", owner: "Aarav Menon" }
];
const contacts = [
  { id: 1, name: "Priya Sharma", title: "Head of Sourcing", company: "Northwind Textiles", email: "priya@northwind.in", phone: "+91 98200 11223", type: "Decision maker" },
  { id: 2, name: "Karan Bhatia", title: "VP Operations", company: "Vertex Logistics", email: "karan@vertexlog.com", phone: "+91 99870 44521", type: "Decision maker" },
  { id: 3, name: "Sneha Patil", title: "Procurement Lead", company: "Bluepeak Foods", email: "sneha@bluepeak.co", phone: "+91 90045 77813", type: "Procurement" },
  { id: 4, name: "Imran Sheikh", title: "Plant Director", company: "Sunrise Polymers", email: "imran@sunrisepoly.in", phone: "+91 97120 33447", type: "Influencer" },
  { id: 5, name: "Rahul Menon", title: "Systems Engineer", company: "Helios Solar", email: "rahul@heliossolar.in", phone: "+91 96660 12010", type: "Technical" },
  { id: 6, name: "Ritu Malhotra", title: "Category Manager", company: "Sable Retail Group", email: "ritu@sableretail.com", phone: "+91 98110 22456", type: "Decision maker" }
];
const activities = [
  { id: 1, type: "Stage change", actor: "Aarav Menon", subject: "Sunrise Polymers", detail: "Moved from Proposal to Negotiation", when: "22 min ago" },
  { id: 2, type: "Call", actor: "Sara Iqbal", subject: "Helios Solar", detail: "12 min call \u2014 asked for phased payment terms", when: "1h ago" },
  { id: 3, type: "Email", actor: "Divya Nair", subject: "Northwind Textiles", detail: "Sent revised quotation v3", when: "3h ago" },
  { id: 4, type: "Meeting", actor: "Rohan Kulkarni", subject: "Bluepeak Foods", detail: "Site walkthrough scheduled for Thursday", when: "Yesterday" },
  { id: 5, type: "Note", actor: "Aarav Menon", subject: "Vertex Logistics", detail: "Procurement wants ISO documentation before sign-off", when: "Yesterday" },
  { id: 6, type: "Stage change", actor: "Divya Nair", subject: "Lumen Interiors", detail: "Marked as Won \u2014 converted to customer", when: "3d ago" }
];
const agenda = [
  { time: "09:30", title: "Pipeline stand-up", meta: "Sales team \xB7 15 min", tone: "info" },
  { time: "11:30", title: "Call \u2014 Imran Sheikh", meta: "Sunrise Polymers \xB7 pricing", tone: "primary" },
  { time: "13:00", title: "Quotation review", meta: "Northwind Textiles", tone: "warning" },
  { time: "16:00", title: "Plant visit \u2014 Priya Sharma", meta: "Surat \xB7 with Divya", tone: "primary" },
  { time: "18:00", title: "Log day's outcomes", meta: "Daily discipline", tone: "muted" }
];
const notifications = [
  { id: 1, title: "Deal moved to Negotiation", body: "Sunrise Polymers \xB7 \u20B931.5L by Aarav Menon", when: "22 min ago", unread: true },
  { id: 2, title: "Follow-up overdue", body: "Bluepeak Foods email was due yesterday 17:00", when: "1h ago", unread: true },
  { id: 3, title: "New website lead", body: "Corepoint Health \u2014 unassigned for 2 days", when: "2h ago", unread: true },
  { id: 4, title: "Monthly target 68% reached", body: "\u20B942.6L of \u20B962.5L closed", when: "Today", unread: false },
  { id: 5, title: "Customer converted", body: "Lumen Interiors is now an active account", when: "3d ago", unread: false }
];
const salesRows = [
  { id: "INV-3391", customer: "Trident Mobility", amount: 145e4, date: "18 Aug 2026", status: "Paid", owner: "Aarav Menon" },
  { id: "INV-3390", customer: "Lumen Interiors", amount: 92e4, date: "14 Aug 2026", status: "Paid", owner: "Divya Nair" },
  { id: "INV-3389", customer: "Orbit Pharma", amount: 64e4, date: "11 Aug 2026", status: "Pending", owner: "Sara Iqbal" },
  { id: "INV-3388", customer: "Sable Retail Group", amount: 118e4, date: "06 Aug 2026", status: "Overdue", owner: "Rohan Kulkarni" },
  { id: "INV-3387", customer: "Kestrel Infra", amount: 227e4, date: "02 Aug 2026", status: "Paid", owner: "Aarav Menon" }
];
const repPerformance = [
  { rep: "Aarav Menon", won: 18.2, target: 22 },
  { rep: "Divya Nair", won: 14.6, target: 16 },
  { rep: "Rohan Kulkarni", won: 9.4, target: 14 },
  { rep: "Sara Iqbal", won: 7.8, target: 10 }
];
const users = [
  { id: 1, name: "Aarav Menon", email: "aarav@qirotech.in", role: "Sales Manager", status: "Active", lastSeen: "Online now" },
  { id: 2, name: "Divya Nair", email: "divya@qirotech.in", role: "Sales Executive", status: "Active", lastSeen: "12 min ago" },
  { id: 3, name: "Rohan Kulkarni", email: "rohan@qirotech.in", role: "Sales Executive", status: "Active", lastSeen: "1h ago" },
  { id: 4, name: "Sara Iqbal", email: "sara@qirotech.in", role: "Telecaller", status: "Active", lastSeen: "Yesterday" },
  { id: 5, name: "Neha Rathi", email: "neha@qirotech.in", role: "Admin", status: "Active", lastSeen: "3h ago" },
  { id: 6, name: "Vivek Sonar", email: "vivek@qirotech.in", role: "Sales Executive", status: "Invited", lastSeen: "Never" }
];
export {
  activities,
  agenda,
  contacts,
  currency,
  customers,
  deals,
  followUps,
  kpis,
  leads,
  notifications,
  owners,
  pipelineStages,
  repPerformance,
  revenueTrend,
  salesRows,
  sourceSplit,
  stageFunnel,
  users
};
