import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../lib/auth";
import { Eye, EyeOff, Lock, Mail } from "lucide-react";

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
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

  return (
    <main className="h-screen w-full overflow-hidden bg-[#e9edf9] p-1.5 pb-2 sm:p-2 sm:pb-3 lg:p-3 lg:pb-5">
      <div className="mx-auto flex h-[calc(100vh-0.5rem)] w-full max-w-[1460px] overflow-hidden rounded-[30px] border border-white/40 bg-[#4b6ef5] shadow-[0_25px_60px_rgba(53,58,119,0.2)] sm:h-[calc(100vh-0.75rem)] lg:h-[calc(100vh-1.75rem)]">
        <div className="grid h-full w-full lg:grid-cols-[1.03fr_1fr]">
          <section className="relative hidden overflow-hidden bg-[linear-gradient(135deg,#5a7ae7_0%,#4d6fe5_30%,#4c7fe8_100%)] p-6 lg:flex lg:flex-col lg:justify-between">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_15%_20%,rgba(255,255,255,0.12),transparent_20%),radial-gradient(circle_at_80%_78%,rgba(109,212,235,0.2),transparent_18%),linear-gradient(180deg,rgba(255,255,255,0.05),transparent_30%,rgba(0,0,0,0.06))]" />
            <div className="absolute -top-2 left-2 h-[1700px] w-[1700px] rounded-[38%] bg-white/8 blur-[2px]" /> 
            <div className="relative z-10 flex items-center gap-3 pt-2">
              <img src="/qiro_logo.png" alt="QIRO CRM logo" className="h-14 w-14 object-contain drop-shadow-[0_8px_20px_rgba(255,255,255,0.18)]" />
              <p className="font-display text-[1.7rem] font-black tracking-[-0.06em] text-white">QIRO CRM</p>
            </div>

            <div className="relative z-10 max-w-[470px] pb-6 text-white">
              <h2 className="font-display text-[clamp(2.9rem,3vw,5.2rem)] font-black leading-[1] tracking-[-0.06em] text-white">
                Every lead followed up. Every deal accounted for.
              </h2>

              <p className="mt-6 max-w-[430px] text-[clamp(1rem,1.7vw,1.15rem)] leading-relaxed text-white/80">
                A CRM shaped around the four steps your team actually runs — capture, follow up, develop, convert.
              </p>
            </div>
          </section>

          <section className="relative flex items-center justify-center bg-[#f4f5fb] px-5 py-8 sm:px-8 lg:px-10">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(151,180,255,0.18),_transparent_28%),radial-gradient(circle_at_bottom_right,_rgba(102,208,235,0.24),_transparent_26%)]" />

            <div className="relative z-10 w-full max-w-[560px] rounded-[30px] border border-white/60 bg-[#f6f3fa]/90 p-5 shadow-[0_26px_54px_rgba(38,47,109,0.08)] lg:p-7">
              

              <h1 className="text-center font-display text-[2.3rem] font-black leading-none tracking-[-0.05em] text-[#2c2c62]">
                Welcome back
              </h1>

              <form className="mt-6 space-y-4" onSubmit={onSubmit}>
                <div>
                  <label htmlFor="email" className="mb-2 block text-base font-medium text-[#3f3d5e]">
                    Email
                  </label>
                  <div className="relative">
                    <Mail className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-[#7c7a98]" />
                    <input
                      id="email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      autoComplete="email"
                      placeholder="Enter your email address"
                      className="h-14 w-full rounded-2xl border border-[#dfe4f8] bg-white/90 pl-12 pr-4 text-base text-[#2d2d52] outline-none transition placeholder:text-[#8d8da8] focus:border-[#6c87f2] focus:shadow-[0_0_0_3px_rgba(108,135,242,0.12)]"
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="password" className="mb-2 block text-base font-medium text-[#3f3d5e]">
                    Password
                  </label>
                  <div className="relative">
                    <Lock className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-[#7c7a98]" />
                    <input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      autoComplete="current-password"
                      placeholder="••••••••••"
                      className="h-14 w-full rounded-2xl border border-[#dfe4f8] bg-white/90 pl-12 pr-12 text-base text-[#2d2d52] outline-none transition placeholder:text-[#8d8da8] focus:border-[#6c87f2] focus:shadow-[0_0_0_3px_rgba(108,135,242,0.12)]"
                    />
                    <button
                      type="button"
                      aria-label={showPassword ? "Hide password" : "Show password"}
                      onClick={() => setShowPassword((value) => !value)}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-[#6a6a82] transition hover:text-[#2d2d52]"
                    >
                      {showPassword ? <EyeOff className="size-5" /> : <Eye className="size-5" />}
                    </button>
                  </div>
                </div>

                {error ? (
                  <p className="rounded-xl border border-[#f9c7c1] bg-[#fff1f0] px-3 py-2 text-sm font-medium text-[#c64d49]">
                    {error}
                  </p>
                ) : null}

                <button
                  type="submit"
                  disabled={busy}
                  className="inline-flex h-14 w-full items-center justify-center rounded-2xl bg-gradient-to-r from-[#668ef0] to-[#63c8e8] text-base font-bold text-white shadow-[0_12px_28px_rgba(86,126,247,0.35)] transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {busy ? "Logging in..." : "Login"}
                </button>

                <p className="mt-2 text-center text-sm text-[#4c527a]">
                  Need an account? Ask your administrator to invite you.
                </p>
              </form>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
