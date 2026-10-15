import type { Session } from "@supabase/supabase-js";
import { useQueryClient } from "@tanstack/react-query";
import { createContext, type ReactNode, useCallback, useContext, useEffect, useRef, useState } from "react";
import { clearRecipesApiCache } from "../lib/cache-names";
import { supabase } from "../lib/supabase";
import type { Member } from "../lib/types";

export interface AuthState {
  loading: boolean;
  session: Session | null;
  member: Member | null;
  error: string | null;
  retry(): void;
  signOut(): Promise<void>;
}

export const AuthContext = createContext<AuthState | null>(null);

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth outside AuthProvider");
  return ctx;
}

export const AUTH_LOAD_ERROR = "לא הצלחנו לטעון את החשבון";

export function AuthProvider({ children }: { children: ReactNode }) {
  // Rendered inside QueryClientProvider (main.tsx): one user's cached queries must never reach the next.
  const queryClient = useQueryClient();
  const [session, setSession] = useState<Session | null>(null);
  const [member, setMember] = useState<Member | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const requestId = useRef(0);
  const userId = useRef<string | null>(null);
  const sessionRef = useRef<Session | null>(null);

  const load = useCallback(async (s: Session | null) => {
    const id = ++requestId.current;
    const latest = () => id === requestId.current;
    sessionRef.current = s;
    userId.current = s?.user.id ?? null;
    setSession(s);
    try {
      if (!s) {
        setMember(null);
        setError(null);
        return;
      }
      // members.email is not readable by members (column grants, backend hardening migration) — take it from the session.
      const { data, error: qErr } = await supabase
        .from("members")
        .select("id, display_name, role")
        .eq("id", s.user.id)
        .maybeSingle();
      if (!latest()) return;
      if (qErr) {
        setMember(null);
        setError(AUTH_LOAD_ERROR);
        return;
      }
      setError(null);
      setMember(data ? { ...(data as Omit<Member, "email">), email: s.user.email ?? "" } : null);
    } catch {
      if (latest()) {
        setMember(null);
        setError(AUTH_LOAD_ERROR);
      }
    } finally {
      if (latest()) setLoading(false);
    }
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(
      ({ data }) => load(data.session),
      () => {
        requestId.current++;
        setError(AUTH_LOAD_ERROR);
        setLoading(false);
      },
    );
    const { data: sub } = supabase.auth.onAuthStateChange((event, s) => {
      if (event === "TOKEN_REFRESHED" || (s?.user.id ?? null) === userId.current) {
        // same user: don't tear the app down, just keep the fresh session
        sessionRef.current = s;
        setSession(s);
        return;
      }
      // a different user replaces a previous one: drop the offline API cache and the query cache
      // (not on the very first load)
      if (userId.current !== null) {
        void clearRecipesApiCache();
        queryClient.clear();
      }
      userId.current = s?.user.id ?? null;
      setLoading(true);
      // defer: supabase-js forbids awaiting its own calls inside this callback
      setTimeout(() => load(s), 0);
    });
    return () => {
      requestId.current++;
      sub.subscription.unsubscribe();
    };
  }, [load, queryClient]);

  const retry = useCallback(() => {
    setLoading(true);
    setError(null);
    void load(sessionRef.current);
  }, [load]);

  const value: AuthState = {
    loading, session, member, error, retry,
    signOut: async () => {
      await supabase.auth.signOut();
      queryClient.clear();
      await clearRecipesApiCache();
    },
  };
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
