import { createFileRoute, Outlet, Link, useNavigate } from "@tanstack/react-router";
import { Bell, Heart, Search, LogOut } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/auth-context";
import { isAppAccessReady, useRequireMatchmaker } from "@/hooks/use-auth-redirects";
import { cn } from "@/lib/utils";
import { Logo } from "@/components/ui/logo";
import { Button } from "@/components/ui/button";
import { Avatar } from "@/components/ui/avatar";
import { RouterPending } from "@/components/router-fallbacks";

export const Route = createFileRoute("/_app")({
  component: AppLayout,
});

const NAV_ITEMS = [
  { to: "/search", icon: Search, label: "Search" },
  { to: "/favourites", icon: Heart, label: "Favourites" },
] as const;

function AppLayout() {
  const auth = useRequireMatchmaker();

  if (!isAppAccessReady(auth)) {
    return <RouterPending />;
  }

  return <AppShell />;
}

function AppShell() {
  const { matchmaker } = useAuth();
  const navigate = useNavigate();
  const initials =
    [matchmaker?.first_name?.[0], matchmaker?.last_name?.[0]].filter(Boolean).join("") || "M";

  async function signOut() {
    await supabase.auth.signOut();
    await navigate({ to: "/login" });
  }

  return (
    <div className="flex min-h-dvh flex-col bg-background">
      <header className="sticky top-0 z-50 border-b border-border glass-panel">
        <div className="mx-auto flex h-14 max-w-[1600px] items-center gap-6 px-4 sm:px-6">
          <Link to="/search" className="shrink-0">
            <Logo size="sm" className="items-start!" />
          </Link>

          <nav className="flex flex-1 items-center gap-1">
            {NAV_ITEMS.map(({ to, icon: Icon, label }) => (
              <NavLink key={to} to={to} icon={<Icon className="h-4 w-4" />} label={label} />
            ))}
          </nav>

          <div className="flex items-center gap-1">
            <NotificationsButton />
            <Link
              to="/settings"
              className="flex items-center gap-2 rounded-lg px-2 py-1.5 transition-colors hover:bg-accent"
              aria-label="Settings"
            >
              <Avatar
                src={null}
                alt={matchmaker?.first_name ?? "User"}
                fallback={initials}
                size="sm"
              />
            </Link>
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={signOut}
              aria-label="Sign out"
            >
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>

      <main className="flex-1">
        <Outlet />
      </main>
    </div>
  );
}

function NavLink({
  to,
  icon,
  label,
}: {
  to: string;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <Link
      to={to}
      className={cn(
        "relative flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground",
        "transition-colors duration-150 hover:bg-accent hover:text-foreground",
        "[&.active]:text-foreground [&.active]:bg-accent/80",
        "[&.active]:after:absolute [&.active]:after:bottom-0 [&.active]:after:left-3 [&.active]:after:right-3 [&.active]:after:h-0.5 [&.active]:after:rounded-full [&.active]:after:bg-primary"
      )}
      activeProps={{ className: "active" }}
    >
      {icon}
      <span className="hidden sm:inline">{label}</span>
    </Link>
  );
}

function NotificationsButton() {
  return (
    <Link to="/notifications">
      <Button variant="ghost" size="icon-sm" className="relative" aria-label="Notifications">
        <Bell className="h-4 w-4" />
        <UnreadDot />
      </Button>
    </Link>
  );
}

function UnreadDot() {
  const { matchmaker } = useAuth();
  const { data: count = 0 } = useQuery({
    queryKey: ["unread-notifications", matchmaker?.id],
    enabled: !!matchmaker?.id,
    refetchInterval: 60_000,
    queryFn: async () => {
      const { count } = await supabase
        .from("matchmaker_notifications")
        .select("id", { count: "exact", head: true })
        .eq("matchmaker_id", matchmaker!.id)
        .eq("read", false);
      return count ?? 0;
    },
  });

  if (!count) return null;
  return (
    <span className="absolute right-1.5 top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground ring-2 ring-sidebar">
      {count > 9 ? "9+" : count}
    </span>
  );
}
