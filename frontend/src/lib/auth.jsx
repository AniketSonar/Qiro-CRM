import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { api, getToken, setSession, clearSession, getStoredUser } from "./api";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(getStoredUser);
  const [ready, setReady] = useState(!getToken());

  useEffect(() => {
    if (!getToken()) {
      setReady(true);
      return;
    }
    let alive = true;
    api
      .get("/auth/me")
      .then((res) => {
        if (!alive) return;
        const me = res?.data?.user ?? null;
        if (me) {
          setUser(me);
          setSession(null, me);
        }
      })
      .catch(() => {
        if (!alive) return;
        clearSession();
        setUser(null);
      })
      .finally(() => alive && setReady(true));
    return () => {
      alive = false;
    };
  }, []);

  const login = useCallback(async (email, password) => {
    const res = await api.post("/auth/login", { email, password }, { auth: false });
    const token = res?.data?.token;
    const me = res?.data?.user ?? null;
    if (!token) throw new Error("Login failed — no token returned");
    setSession(token, me);
    setUser(me);
    return me;
  }, []);

  const logout = useCallback(async () => {
    try {
      await api.post("/auth/logout", {});
    } catch {
      /* ignore */
    }
    clearSession();
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, ready, login, logout, setUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}

export function RequireAuth({ children }) {
  const { user, ready } = useAuth();
  const location = useLocation();

  if (!ready) {
    return (
      <div className="grid min-h-screen place-items-center text-sm text-muted-foreground">
        Loading your workspace…
      </div>
    );
  }
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  return children;
}

export function RequireAdmin({ children }) {
  const { user } = useAuth();
  if (String(user?.role ?? "").toUpperCase() !== "ADMIN") return <Navigate to="/" replace />;
  return children;
}
