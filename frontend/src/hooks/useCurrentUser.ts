import { useEffect, useState, type Key, type ReactNode } from "react";
import { API_BASE } from "../api/base.js";

export interface User {
  last_name: ReactNode;
  college_level: ReactNode;
  college_name: ReactNode;
  major_name: ReactNode;
  bio: ReactNode;
  first_name: ReactNode; // change types as needed, again. - Rise
  user_id: number;
  email: string;
  username?: string;
}

export interface College {
  course_code: ReactNode;
  course_name: ReactNode;
  course_id: any;
  college_id: number;
  college_name: string;
}

export interface Major {
  major_id: number;
  major_name: string;
}

export interface Course {
  course_id: Key | null | undefined;
  course_code: ReactNode;
  course_name: ReactNode;
  college_name: any;
  
}

export default function useCurrentUser() {
  const [user, setUser] = useState<User | null>(null);
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
