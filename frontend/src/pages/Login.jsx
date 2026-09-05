import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../lib/auth";
import { ArrowRight, Lock, Mail, ShieldCheck, TrendingUp, Users2 } from "lucide-react";
const highlights = [
  { icon: TrendingUp, title: "Pipeline you can trust", body: "Weighted forecasts update as reps move deals." },
  { icon: Users2, title: "One shared customer record", body: "Leads, contacts, activity and invoices in one place." },
  { icon: ShieldCheck, title: "Role-based access", body: "Executives see their book, managers see the team." }
];
export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const onSubmit = async (event) => {
    event.preventDefault();
    setError("");
    setBusy(true);
    try {
      await login(email.trim(), password);
      navigate(location.state?.from ?? "/", { replace: true });
    } catch (err) {
      setError(err.message || "Unable to sign in");
    } finally {
      setBusy(false);
    }
  };

  return <main className="grid min-h-screen lg:grid-cols-[1.05fr_1fr]">
      <section className="rail-surface relative hidden flex-col justify-between p-12 text-rail-foreground lg:flex">
        <div className="flex items-center gap-3">
          <span className="brand-surface grid size-10 place-items-center rounded-xl font-display text-base font-extrabold text-primary-foreground">
            Q
          </span>
          <div>
            <p className="font-display text-base font-extrabold">QIRO CRM</p>
          </div>
        </div>

        <div className="max-w-md">
          <h2 className="font-display text-4xl font-extrabold leading-tight">
            Every lead followed up. Every deal accounted for.
          </h2>
          <p className="mt-4 text-sm leading-relaxed text-rail-muted">
            A CRM shaped around the four steps your team actually runs — capture, follow up, develop,
            convert.
          </p>

          <ul className="mt-10 space-y-5">
            {highlights.map((h) => <li key={h.title} className="flex gap-4">
                <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-rail-hover">
                  <h.icon className="size-4" />
                </span>
                <div>
                  <p className="text-sm font-bold">{h.title}</p>
                  <p className="text-xs text-rail-muted">{h.body}</p>
                </div>
              </li>)}
          </ul>
        </div>

        <p className="text-xs text-rail-muted">© 2026 Qiro Tech · All rights reserved</p>
      </section>

      <section className="flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-sm">
          <h1 className="font-display text-2xl font-extrabold">Welcome back</h1>
          <p className="mt-1.5 text-sm text-muted-foreground">
            Sign in to continue to your pipeline.
          </p>

          <form className="mt-8 space-y-4" onSubmit={onSubmit}>
            <div>
              <label htmlFor="email" className="text-xs font-bold uppercase tracking-[0.12em] text-muted-foreground">
                Work email
              </label>
              <div className="relative mt-2">
                <Mail className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <input
    id="email"
    type="email"
    value={email}
    onChange={(e) => setEmail(e.target.value)}
    required
    autoComplete="email"
    placeholder="you@qirotech.in"
    className="h-11 w-full rounded-xl border border-border bg-card pl-9 pr-3 text-sm outline-none transition-colors focus:border-ring"
  />
              </div>
            </div>

            <div>
              <label htmlFor="password" className="text-xs font-bold uppercase tracking-[0.12em] text-muted-foreground">
                Password
              </label>
              <div className="relative mt-2">
                <Lock className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <input
    id="password"
    type="password"
    value={password}
    onChange={(e) => setPassword(e.target.value)}
    required
    autoComplete="current-password"
    placeholder="••••••••"
    className="h-11 w-full rounded-xl border border-border bg-card pl-9 pr-3 text-sm outline-none transition-colors focus:border-ring"
  />
              </div>
            </div>

            {error ? (
              <p className="rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs font-semibold text-destructive">
                {error}
              </p>
            ) : null}

            <button
    type="submit"
    disabled={busy}
    className="brand-surface inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl text-sm font-bold text-primary-foreground shadow-float transition-transform hover:-translate-y-0.5 disabled:opacity-60"
  >
              {busy ? "Signing in…" : "Sign in"} <ArrowRight className="size-4" />
            </button>
          </form>

          <p className="mt-6 text-center text-xs text-muted-foreground">
            Need an account? Ask your administrator to invite you.
          </p>
        </div>
      </section>
    </main>;
}
