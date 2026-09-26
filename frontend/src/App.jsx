import { Routes, Route, useLocation } from "react-router-dom";
import { useEffect } from "react";
import Dashboard from "./pages/Dashboard";
import Leads from "./pages/Leads";
import LeadDetail from "./pages/LeadDetail";
import Pipeline from "./pages/Pipeline";
import FollowUps from "./pages/FollowUps";
import Deals from "./pages/Deals";
import Customers from "./pages/Customers";
import Contacts from "./pages/Contacts";
import Activities from "./pages/Activities";
import Sales from "./pages/Sales";
import Reports from "./pages/Reports";
import Users from "./pages/Users";
import LeaveManagement from "./pages/LeaveManagement";
import Calendar from "./pages/Calendar";
import Notifications from "./pages/Notifications";
import Profile from "./pages/Profile";
import Agenda from "./pages/Agenda";
import Compensation from "./pages/Compensation";
import Quotations from "./pages/Quotations";
import Login from "./pages/Login";
import { AuthProvider, RequireAuth, RequireAdmin } from "./lib/auth";

const TITLES = {
  "/": "Qiro CRM — Sales Pipeline Dashboard",
  "/leads": "Leads — Qiro CRM",
  "/pipeline": "Pipeline board — Qiro CRM",
  "/follow-ups": "Follow-ups — Qiro CRM",
  "/deals": "Deals — Qiro CRM",
  "/quotations": "Quotations & Proposals — Qiro CRM",
  "/customers": "Customers — Qiro CRM",
  "/contacts": "Contacts — Qiro CRM",
  "/activities": "Activity log — Qiro CRM",
  "/sales": "Sales & invoices — Qiro CRM",
  "/compensation": "Compensation & Targets — Qiro CRM",
  "/reports": "Reports — Qiro CRM",
  "/users": "Users & roles — Qiro CRM",
  "/notifications": "Notifications — Qiro CRM",
  "/calendar": "Calendar — Qiro CRM",
  "/profile": "My profile — Qiro CRM",
  "/agenda": "Agenda — Qiro CRM",
  "/login": "Sign in — Qiro CRM"
};

function TitleSync() {
  const { pathname } = useLocation();
  useEffect(() => {
    document.title = TITLES[pathname] ?? "Qiro CRM";
  }, [pathname]);
  return null;
}

export default function App() {
  return (
    <AuthProvider>
      <TitleSync />
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/" element={<RequireAuth><Dashboard /></RequireAuth>} />
        <Route path="/leads" element={<RequireAuth><Leads /></RequireAuth>} />
        <Route path="/leads/:id" element={<RequireAuth><LeadDetail /></RequireAuth>} />
        <Route path="/pipeline" element={<RequireAuth><Pipeline /></RequireAuth>} />
        <Route path="/follow-ups" element={<RequireAuth><FollowUps /></RequireAuth>} />
        <Route path="/deals" element={<RequireAuth><Deals /></RequireAuth>} />
        <Route path="/quotations" element={<RequireAuth><Quotations /></RequireAuth>} />
        <Route path="/customers" element={<RequireAuth><Customers /></RequireAuth>} />
        <Route path="/contacts" element={<RequireAuth><Contacts /></RequireAuth>} />
        <Route path="/activities" element={<RequireAuth><Activities /></RequireAuth>} />
        <Route path="/sales" element={<RequireAuth><Sales /></RequireAuth>} />
        <Route path="/compensation" element={<RequireAuth><Compensation /></RequireAuth>} />
        <Route path="/reports" element={<RequireAuth><Reports /></RequireAuth>} />
        <Route path="/users" element={<RequireAuth><RequireAdmin><Users /></RequireAdmin></RequireAuth>} />
        <Route path="/leave" element={<RequireAuth><LeaveManagement /></RequireAuth>} />
        <Route path="/calendar" element={<RequireAuth><Calendar /></RequireAuth>} />
        <Route path="/notifications" element={<RequireAuth><Notifications /></RequireAuth>} />
        <Route path="/profile" element={<RequireAuth><Profile /></RequireAuth>} />
        <Route path="/agenda" element={<RequireAuth><Agenda /></RequireAuth>} />
      </Routes>
    </AuthProvider>
  );
}
