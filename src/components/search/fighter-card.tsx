import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Heart, Check, Zap, MapPin } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/auth-context";
import { cn, formatCurrency } from "@/lib/utils";
import { AvailabilityBadge } from "@/components/ui/availability-badge";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import type { Fighter } from "@/types/database";

type Props = {
  fighter: Fighter;
  nearMatch?: boolean;
  selected?: boolean;
  onToggleCompare?: () => void;
};

export function FighterCard({ fighter, nearMatch, selected, onToggleCompare }: Props) {
  const navigate = useNavigate({ from: "/search" });
  const { matchmaker } = useAuth();
  const qc = useQueryClient();
  const [hovered, setHovered] = useState(false);

  const { data: isFavourite } = useQuery({
    queryKey: ["favourite", fighter.id],
    enabled: !!matchmaker,
    queryFn: async () => {
      const { data } = await supabase
        .from("matchmaker_favourites")
        .select("id")
        .eq("fighter_id", fighter.id)
        .maybeSingle();
      return !!data;
    },
  });

  const toggleFavourite = useMutation({
    mutationFn: async () => {
      if (isFavourite) {
        await supabase
          .from("matchmaker_favourites")
          .delete()
          .eq("fighter_id", fighter.id);
      } else {
        await supabase.from("matchmaker_favourites").insert({
          matchmaker_id: matchmaker!.id,
          fighter_id: fighter.id,
        });
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["favourite", fighter.id] });
      qc.invalidateQueries({ queryKey: ["favourites"] });
    },
  });

  function openDetail() {
    navigate({ search: (p) => ({ ...p, fighter: fighter.id }), replace: true });
  }

  const fullName = `${fighter.first_name} ${fighter.last_name}`;

  return (
    <article
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className={cn(
        "group relative flex cursor-pointer items-center gap-4 rounded-xl border bg-card px-4 py-4",
        "shadow-[var(--shadow-card)] transition-all duration-150",
        "hover:border-border hover:bg-surface-hover hover:shadow-[var(--shadow-elevated)]",
        nearMatch && "border-border/50 opacity-80",
        selected && "ring-2 ring-primary/50 ring-offset-2 ring-offset-background"
      )}
      onClick={openDetail}
    >
      {(hovered || selected) && onToggleCompare && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onToggleCompare();
          }}
          className={cn(
            "absolute -left-2 top-1/2 z-10 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-md border transition-all duration-150",
            selected
              ? "border-primary bg-primary text-primary-foreground shadow-sm"
              : "border-border bg-card hover:border-primary hover:bg-primary/10"
          )}
          aria-label={selected ? "Remove from comparison" : "Add to comparison"}
        >
          {selected && <Check className="h-3.5 w-3.5" />}
        </button>
      )}

      <Avatar
        src={fighter.photo_url}
        alt={fullName}
        fallback={fighter.first_name?.[0] ?? "?"}
        size="lg"
        ring
      />

      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex items-center gap-2">
          <p className="truncate text-base font-semibold text-foreground">{fullName}</p>
          {fighter.country && (
            <span className="shrink-0 rounded-md bg-muted/60 px-1.5 py-0.5 text-[11px] font-medium text-muted-foreground">
              {fighter.country}
            </span>
          )}
        </div>
        {fighter.nickname && (
          <p className="text-sm text-muted-foreground">&ldquo;{fighter.nickname}&rdquo;</p>
        )}
        {(fighter.current_city || fighter.current_city_country) && (
          <p className="flex items-center gap-1 text-xs text-muted-foreground">
            <MapPin className="h-3 w-3 shrink-0" />
            {[fighter.current_city, fighter.current_city_country].filter(Boolean).join(", ")}
          </p>
        )}
      </div>

      <div className="flex shrink-0 flex-col items-end gap-2">
        <AvailabilityBadge status={fighter.availability_status} />

        <div className="flex items-center gap-2">
          {fighter.purse_usd != null && (
            <span className="rounded-md bg-muted/60 px-2 py-0.5 text-xs font-semibold text-foreground">
              {formatCurrency(fighter.purse_usd)}
            </span>
          )}
          {fighter.height_cm && (
            <span className="text-xs text-muted-foreground">{fighter.height_cm} cm</span>
          )}
          {fighter.open_to_short_notice && (
            <span className="inline-flex items-center gap-0.5 rounded-full bg-available/10 px-2 py-0.5 text-[11px] font-medium text-available">
              <Zap className="h-3 w-3" />
              SN
            </span>
          )}
        </div>
      </div>

      <Button
        variant="ghost"
        size="icon-sm"
        onClick={(e) => {
          e.stopPropagation();
          toggleFavourite.mutate();
        }}
        className={cn(
          "shrink-0",
          isFavourite
            ? "text-primary"
            : "text-muted-foreground opacity-0 group-hover:opacity-100 hover:text-primary"
        )}
        aria-label={isFavourite ? "Remove from favourites" : "Add to favourites"}
      >
        <Heart className={cn("h-4 w-4", isFavourite && "fill-current")} />
      </Button>
    </article>
  );
}
