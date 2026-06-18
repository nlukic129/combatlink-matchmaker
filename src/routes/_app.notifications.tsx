import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Bell, CheckCheck, ChevronRight, Heart } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { AvailabilityBadge } from "@/components/ui/availability-badge";
import { NotificationsLoader } from "@/components/loading/page-loaders";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { FighterDrawer } from "@/components/fighter-drawer/fighter-drawer";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_app/notifications")({
  component: NotificationsPage,
});

// ── Types ─────────────────────────────────────────────────────────────────────

type NotificationFighter = {
  id: string;
  first_name: string;
  last_name: string | null;
  nickname: string | null;
  photo_url: string | null;
  availability_status: string;
};

type NotificationMetadata = {
  // fighter_status_changed
  old_status?: string;
  new_status?: string;
  // fighter_price_changed
  tracked_purse_usd?: number;
  new_purse_usd?: number;
  pct_change?: number;
};

type NotificationRow = {
  id: number;
  type: string;
  read: boolean;
  created_at: string;
  metadata: NotificationMetadata | null;
  fighters: NotificationFighter | NotificationFighter[] | null;
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function resolveFighter(row: NotificationRow): NotificationFighter | null {
  if (!row.fighters) return null;
  return Array.isArray(row.fighters) ? row.fighters[0] ?? null : row.fighters;
}

const STATUS_LABELS: Record<string, string> = {
  available: "Available",
  in_camp: "In Camp",
  unavailable: "Unavailable",
};

function formatPurse(usd: number): string {
  return `$${usd.toLocaleString("en-US")}`;
}

function notificationCopy(
  type: string,
  fighter: NotificationFighter,
  metadata: NotificationMetadata | null,
): { headline: string; subline: string } {
  const name = [fighter.first_name, fighter.last_name].filter(Boolean).join(" ");

  if (type === "fighter_available" || !type) {
    return {
      headline: `${name} is available for booking`,
      subline: "You enabled availability alerts for this fighter.",
    };
  }

  if (type === "fighter_status_changed") {
    const newLabel = STATUS_LABELS[metadata?.new_status ?? ""] ?? "Unknown";
    const oldLabel = STATUS_LABELS[metadata?.old_status ?? ""] ?? "Unknown";
    return {
      headline: `${name} is now ${newLabel}`,
      subline: `Status changed from ${oldLabel}.`,
    };
  }

  if (type === "fighter_price_changed") {
    const newPurse = metadata?.new_purse_usd != null ? formatPurse(metadata.new_purse_usd) : "—";
    const oldPurse = metadata?.tracked_purse_usd != null ? formatPurse(metadata.tracked_purse_usd) : "—";
    const pct = metadata?.pct_change;
    const direction = pct != null && pct > 0 ? "up" : "down";
    const pctStr = pct != null ? ` (${pct > 0 ? "+" : ""}${pct}%)` : "";
    return {
      headline: `${name} updated their fight purse`,
      subline: `Now ${newPurse}${pctStr} — was ${oldPurse} when you started tracking them. Price went ${direction}.`,
    };
  }

  if (type === "video_access_approved") {
    return {
      headline: `${name} approved your video access request`,
      subline: "Private fight footage is now unlocked — open their profile to scout inline.",
    };
  }

  return {
    headline: `${name} — update`,
    subline: "New activity on a fighter you’re watching.",
  };
}

function groupNotifications(items: NotificationRow[]) {
  const now = Date.now();
  const today: NotificationRow[] = [];
  const thisWeek: NotificationRow[] = [];
  const earlier: NotificationRow[] = [];

  for (const item of items) {
    const age = now - new Date(item.created_at).getTime();
    if (age < 86_400_000) today.push(item);
    else if (age < 7 * 86_400_000) thisWeek.push(item);
    else earlier.push(item);
  }

  return { today, thisWeek, earlier };
}

// ── Page ──────────────────────────────────────────────────────────────────────

function NotificationsPage() {
  const qc = useQueryClient();
  const [drawerFighterId, setDrawerFighterId] = useState<string | null>(null);

  const { data: notifications = [], isLoading } = useQuery({
    queryKey: ["notifications"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("matchmaker_notifications")
        .select(`
          id, type, read, created_at, metadata,
          fighters (
            id, first_name, last_name, nickname, photo_url, availability_status
          )
        `)
        .order("created_at", { ascending: false })
        .limit(100);

      if (error) throw error;
      return (data ?? []) as unknown as NotificationRow[];
    },
  });

  const items = notifications;

  const markAllRead = useMutation({
    mutationFn: async () => {
      await supabase
        .from("matchmaker_notifications")
        .update({ read: true })
        .eq("read", false);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["notifications"] });
      qc.invalidateQueries({ queryKey: ["unread-notifications"] });
    },
  });

  const markRead = useMutation({
    mutationFn: async (id: number) => {
      await supabase.from("matchmaker_notifications").update({ read: true }).eq("id", id);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["notifications"] });
      qc.invalidateQueries({ queryKey: ["unread-notifications"] });
    },
  });

  const unreadCount = items.filter((n) => !n.read).length;
  const groups = useMemo(() => groupNotifications(items), [items]);

  if (isLoading) {
    return <NotificationsLoader />;
  }

  return (
    <div className="notif-page">
      <div className="notif-inner">
        <header className="notif-header">
          <div>
            <p className="cmp-eyebrow">Inbox</p>
            <h1 className="notif-title">Notifications</h1>
            <p className="notif-subtitle">
              Status changes, price movements, and video access updates from fighters you’re tracking.
            </p>
          </div>
          {unreadCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="notif-mark-all"
              onClick={() => markAllRead.mutate()}
            >
              <CheckCheck className="h-4 w-4" />
              Mark all read
            </Button>
          )}
        </header>

        <div className="notif-insight">
          <span className="notif-insight-dot" aria-hidden />
          <p className="notif-insight-text">
            Saving to favourites turns the bell on automatically. You can also enable the bell without saving — you’ll get an alert here (and by email) on every status change, when their fight purse moves more than 20% from when you started tracking them, or when a fighter approves your video access request.
          </p>
        </div>

        <div className="notif-stats">
          <div className="notif-stat">
            <span className="notif-stat-val">{unreadCount}</span>
            <span className="notif-stat-lbl">Unread</span>
          </div>
          <div className="notif-stat-divider" aria-hidden />
          <div className="notif-stat">
            <span className="notif-stat-val">{items.length}</span>
            <span className="notif-stat-lbl">Total</span>
          </div>
          <div className="notif-stat-divider" aria-hidden />
          <div className="notif-stat notif-stat--wide">
            <span className="notif-stat-lbl">Trigger</span>
            <span className="notif-stat-hint">Status changes · price &gt;20% · video access</span>
          </div>
        </div>

        {items.length === 0 ? (
          <div className="notif-empty">
            <div className="notif-empty-icon" aria-hidden>
              <Bell className="h-8 w-8" />
            </div>
            <h2 className="notif-empty-title">No notifications yet</h2>
            <p className="notif-empty-desc">
              Enable the bell on a fighter profile to get alerts when their status changes, their purse moves significantly, or they approve your video access request.
            </p>
            <Link to="/favourites" className="notif-empty-cta">
              <Heart className="h-4 w-4" />
              Go to favourites
            </Link>
          </div>
        ) : (
          <div className="notif-feed">
            <NotificationGroup
              label="Today"
              items={groups.today}
              onOpen={(id, fighterId, read) => {
                if (!read) markRead.mutate(id);
                setDrawerFighterId(fighterId);
              }}
            />
            <NotificationGroup
              label="This week"
              items={groups.thisWeek}
              onOpen={(id, fighterId, read) => {
                if (!read) markRead.mutate(id);
                setDrawerFighterId(fighterId);
              }}
            />
            <NotificationGroup
              label="Earlier"
              items={groups.earlier}
              onOpen={(id, fighterId, read) => {
                if (!read) markRead.mutate(id);
                setDrawerFighterId(fighterId);
              }}
            />
          </div>
        )}
      </div>

      {drawerFighterId && (
        <FighterDrawer
          fighterId={drawerFighterId}
          onClose={() => setDrawerFighterId(null)}
        />
      )}
    </div>
  );
}

