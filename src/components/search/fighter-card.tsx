import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "@tanstack/react-router";
import { Heart, Check, Plus, Zap, X, Tag } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/auth-context";
import { cn } from "@/lib/utils";
import { tagColor } from "@/lib/tag-utils";
import { useCurrency } from "@/contexts/currency-context";
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
  const { format } = useCurrency();
  const heartRef = useRef<HTMLButtonElement>(null);
  const wasAddingRef = useRef(false);
  const [tagPopup, setTagPopup] = useState<{ top: number; right: number } | null>(null);

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
      qc.invalidateQueries({ queryKey: ["saved-fighter-ids"] });
      if (wasAddingRef.current) {
        const rect = heartRef.current?.getBoundingClientRect();
        if (rect) {
          const spaceBelow = window.innerHeight - rect.bottom;
          const top = spaceBelow > 260 ? rect.bottom + 8 : rect.top - 260 - 8;
          setTagPopup({ top, right: window.innerWidth - rect.right - 4 });
        }
      }
    },
  });

  function handleHeartClick(e: React.MouseEvent) {
    e.stopPropagation();
    wasAddingRef.current = !isFavourite;
    toggleFavourite.mutate();
  }

  function openDetail() {
    navigate({ search: (p) => ({ ...p, fighter: fighter.id }), replace: true });
  }

  const status = fighter.availability_status ?? "unavailable";
  const fullName = [fighter.first_name, fighter.last_name].filter(Boolean).join(" ");
  const initials = [fighter.first_name?.[0], fighter.last_name?.[0]].filter(Boolean).join("").toUpperCase();
  const hasRecord = fighter.pro_w > 0 || fighter.pro_l > 0 || fighter.pro_d > 0;

  return (
    <>
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
            <span className="fc-purse">{format(fighter.purse_usd)}</span>
          )}
        </div>

        <div className="fc-card-actions">
          <button
            ref={heartRef}
            type="button"
            onClick={handleHeartClick}
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

      {tagPopup && (
        <SaveTagPopup
          fighterId={fighter.id}
          pos={tagPopup}
          onClose={() => setTagPopup(null)}
        />
      )}
    </>
  );
}

// ── SaveTagPopup ───────────────────────────────────────────────────────────────
function SaveTagPopup({
  fighterId, pos, onClose,
}: {
  fighterId: string;
  pos: { top: number; right: number };
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const [query, setQuery] = useState("");
  const [selectedTags, setSelectedTags] = useState<string[]>([]);

  const { data: allTags = [] } = useQuery({
    queryKey: ["all-fav-tags"],
    queryFn: async () => {
      const { data } = await supabase.from("matchmaker_favourites").select("tags");
      const set = new Set<string>();
      for (const row of data ?? []) for (const t of (row.tags ?? []) as string[]) set.add(t);
      return Array.from(set).sort();
    },
    staleTime: 30_000,
  });

  const updateTags = useMutation({
    mutationFn: async (tags: string[]) => {
      await supabase.from("matchmaker_favourites").update({ tags }).eq("fighter_id", fighterId);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["favourites"] });
      qc.invalidateQueries({ queryKey: ["all-fav-tags"] });
    },
  });

  function resetTimer() {
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(onClose, 7000);
  }

  useEffect(() => {
    resetTimer();
    inputRef.current?.focus();
    return () => clearTimeout(timerRef.current);
  }, []);

  useEffect(() => {
    function onMouseDown(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) onClose();
    }
    document.addEventListener("mousedown", onMouseDown);
    return () => document.removeEventListener("mousedown", onMouseDown);
  }, [onClose]);

  function toggleTag(tag: string) {
    const next = selectedTags.includes(tag)
      ? selectedTags.filter(t => t !== tag)
      : [...selectedTags, tag];
    setSelectedTags(next);
    updateTags.mutate(next);
    resetTimer();
  }

  const normalized = query.trim().toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
  const filtered = allTags.filter(t => !query.trim() || t.includes(query.toLowerCase().trim()));
  const canCreate = normalized.length > 0 && !allTags.includes(normalized);

  function createTag() {
    if (!canCreate) return;
    const next = selectedTags.includes(normalized)
      ? selectedTags
      : [...selectedTags, normalized];
    setSelectedTags(next);
    updateTags.mutate(next);
    setQuery("");
    resetTimer();
  }

  return createPortal(
    <div
      ref={containerRef}
      className="fixed z-[9999] w-72 overflow-hidden rounded-2xl border border-border bg-popover shadow-[var(--shadow-elevated)]"
      style={{ top: pos.top, right: pos.right }}
      onPointerMove={resetTimer}
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <div className="flex items-center gap-2">
          <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/15">
            <Heart className="h-3 w-3 fill-primary text-primary" />
          </div>
          <span className="text-sm font-semibold text-foreground">Saved!</span>
        </div>
        <button onClick={onClose} className="text-muted-foreground/40 hover:text-muted-foreground transition-colors">
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Body */}
      <div className="px-4 py-3">
        <p className="mb-2.5 text-[11px] font-medium uppercase tracking-wider text-muted-foreground/50">
          Add a tag
        </p>

        {/* Input */}
        <div className="mb-3 flex items-center gap-2 rounded-lg border border-border/60 bg-surface px-2.5 py-1.5">
          <Tag className="h-3 w-3 shrink-0 text-muted-foreground/40" />
          <input
            ref={inputRef}
            value={query}
            onChange={e => { setQuery(e.target.value); resetTimer(); }}
            onKeyDown={e => e.key === "Enter" && createTag()}
            placeholder="Search or create…"
            className="flex-1 bg-transparent text-xs text-foreground placeholder:text-muted-foreground/40 focus:outline-none"
          />
        </div>

        {/* Create option */}
        {canCreate && (
          <button onClick={createTag}
            className="mb-2 flex w-full items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs text-primary hover:bg-accent transition-colors">
            <Plus className="h-3 w-3" />
            Create &ldquo;#{normalized}&rdquo;
          </button>
        )}

        {/* Tag chips */}
        <div className="flex flex-wrap gap-1.5">
          {filtered.length === 0 && !canCreate && (
            <p className="py-2 text-xs text-muted-foreground/40">
              {allTags.length === 0 ? "Type to create your first tag" : "No matches"}
            </p>
          )}
          {filtered.map(tag => {
            const isOn = selectedTags.includes(tag);
            const c = tagColor(tag);
            return (
              <button key={tag} onClick={() => toggleTag(tag)}
                className={cn(
                  "flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-medium transition-all",
                  isOn ? "opacity-100" : "opacity-55 hover:opacity-90"
                )}
                style={{
                  backgroundColor: c.bg,
                  color: c.text,
                  borderColor: c.border,
                  ...(isOn && { outline: `1px solid ${c.border}`, outlineOffset: "2px" }),
                }}>
                {isOn && <Check className="h-2.5 w-2.5 shrink-0" />}
                #{tag}
              </button>
            );
          })}
        </div>
      </div>

      {/* Footer — only shown when tags selected */}
      {selectedTags.length > 0 && (
        <div className="border-t border-border px-4 pb-3 pt-2.5">
          <button onClick={onClose}
            className="w-full rounded-lg bg-primary py-1.5 text-xs font-semibold text-primary-foreground hover:bg-primary/90 transition-colors">
            Done
          </button>
        </div>
      )}
    </div>,
    document.body
  );
}
