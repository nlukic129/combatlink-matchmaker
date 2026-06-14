import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Heart, BellOff, Bell, FileText, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { AvailabilityBadge } from "@/components/ui/availability-badge";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { Spinner } from "@/components/ui/spinner";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_app/favourites")({
  component: FavouritesPage,
});

function FavouritesPage() {
  const qc = useQueryClient();

  const { data: favourites = [], isLoading } = useQuery({
    queryKey: ["favourites"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("matchmaker_favourites")
        .select(
          `
          id,
          fighter_id,
          note,
          notify,
          notified_at,
          created_at,
          fighters (
            id, first_name, last_name, nickname, country,
            photo_url, availability_status, available_from,
            purse_usd, current_city, current_city_country
          )
        `
        )
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data ?? [];
    },
  });

  const toggleNotify = useMutation({
    mutationFn: async ({ id, notify }: { id: number; notify: boolean }) => {
      await supabase.from("matchmaker_favourites").update({ notify }).eq("id", id);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["favourites"] }),
  });

  const removeFavourite = useMutation({
    mutationFn: async (id: number) => {
      await supabase.from("matchmaker_favourites").delete().eq("id", id);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["favourites"] }),
  });

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Spinner size="lg" />
      </div>
    );
  }

  if (favourites.length === 0) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
        <PageHeader title="Favourites" description="Fighters you've saved for quick access." />
        <EmptyState
          icon={<Heart className="h-8 w-8" />}
          title="No favourites yet"
          description="Hover over a fighter card in search and click the heart to save them here."
        />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
      <PageHeader
        title="Favourites"
        description="Fighters you've saved for quick access."
        badge={
          <span className="rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
            {favourites.length}
          </span>
        }
      />

      <div className="space-y-2.5">
        {favourites.map((fav) => {
          const fighter = Array.isArray(fav.fighters) ? fav.fighters[0] : fav.fighters;
          if (!fighter) return null;

          return (
            <div
              key={fav.id}
              className="flex items-center gap-4 rounded-xl border border-border bg-card px-4 py-3.5 shadow-[var(--shadow-card)] transition-colors hover:bg-surface-hover"
            >
              <Avatar
                src={fighter.photo_url}
                alt={fighter.first_name}
                fallback={fighter.first_name?.[0] ?? "?"}
                size="md"
              />

              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold text-foreground">
                  {fighter.first_name} {fighter.last_name}
                  {fighter.nickname && (
                    <span className="ml-1.5 font-normal text-sm text-muted-foreground">
                      &ldquo;{fighter.nickname}&rdquo;
                    </span>
                  )}
                </p>
                {(fighter.current_city || fighter.country) && (
                  <p className="truncate text-xs text-muted-foreground">
                    {[fighter.current_city, fighter.current_city_country ?? fighter.country]
                      .filter(Boolean)
                      .join(", ")}
                  </p>
                )}
              </div>

              <AvailabilityBadge status={fighter.availability_status} />

              {fav.note && (
                <span aria-label={fav.note}>
                  <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                </span>
              )}

              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => toggleNotify.mutate({ id: fav.id, notify: !fav.notify })}
                className={cn(fav.notify && "text-primary")}
                title={fav.notify ? "Stop notifications" : "Notify when available"}
              >
                {fav.notify ? <Bell className="h-4 w-4" /> : <BellOff className="h-4 w-4" />}
              </Button>

              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => removeFavourite.mutate(fav.id)}
                className="hover:text-destructive"
                title="Remove from favourites"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
