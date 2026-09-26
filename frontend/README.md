# Qiro CRM — refreshed UI (JSX)

Same stack you were using: **React 19 + Vite + react-router-dom**, plain `.jsx` files.
Styling is Tailwind CSS v4 (via `@tailwindcss/vite`) with an oklch design-token system in
`src/styles.css`; charts use `recharts`; icons use `lucide-react`.

## Run

```bash
cd frontend
npm install
npm run dev        # http://localhost:5173
```

Backend (unchanged, from your original project):

```bash
cd backend
npm install
npm run dev
```

`vite.config.js` proxies `/api` to `http://localhost:5000` — change the target if your
Express server listens elsewhere.

## Structure

```
src/
  main.jsx                 app entry (BrowserRouter)
  App.jsx                  routes + per-page document titles
  styles.css               design system (all colors/gradients/shadows as tokens)
  components/crm/
    AppShell.jsx           navy nav rail + topbar + page header, table primitives
    ui-bits.jsx            StatCard, Panel, Chip, Avatar, tone helpers
  lib/
    crm-data.js            sample data for every screen
    utils.js               cn() class merger
  pages/                   Dashboard, Leads, Pipeline, FollowUps, Deals, Customers,
                           Contacts, Activities, Sales, Reports, Users, Notifications,
                           Profile, Agenda, Login
```

## Wiring your API back in

Every page reads from `src/lib/crm-data.js`. Replace those imports with your axios calls
(`src/services/api.js` in your original repo) keeping the same field names, and the UI
works unchanged. Example:

```jsx
const [leads, setLeads] = useState([]);
useEffect(() => { api.get("/leads").then((r) => setLeads(r.data)); }, []);
```

## Design rules

- Never hardcode colors in components — add a token to `src/styles.css` and use the
  generated utility (`bg-primary`, `text-success`, `rail-surface`, `panel`, ...).
- Fonts: `Plus Jakarta Sans` (display) + `Manrope` (body), loaded in `index.html`.
