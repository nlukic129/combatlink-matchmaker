import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { Bell, ChevronDown, Heart, LogOut, Search, Settings } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/auth-context";
import { cn } from "@/lib/utils";
import { Logo } from "@/components/ui/logo";
import { Button } from "@/components/ui/button";
import { Avatar } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const NAV_ITEMS = [
  { to: "/search/setup", label: "Search", icon: Search, match: (path: string) => path.startsWith("/search") },
  { to: "/favourites", label: "Favourites", icon: Heart, match: (path: string) => path.startsWith("/favourites") },
] as const;

export function AppHeader() {
  const { matchmaker } = useAuth();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const navigate = useNavigate();

  const displayName = [matchmaker?.first_name, matchmaker?.last_name].filter(Boolean).join(" ") || "Matchmaker";
  const initials =
    [matchmaker?.first_name?.[0], matchmaker?.last_name?.[0]].filter(Boolean).join("") || "M";

  async function signOut() {
    await supabase.auth.signOut();
    await navigate({ to: "/login" });
  }

  return (
    <header className="app-header sticky top-0 z-50 bg-background/88 backdrop-blur-xl">
      <div className="mx-auto grid h-14 max-w-[1600px] grid-cols-[1fr_auto_1fr] items-center gap-4 px-4 sm:px-6">

        {/* Logo */}
        <Link to="/search/setup" className="min-w-0 justify-self-start">
          <Logo size="sm" variant="brand" productLabel className="items-start!" />
        </Link>

        {/* Nav — flat, no pill container */}
        <nav className="inline-flex items-stretch" aria-label="Main navigation">
          {NAV_ITEMS.map(({ to, label, icon: Icon, match }) => {
            const active = match(pathname);
            return (
              <Link
                key={to}
                to={to}
                className={cn(
                  "app-header-nav-item relative inline-flex items-center gap-1.5 px-4 py-2 text-[13px] font-medium transition-colors duration-150",
                  active
                    ? "text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                )}
                aria-current={active ? "page" : undefined}
              >
                <Icon
                  className={cn(
                    "h-3.5 w-3.5 shrink-0 transition-colors duration-150",
                    active ? "text-primary" : ""
                  )}
                  aria-hidden
                />
                <span className="hidden sm:inline">{label}</span>
                {active && <span className="app-header-active-bar" aria-hidden />}
              </Link>
            );
          })}
        </nav>

        {/* Right: notifications + user */}
        <div className="flex items-center justify-end gap-0.5 justify-self-end">
          <NotificationsButton />
          <UserMenu
            displayName={displayName}
            organization={matchmaker?.organization}
            initials={initials}
            onSignOut={signOut}
          />
        </div>
      </div>
    </header>
  );
}

function UserMenu({
  displayName,
  organization,
  initials,
  onSignOut,
}: {
  displayName: string;
  organization?: string | null;
  initials: string;
  onSignOut: () => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="flex items-center gap-1.5 rounded-lg px-2 py-1.5 transition-colors duration-150 hover:bg-white/[0.06] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          aria-label="Account menu"
        >
          <Avatar src={null} alt={displayName} fallback={initials} size="sm" />
          <ChevronDown className="hidden h-3.5 w-3.5 text-muted-foreground/70 sm:block" aria-hidden />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="font-normal">
          <p className="truncate text-sm font-medium text-foreground">{displayName}</p>
          {organization && (
            <p className="truncate text-xs text-muted-foreground">{organization}</p>
          )}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link to="/settings">
            <Settings className="h-4 w-4" />
            Settings
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          className="text-destructive focus:bg-destructive/10 focus:text-destructive"
          onSelect={() => void onSignOut()}
        >
          <LogOut className="h-4 w-4" />
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
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
    <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground ring-2 ring-background">
      {count > 9 ? "9+" : count}
    </span>
  );
}
