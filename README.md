<p align="center">
  <img src="frontend/public/qiro_full_logo.png" alt="QIRO TECH Innovation Pvt. Ltd." width="380" />
</p>

<h1 align="center">Qiro CRM — Enterprise Customer Relationship & Revenue Intelligence Platform</h1>

<p align="center">
  <b>Comprehensive CRM, Deal Pipeline, Multi-Page Quotations, GST Tax Invoicing & Team Compensation Management</b>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/React-19.0.0-blue?logo=react&logoColor=white" alt="React 19" />
  <img src="https://img.shields.io/badge/Vite-6.0.7-646CFF?logo=vite&logoColor=white" alt="Vite 6" />
  <img src="https://img.shields.io/badge/Tailwind_CSS-4.1.11-38B2AC?logo=tailwind-css&logoColor=white" alt="Tailwind 4" />
  <img src="https://img.shields.io/badge/Node.js-18+-339933?logo=node.js&logoColor=white" alt="Node.js" />
  <img src="https://img.shields.io/badge/Express-5.2.1-000000?logo=express&logoColor=white" alt="Express 5" />
  <img src="https://img.shields.io/badge/PostgreSQL-15+-4169E1?logo=postgresql&logoColor=white" alt="PostgreSQL" />
  <img src="https://img.shields.io/badge/License-Proprietary-red" alt="License" />
</p>

---

## 📌 Executive Overview

**Qiro CRM** is an enterprise-grade Customer Relationship Management and Revenue Operations platform built by **QIRO TECH INNOVATION PVT. LTD.** Tailored specifically for modern technology companies, agencies, and high-velocity B2B sales teams, Qiro CRM unifies lead acquisition, deal pipeline management, client communications, corporate quotation generation, GST-compliant invoicing, and employee compensation workflows into a seamless, high-performance interface.

---

## ✨ Core Modules & Feature Highlights

### 🎯 1. Lead Lifecycle & Omni-Channel Capture
* **360° Lead Management**: Capture, score, qualify, and assign inbound prospects across multiple sales reps.
* **Lead Source Intelligence**: Track acquisition channels (Website, Meta Ads, LinkedIn, Referral, Inbound Calls).
* **Automated Webhooks**: Real-time webhook ingestion for **Meta (Facebook & Instagram) Lead Ads** and **LinkedIn Lead Gen Forms** with signature verification.
* **Interaction Timeline**: Complete history of call notes, meeting logs, WhatsApp chats, status progressions, and attachments per lead.

### 📊 2. Visual Sales Pipeline & Deal Progression
* **Multi-Stage Kanban Funnel**: Intuitive visual pipeline tracking deal stages (*Discovery, Demo, Proposal, Negotiation, Won, Lost*).
* **Revenue Forecasting**: Weighted probability multipliers and anticipated close dates.
* **Customer Conversion**: One-click deal conversion turning qualified leads into active customer accounts.

### 🏢 3. Customer Directory & Account Management
* **Account Records**: Centralized directory with automated corporate customer codes (`CUST-XXXXXX`).
* **Contact Directory**: Multi-stakeholder contact repository linked to parent accounts.
* **Lifecycle Tracking**: Account classification by status, contract type, and active commercial engagement.

### 📄 4. Dynamic Corporate Quotation Builder
* **Multi-Page Executive PDF Generation**: Client-side, vector-crisp PDF builder using `jsPDF` adhering strictly to corporate stationery standards.
* **Brand Identity**: Features the official Qiro Tech symbol, brand typography, and verified company credentials.
* **Tailored Proposals**: Specialized templates for **Software Development**, **Digital Marketing**, and **Website Design**.
* **Granular Scope of Work (SOW)**: Structured deliverables, milestones, tech stacks, inclusions, and commercial terms.
* **One-Click Dispatch**: Direct email distribution via secure SMTP with automatic PDF attachments and delivery timestamps.

### 🧾 5. GST Tax & Proforma Invoicing
* **Statutory Compliance**: Full GST calculations (CGST 9% + SGST 9% / IGST 18%) with Indian Number-to-Words currency conversion.
* **Sequential Numbering**: Standardized corporate invoice sequences (`QTIPL/YYYY-YY/XXXX`).
* **Proforma Invoices**: Interim billing, milestones, and partial payment schedules with downloadable proforma PDFs.
* **Digital Authentication**: Embedded authorized signatory stamps, company seal, and bank remittance credentials.

