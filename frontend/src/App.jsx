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
import Notifications from "./pages/Notifications";
import Profile from "./pages/Profile";
import Agenda from "./pages/Agenda";
import Login from "./pages/Login";
import { AuthProvider, RequireAuth, RequireAdmin } from "./lib/auth";

const TITLES = {
  "/": "Qiro CRM \u2014 Sales Pipeline Dashboard",
  "/leads": "Leads \u2014 Qiro CRM",
  "/pipeline": "Pipeline board \u2014 Qiro CRM",
  "/follow-ups": "Follow-ups \u2014 Qiro CRM",
  "/deals": "Deals \u2014 Qiro CRM",
  "/customers": "Customers \u2014 Qiro CRM",
  "/contacts": "Contacts \u2014 Qiro CRM",
  "/activities": "Activity log \u2014 Qiro CRM",
  "/sales": "Sales & invoices \u2014 Qiro CRM",
  "/reports": "Reports \u2014 Qiro CRM",
  "/users": "Users & roles \u2014 Qiro CRM",
  "/notifications": "Notifications \u2014 Qiro CRM",
  "/profile": "My profile \u2014 Qiro CRM",
  "/agenda": "Agenda \u2014 Qiro CRM",
  "/login": "Sign in \u2014 Qiro CRM"
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
        <Route path="/customers" element={<RequireAuth><Customers /></RequireAuth>} />
        <Route path="/contacts" element={<RequireAuth><Contacts /></RequireAuth>} />
        <Route path="/activities" element={<RequireAuth><Activities /></RequireAuth>} />
        <Route path="/sales" element={<RequireAuth><Sales /></RequireAuth>} />
        <Route path="/reports" element={<RequireAuth><Reports /></RequireAuth>} />
        <Route path="/users" element={<RequireAuth><RequireAdmin><Users /></RequireAdmin></RequireAuth>} />
        <Route path="/notifications" element={<RequireAuth><Notifications /></RequireAuth>} />
        <Route path="/profile" element={<RequireAuth><Profile /></RequireAuth>} />
        <Route path="/agenda" element={<RequireAuth><Agenda /></RequireAuth>} />
      </Routes>
    </AuthProvider>
  );
}
