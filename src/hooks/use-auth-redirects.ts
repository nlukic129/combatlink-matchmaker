import { useEffect, useRef } from "react";
import { useNavigate, useRouterState } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/auth-context";

/** Protects authenticated app routes without blocking the router in beforeLoad. */
export function useRequireMatchmaker() {
  const auth = useAuth();
  const navigate = useNavigate();
  const { pathname, href } = useRouterState({
    select: (s) => ({
      pathname: s.location.pathname,
      href: s.location.href,
    }),
  });
  const redirectingRef = useRef(false);

  useEffect(() => {
    if (auth.loading || pathname === "/login") return;

    if (!auth.session) {
      if (redirectingRef.current) return;
      redirectingRef.current = true;
      void navigate({
        to: "/login",
        search: { redirect: href },
        replace: true,
      });
      return;
    }

    redirectingRef.current = false;

    if (!auth.matchmaker) {
      void supabase.auth.signOut().then(() => {
        void navigate({ to: "/login", replace: true });
      });
      return;
    }

    if (auth.matchmaker.must_change_password) {
      void navigate({ to: "/change-password", search: { first: "true" }, replace: true });
    }
  }, [auth.loading, auth.session, auth.matchmaker, href, navigate, pathname]);

  return auth;
}

/** Sends signed-in matchmakers away from the login page. */
export function useRedirectIfAuthenticated() {
  const auth = useAuth();
  const navigate = useNavigate();
  const redirectingRef = useRef(false);

  useEffect(() => {
    if (auth.loading) return;
    if (!auth.session) {
      redirectingRef.current = false;
      return;
    }

    if (!auth.matchmaker) {
      void supabase.auth.signOut();
      return;
    }

    if (redirectingRef.current) return;
    redirectingRef.current = true;

    void navigate({
      to: auth.matchmaker.must_change_password ? "/change-password" : "/search/setup",
      replace: true,
    });
  }, [auth.loading, auth.session, auth.matchmaker, navigate]);

  return auth;
}

/** Requires any authenticated user (password change flow). */
export function useRequireAuthenticatedUser() {
  const auth = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (auth.loading) return;
    if (!auth.session) {
      void navigate({ to: "/login", replace: true });
    }
  }, [auth.loading, auth.session, navigate]);

  return auth;
}

export function isAppAccessReady(auth: ReturnType<typeof useAuth>) {
  return (
    !auth.loading &&
    !!auth.session &&
    !!auth.matchmaker &&
    !auth.matchmaker.must_change_password
  );
}

export function isGuestReady(auth: ReturnType<typeof useAuth>) {
  return !auth.loading && !auth.session;
}

export function isAuthenticatedUserReady(auth: ReturnType<typeof useAuth>) {
  return !auth.loading && !!auth.session;
}