### 💰 6. Compensation, Sales Targets & Payroll
* **Target Management**: Monthly revenue benchmarks and tracking for individual sales reps.
* **Commission Engine**: Tiered performance incentives and IT-standard bonus models.
* **Salary Slips**: Base salary breakdowns, attendance/leave deduction accounting, and payslip exports.

### 📅 7. Calendar, Follow-Ups & Task Scheduling
* **Smart Follow-Up Queue**: Timezone-standardized follow-up reminders with outcome categorizations.
* **Interactive Calendar**: Unified view for upcoming client meetings, proposal deadlines, and follow-ups.
* **Activity Ledger**: Granular audit log of user activities, phone calls, and schedule updates.

### 🔐 8. Enterprise Security & Access Control (RBAC)
* **Tiered User Roles**: `ADMIN`, `MANAGER`, and `SALES_EXECUTIVE` with strict API route authorization.
* **Stateless Authentication**: Cryptographically signed JSON Web Tokens (JWT) with HTTP Bearer authorization.
* **Password Security**: Adaptive salted password hashing using `bcrypt`.

---

## 🛠️ Technology Stack

| Layer | Technology | Key Libraries |
| :--- | :--- | :--- |
| **Frontend** | React 19, Vite 6, Modern ESM | Tailwind CSS 4, React Router 7, Recharts, Lucide Icons, jsPDF |
| **Backend** | Node.js (v18+), Express 5 | pg (PostgreSQL Pool), JWT, Bcrypt, Nodemailer, CORS, Dotenv |
| **Database** | PostgreSQL (v15+) | Managed on Supabase / AWS RDS / Self-hosted PostgreSQL |
| **Integrations** | Webhooks & SMTP | Meta Graph API, LinkedIn Lead Gen, Secure SMTP Mailer |

---

## 📂 Project Architecture

```
QIRO-CRM/
├── backend/                        # Express 5 REST API Server
│   ├── src/
│   │   ├── config/                 # Database pool (pg) & automated schema migrations
│   │   │   └── db.js
│   │   ├── controllers/            # Business logic handlers
│   │   │   ├── authController.js
│   │   │   ├── customerController.js
│   │   │   ├── dealController.js
│   │   │   ├── leadController.js
│   │   │   ├── quotationController.js
│   │   │   ├── salaryController.js
│   │   │   ├── salesController.js
│   │   │   └── ...
│   │   ├── middleware/             # JWT auth & RBAC authorization
│   │   │   ├── authMiddleware.js
│   │   │   └── roleMiddleware.js
│   │   ├── routes/                 # Express API routing tables
│   │   ├── utils/                  # GST calculations, formatting helpers
│   │   ├── app.js                  # Application entry point & schema bootstrap
│   │   └── seedDemoData.js         # Optional seed data utility
│   ├── .env.example                # Backend environment template
│   └── package.json
│
├── frontend/                       # React 19 Single Page Application
│   ├── public/                     # Static assets & official brand logos
│   │   └── qiro_full_logo.png
│   ├── src/
│   │   ├── components/             # Reusable UI components & dialogs
│   │   ├── lib/                    # API client, PDF generators, docLayout
│   │   │   ├── api.js              # Fetch client with JWT interceptor
│   │   │   ├── docLayout.js        # Core invoice/proforma vector styling
│   │   │   ├── proforma.js         # Proforma invoice PDF generator
│   │   │   ├── qiroLogo.js         # Embedded brand vector/base64 asset
│   │   │   └── quotation.js        # Multi-page corporate quotation PDF generator
│   │   ├── pages/                  # Route views (Dashboard, Leads, Invoices, etc.)
│   │   ├── App.jsx                 # Routing hierarchy & layouts
│   │   └── main.jsx                # DOM root mounting
│   ├── package.json
│   └── vite.config.js
│
└── README.md                       # Repository documentation
```

---

## 🚀 Getting Started

### Prerequisites
* **Node.js**: `v18.x` or higher
* **npm**: `v9.x` or higher
* **PostgreSQL Database**: PostgreSQL 14+ instance (Supabase, Neon, AWS RDS, or local)

---

### 1. Backend Installation & Setup

