import { useEffect, useState, type ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { API_BASE } from "../api/base.js";

type AuthState = "loading" | "authed" | "anon";

/**
 * Wrap any route element in <RequireAuth>…</RequireAuth> to gate it behind
 * login. Hits /user/account (session cookie) once; redirects to /login if not
 * authenticated. While checking, renders a lightweight placeholder so the
 * page doesn't flash.
 */
export default function RequireAuth({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>("loading");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`${API_BASE}/user/account`, {
          credentials: "include",
        });
        if (cancelled) return;
        setState(res.ok ? "authed" : "anon");
      } catch {
        if (!cancelled) setState("anon");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (state === "loading") {
    return (
      <div style={{ padding: "2rem", textAlign: "center", color: "var(--text-muted)" }}>
        Checking the manifest…
      </div>
    );
  }

  if (state === "anon") {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}