function NotificationGroup({
  label, items, onOpen,
}: {
  label: string;
  items: NotificationRow[];
  onOpen: (id: number, fighterId: string, read: boolean) => void;
}) {
  if (items.length === 0) return null;

  return (
    <section className="notif-group">
      <div className="notif-group-head">
        <h2 className="notif-group-title">{label}</h2>
        <div className="notif-group-line" aria-hidden />
        <span className="notif-group-count">{items.length}</span>
      </div>
      <div className="notif-group-list">
        {items.map((n) => {
          const fighter = resolveFighter(n);
          if (!fighter) return null;
          const copy = notificationCopy(n.type, fighter, n.metadata);

          return (
            <button
              key={n.id}
              type="button"
              className={cn("notif-card", !n.read && "notif-card--unread")}
              onClick={() => onOpen(n.id, fighter.id, n.read)}
            >
              <div className="notif-card-accent" aria-hidden />
              <div className="notif-card-body">
                <div className="notif-card-top">
                  <span className={cn("notif-card-dot-slot", !n.read && "notif-card-dot-slot--live")} aria-hidden>
                    {!n.read && <span className="notif-card-dot" />}
                  </span>
                  <Avatar
                    src={fighter.photo_url}
                    alt={fighter.first_name}
                    fallback={fighter.first_name?.[0] ?? "?"}
                    size="md"
                  />
                  <div className="notif-card-copy">
                    <p className="notif-card-headline">{copy.headline}</p>
                    <p className="notif-card-subline">{copy.subline}</p>
                  </div>
                  <AvailabilityBadge status={fighter.availability_status} />
                </div>
                <div className="notif-card-foot">
                  <span className="notif-card-time">
                    {formatDistanceToNow(new Date(n.created_at), { addSuffix: true })}
                  </span>
                  <span className="notif-card-cta">
                    View profile
                    <ChevronRight className="h-3.5 w-3.5" aria-hidden />
                  </span>
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
}
