import { createContext, useContext, useEffect, useState } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import type { Matchmaker } from "@/types/database";

const AUTH_BOOT_TIMEOUT_MS = 5_000;

type AuthState = {
  session: Session | null;
  user: User | null;
  matchmaker: Matchmaker | null;
  loading: boolean;
};

const AuthContext = createContext<AuthState>({
  session: null,
  user: null,
  matchmaker: null,
  loading: true,
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthState>({
    session: null,
    user: null,
    matchmaker: null,
    loading: true,
  });

  useEffect(() => {
    let active = true;
    let bootstrapped = false;

    async function applySession(session: Session | null) {
      if (!active) return;
      bootstrapped = true;

      if (!session) {
        setState({ session: null, user: null, matchmaker: null, loading: false });
        return;
      }

      const matchmaker = await loadMatchmaker(session.user.id);
      if (!active) return;

      setState({
        session,
        user: session.user,
        matchmaker,
        loading: false,
      });
    }

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (
        event === "INITIAL_SESSION" ||
        event === "SIGNED_IN" ||
        event === "TOKEN_REFRESHED" ||
        event === "SIGNED_OUT"
      ) {
        void applySession(session);
      }
    });

    const bootTimeout = window.setTimeout(() => {
      if (!active || bootstrapped) return;
      void supabase.auth.getSession().then(({ data: { session } }) => {
        void applySession(session);
      });
    }, AUTH_BOOT_TIMEOUT_MS);

    return () => {
      active = false;
      window.clearTimeout(bootTimeout);
      subscription.unsubscribe();
    };
  }, []);

  return <AuthContext.Provider value={state}>{children}</AuthContext.Provider>;
}

async function loadMatchmaker(userId: string): Promise<Matchmaker | null> {
  const { data } = await supabase.from("matchmakers").select("*").eq("id", userId).maybeSingle();
  return data;
}

export function useAuth() {
  return useContext(AuthContext);
}