1. **Navigate to the backend directory**:
   ```bash
   cd backend
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Configure environment variables**:
   Create a `.env` file in `backend/` by copying `.env.example`:
   ```bash
   cp .env.example .env
   ```

   Configure the required variables:
   ```env
   PORT=5000
   DATABASE_URL=postgresql://postgres:password@host:5432/dbname
   JWT_SECRET=your_super_secret_jwt_key_here

   # SMTP Configuration (for Quotation & Invoice emails)
   SMTP_HOST=smtp.gmail.com
   SMTP_PORT=587
   SMTP_SECURE=false
   SMTP_USER=commercial@qirotec.com
   SMTP_PASS=your_smtp_app_password
   SMTP_FROM="Qiro Tech Innovation" <commercial@qirotec.com>

   # Optional Meta & LinkedIn Webhook Ingestion
   META_VERIFY_TOKEN=your_meta_webhook_token
   META_PAGE_ACCESS_TOKEN=your_meta_page_access_token
   META_APP_SECRET=your_meta_app_secret
   ```

4. **Start the backend server**:
   ```bash
   # Development mode with nodemon
   npm run dev

   # Production mode
   npm start
   ```
   *The database schema tables and foreign keys initialize automatically on startup via `initSalarySchema()`, `initQuotationSchema()`, `initSalesGstSchema()`, and `initTimezoneSchema()`.*

---

### 2. Frontend Installation & Setup

1. **Navigate to the frontend directory**:
   ```bash
   cd ../frontend
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Configure environment variables (optional)**:
   Create a `.env` file in `frontend/` if connecting to a custom backend URL:
   ```env
   VITE_API_URL=http://localhost:5000/api
   ```
   *(Defaults to `/api` proxy when running through Vite development server).*

4. **Launch development server**:
   ```bash
   npm run dev
   ```
   Open your browser at `http://localhost:5173`.

5. **Build for production**:
   ```bash
   npm run build
   ```

---

## 📡 API Reference Overview

The backend exposes a structured RESTful API under the `/api` prefix:

| Endpoint | Description | Auth Required |
| :--- | :--- | :---: |
| `POST /api/auth/login` | User authentication & JWT issuance | No |
| `GET /api/dashboard/stats` | Executive KPI statistics & metrics | Yes |
| `GET, POST /api/leads` | Lead listing, filtering, and creation | Yes |
| `GET, PUT /api/leads/:id` | Lead details, status transitions & notes | Yes |
| `GET, POST /api/deals` | Deal pipeline management & stage updates | Yes |
| `GET, POST /api/customers` | Customer accounts & directory records | Yes |
| `GET, POST /api/sales` | Invoices, payments, and GST billing | Yes |
| `GET, POST /api/quotations` | Dynamic quotations & Scope of Work | Yes |
| `POST /api/quotations/:id/send-email` | Email quotation PDF to recipient | Yes |
| `GET, POST /api/salaries` | Salary profiles, targets & compensation | Yes (Admin/Mgr) |
| `GET, POST /api/calendar` | Appointments, schedules & agenda | Yes |
| `GET, POST /api/follow-ups` | Follow-up queue & outcome logging | Yes |
| `GET, POST /api/users` | User management & RBAC administration | Yes (Admin) |
| `POST /api/webhooks/meta` | Inbound Meta Lead Gen webhook receiver | Webhook Signature |
| `POST /api/webhooks/linkedin` | Inbound LinkedIn Lead Gen receiver | Webhook Secret |

---

## 🏢 Corporate Stationery & Remittance Credentials

* **Corporate Legal Entity**: QIRO TECH INNOVATION PRIVATE LIMITED
* **Registered Office**: Office No 602, 6th Floor, The Business AdvantEdge, Near Laxmi Chowk, Marunji Road, Hinjawadi Phase I, Pune, Maharashtra – 411057
* **Contact Email**: [commercial@qirotec.com](mailto:commercial@qirotec.com)
* **Contact Phone**: +91 8623823997
* **GSTIN**: `27AABCQ2268A1ZR`
* **Bank Details**: IDFC FIRST Bank | A/C: `86690868447` | IFSC: `IDFB0043491` | SWIFT: `IDFBINBBMUM`

---

## 🔒 License & Intellectual Property

Copyright © 2026 **QIRO TECH INNOVATION PVT. LTD.** All rights reserved.

This software, source code, and associated documentation files are the proprietary and confidential property of QIRO TECH INNOVATION PVT. LTD. Unauthorized copying, distribution, modification, reverse engineering, or public display of this source code via any medium is strictly prohibited without prior written authorization.
