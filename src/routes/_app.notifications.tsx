import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Bell, CheckCheck } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { AvailabilityBadge } from "@/components/ui/availability-badge";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { Spinner } from "@/components/ui/spinner";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_app/notifications")({
  component: NotificationsPage,
});

function NotificationsPage() {
  const qc = useQueryClient();

  const { data: notifications = [], isLoading } = useQuery({
    queryKey: ["notifications"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("matchmaker_notifications")
        .select(
          `
          id, type, read, created_at,
          fighters (
            id, first_name, last_name, nickname, photo_url, availability_status
          )
        `
        )
        .order("created_at", { ascending: false })
        .limit(100);

      if (error) throw error;
      return data ?? [];
    },
  });

  const markAllRead = useMutation({
    mutationFn: async () => {
      await supabase
        .from("matchmaker_notifications")
        .update({ read: true })
        .eq("read", false);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notifications"] }),
  });

  const markRead = useMutation({
    mutationFn: async (id: number) => {
      await supabase.from("matchmaker_notifications").update({ read: true }).eq("id", id);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notifications"] }),
  });

  const unreadCount = notifications.filter((n) => !n.read).length;

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-8 sm:px-6">
      <PageHeader
        title="Notifications"
        description="Updates when your favourite fighters become available."
        badge={
          unreadCount > 0 ? (
            <span className="rounded-full bg-primary px-2.5 py-0.5 text-xs font-semibold text-primary-foreground">
              {unreadCount} new
            </span>
          ) : undefined
        }
        actions={
          unreadCount > 0 ? (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => markAllRead.mutate()}
            >
              <CheckCheck className="h-4 w-4" />
              Mark all read
            </Button>
          ) : undefined
        }
      />

      {notifications.length === 0 ? (
        <EmptyState
          icon={<Bell className="h-8 w-8" />}
          title="No notifications yet"
          description="You'll be notified when a favourited fighter becomes available for booking."
        />
      ) : (
        <div className="space-y-2">
          {notifications.map((n) => {
            const fighter = Array.isArray(n.fighters) ? n.fighters[0] : n.fighters;
            if (!fighter) return null;

            return (
              <div
                key={n.id}
                onClick={() => !n.read && markRead.mutate(n.id)}
                className={cn(
                  "flex cursor-pointer items-center gap-4 rounded-xl border px-4 py-3.5 transition-all duration-150",
                  n.read
                    ? "border-border bg-card shadow-[var(--shadow-card)]"
                    : "border-primary/25 bg-primary/5 shadow-sm hover:bg-primary/10"
                )}
              >
                {!n.read && (
                  <span className="h-2 w-2 shrink-0 rounded-full bg-primary shadow-[0_0_8px_var(--primary)]" />
                )}
                <Avatar
                  src={fighter.photo_url}
                  alt={fighter.first_name}
                  fallback={fighter.first_name?.[0] ?? "?"}
                  size="md"
                />
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-foreground">
                    <span className="font-semibold">
                      {fighter.first_name} {fighter.last_name}
                    </span>{" "}
                    is now available for booking
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {formatDistanceToNow(new Date(n.created_at), { addSuffix: true })}
                  </p>
                </div>
                <AvailabilityBadge status={fighter.availability_status} />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
