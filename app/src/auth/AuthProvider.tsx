import type { Session } from "@supabase/supabase-js";
import { createContext, type ReactNode, useContext, useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import type { Member } from "../lib/types";

export interface AuthState {
  loading: boolean;
  session: Session | null;
  member: Member | null;
  signOut(): Promise<void>;
}

export const AuthContext = createContext<AuthState | null>(null);

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth outside AuthProvider");
  return ctx;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [member, setMember] = useState<Member | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load(s: Session | null) {
      setSession(s);
      if (!s) {
        setMember(null);
        setLoading(false);
        return;
      }
      // members.email is not readable by members (column grants, backend hardening migration) — take it from the session.
      const { data } = await supabase.from("members").select("id, display_name, role").eq("id", s.user.id).maybeSingle();
      if (!cancelled) {
        setMember(data ? { ...(data as Omit<Member, "email">), email: s.user.email ?? "" } : null);
        setLoading(false);
      }
    }
    supabase.auth.getSession().then(({ data }) => load(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
      setLoading(true);
      // defer: supabase-js forbids awaiting its own calls inside this callback
      setTimeout(() => load(s), 0);
    });
    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, []);

  const value: AuthState = {
    loading, session, member,
    signOut: async () => {
      await supabase.auth.signOut();
    },
  };
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
