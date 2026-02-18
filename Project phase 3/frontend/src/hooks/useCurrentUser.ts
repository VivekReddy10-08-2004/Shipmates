import { useEffect, useState } from "react";
import { API_BASE } from "../api/base.js";

export default function useCurrentUser() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError("");
      try {
        const res = await fetch(`${API_BASE}/user/account`, {
          credentials: "include",
        });

        if (!res.ok) {
          throw new Error("Not logged in");
        }

        const data = await res.json();
        if (!cancelled) {
          setUser(data.user || data);
        }
      } catch (err) {
        if (!cancelled) {
          setUser(null);
          if (err instanceof Error){  // had to add a check here, since it doesn't like it when err is unknown - Rise
            setError(err.message);
          }
          else {
            setError("Failed to load user");
          }
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  return { user, loading, error };
}
