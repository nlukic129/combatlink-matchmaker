import { useNavigate } from "@tanstack/react-router";
import { Heart, Check, Plus, Zap } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/auth-context";
import { cn, formatCurrency } from "@/lib/utils";
import type { SearchFighter } from "@/types/database";

type Props = {
  fighter: SearchFighter;
  nearMatch?: boolean;
  selected?: boolean;
  onToggleCompare?: () => void;
};

const STATUS_LABEL: Record<string, string> = {
  available: "Available",
  in_camp: "In Camp",
  unavailable: "Unavailable",
};

export function FighterCard({ fighter, nearMatch, selected, onToggleCompare }: Props) {
  const navigate = useNavigate({ from: "/search" });
  const { matchmaker } = useAuth();
  const qc = useQueryClient();

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
        await supabase.from("matchmaker_favourites").delete().eq("fighter_id", fighter.id);
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

  const status = fighter.availability_status ?? "unavailable";
  const fullName = [fighter.first_name, fighter.last_name].filter(Boolean).join(" ");
  const initials = [fighter.first_name?.[0], fighter.last_name?.[0]].filter(Boolean).join("").toUpperCase();
  const hasRecord = fighter.pro_w > 0 || fighter.pro_l > 0 || fighter.pro_d > 0;

  return (
    <article
      data-status={status}
      className={cn(
        "fc-card group",
        nearMatch && "fc-card--near",
        selected && "fc-card--selected"
      )}
      onClick={openDetail}
    >
      <div className="fc-card-accent" aria-hidden />

      {onToggleCompare && (
        <div className={cn("fc-compare-slot", selected && "fc-compare-slot--open")}>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onToggleCompare(); }}
            className={cn("fc-compare", selected && "fc-compare--on")}
            aria-label={selected ? "Remove from comparison" : "Add to comparison"}
            aria-pressed={selected}
          >
            {selected ? (
              <Check className="fc-compare-icon" strokeWidth={2.75} />
            ) : (
              <Plus className="fc-compare-icon" strokeWidth={2.5} />
            )}
          </button>
        </div>
      )}

      <div className="fc-card-photo" data-status={status}>
        {fighter.photo_url ? (
          <img src={fighter.photo_url} alt="" className="fc-card-photo-img" draggable={false} />
        ) : (
          <div className="fc-card-photo-fallback">
            <span className="fc-card-initials">{initials || "?"}</span>
          </div>
        )}
      </div>

      {/* Identity: big name + compact meta row */}
      <div className="fc-card-main">
        <h3 className="fc-name">{fullName}</h3>
        <div className="fc-card-row2">
          <span className="fc-status" data-status={status}>
            <span className="fc-status-dot" aria-hidden />
            {STATUS_LABEL[status] ?? "Unknown"}
          </span>
          {fighter.nickname && (
            <>
              <span className="fc-row2-sep" aria-hidden />
              <span className="fc-nickname">&ldquo;{fighter.nickname}&rdquo;</span>
            </>
          )}
          {nearMatch && (
            <>
              <span className="fc-row2-sep" aria-hidden />
              <span className="fc-near-badge">Near match</span>
            </>
          )}
          {fighter.open_to_short_notice && (
            <>
              <span className="fc-row2-sep" aria-hidden />
              <Zap className="h-3 w-3 fc-stat-sn" aria-label="Short notice" />
            </>
          )}
        </div>
      </div>

      {/* Stats column: W/L/D blocks + purse */}
      <div className="fc-card-stats">
        {hasRecord && (
          <div className="fc-record-blocks">
            <div className="fc-stat-block">
              <span className="fc-stat-val">{fighter.pro_w}</span>
              <span className="fc-stat-lbl">W</span>
            </div>
            <div className="fc-stat-sep" aria-hidden />
            <div className="fc-stat-block fc-stat-block--loss">
              <span className="fc-stat-val">{fighter.pro_l}</span>
              <span className="fc-stat-lbl">L</span>
            </div>
            {fighter.pro_d > 0 && (
              <>
                <div className="fc-stat-sep" aria-hidden />
                <div className="fc-stat-block fc-stat-block--draw">
                  <span className="fc-stat-val">{fighter.pro_d}</span>
                  <span className="fc-stat-lbl">D</span>
                </div>
              </>
            )}
          </div>
        )}
        {fighter.purse_usd != null && (
          <span className="fc-purse">{formatCurrency(fighter.purse_usd)}</span>
        )}
      </div>

      <div className="fc-card-actions">
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); toggleFavourite.mutate(); }}
          className={cn("fc-fav", isFavourite && "fc-fav--on")}
          aria-label={isFavourite ? "Remove from favourites" : "Add to favourites"}
        >
          <Heart
            className="h-4 w-4"
            strokeWidth={isFavourite ? 0 : 1.5}
            fill={isFavourite ? "currentColor" : "none"}
          />
        </button>
      </div>
    </article>
  );
}
