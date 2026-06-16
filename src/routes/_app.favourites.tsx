import { useState, useMemo, useRef, useEffect } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Bell, BellOff, Trash2, MapPin, Search, Plus, Check, X,
  ArrowLeftRight, Heart, Tag, ExternalLink, DollarSign, Calendar,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { AvailabilityBadge } from "@/components/ui/availability-badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Spinner } from "@/components/ui/spinner";
import { FighterDrawer } from "@/components/fighter-drawer/fighter-drawer";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { tagColor } from "@/lib/tag-utils";
import { useCurrency } from "@/contexts/currency-context";

export const Route = createFileRoute("/_app/favourites")({
  component: FavouritesPage,
});

// ── Types ──────────────────────────────────────────────────────────────────────
type NoteRow = { id: number; body: string; created_at: string };
type SportRow = { sport: string; pro_w: number; pro_l: number; pro_d: number; level: string | null; is_active: boolean };
type FighterRow = {
  id: string; first_name: string; last_name: string | null; nickname: string | null;
  country: string | null; photo_url: string | null; availability_status: string;
  available_from: string | null; purse_usd: number | null; purse_negotiable: boolean;
  current_city: string | null; current_city_country: string | null;
  fighter_sports: SportRow[];
};
type FavRow = {
  id: number; fighter_id: string; note: string | null; notify: boolean;
  notified_at: string | null; created_at: string; tags: string[];
  fighters: FighterRow | null;
  matchmaker_favourite_notes: NoteRow[];
};

// ── Helpers ────────────────────────────────────────────────────────────────────
function relativeTime(d: string): string {
  const diff = Date.now() - new Date(d).getTime();
  const days = Math.floor(diff / 86_400_000);
  if (days === 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 7) return `${days}d ago`;
  if (days < 30) return `${Math.floor(days / 7)}w ago`;
  if (days < 365) return `${Math.floor(days / 30)}mo ago`;
  return `${Math.floor(days / 365)}y ago`;
}
function formatNoteDate(d: string): string {
  const date = new Date(d);
  const now = new Date();
  const diff = Math.floor((now.getTime() - date.getTime()) / 86_400_000);
  if (diff === 0) return "Today";
  if (diff === 1) return "Yesterday";
  if (diff < 7) return date.toLocaleDateString("en-US", { weekday: "short" });
  if (now.getFullYear() === date.getFullYear())
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "2-digit" });
}
function formatAvailableFrom(d: string): string {
  return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}
function statusColor(s: string): string {
  if (s === "available") return "oklch(0.72 0.19 150)";
  if (s === "in_camp") return "oklch(0.82 0.16 80)";
  return "oklch(0.38 0.012 270)";
}

type StatusFilter = "all" | "available" | "in_camp" | "unavailable";
type SortBy = "recent" | "name" | "status";
const STATUS_ORDER: Record<string, number> = { available: 0, in_camp: 1, unavailable: 2 };

// ── Page ───────────────────────────────────────────────────────────────────────
export function FavouritesPage() {
  const qc = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [tagFilter, setTagFilter]       = useState<string[]>([]);
  const [searchQuery, setSearchQuery]   = useState("");
  const [sortBy, setSortBy]             = useState<SortBy>("recent");
  const [selectedFavId, setSelectedFavId]   = useState<number | null>(null);
  const [selectedFavIds, setSelectedFavIds] = useState<Set<number>>(new Set());
  const [viewFighterId, setViewFighterId]   = useState<string | null>(null);

  const { data: favourites = [], isLoading } = useQuery<FavRow[]>({
    queryKey: ["favourites"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("matchmaker_favourites")
        .select(`
          id, fighter_id, note, notify, notified_at, created_at, tags,
          fighters (
            id, first_name, last_name, nickname, country,
            photo_url, availability_status, available_from,
            purse_usd, purse_negotiable, current_city, current_city_country,
            fighter_sports (sport, pro_w, pro_l, pro_d, level, is_active)
          ),
          matchmaker_favourite_notes (id, body, created_at)
        `)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as FavRow[];
    },
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ["favourites"] });

  const toggleNotify = useMutation({
    mutationFn: async ({ id, notify }: { id: number; notify: boolean }) => {
      await supabase.from("matchmaker_favourites").update({ notify }).eq("id", id);
    },
    onSuccess: invalidate,
  });
  const removeFavourite = useMutation({
    mutationFn: async (id: number) => {
      await supabase.from("matchmaker_favourites").delete().eq("id", id);
    },
    onSuccess: () => { setSelectedFavId(null); invalidate(); },
  });
  const bulkRemove = useMutation({
    mutationFn: async (ids: number[]) => {
      await supabase.from("matchmaker_favourites").delete().in("id", ids);
    },
    onSuccess: () => { setSelectedFavIds(new Set()); invalidate(); },
  });
  const addNote = useMutation({
    mutationFn: async ({ favouriteId, body }: { favouriteId: number; body: string }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");
      await supabase.from("matchmaker_favourite_notes").insert({
        favourite_id: favouriteId, matchmaker_id: user.id, body,
      });
    },
    onSuccess: invalidate,
  });
  const deleteNote = useMutation({
    mutationFn: async (noteId: number) => {
      await supabase.from("matchmaker_favourite_notes").delete().eq("id", noteId);
    },
    onSuccess: invalidate,
  });
  const updateTags = useMutation({
    mutationFn: async ({ id, tags }: { id: number; tags: string[] }) => {
      await supabase.from("matchmaker_favourites").update({ tags }).eq("id", id);
    },
    onSuccess: invalidate,
  });

  const counts = useMemo(() => {
    let available = 0, inCamp = 0, unavailable = 0;
    for (const f of favourites) {
      const s = f.fighters?.availability_status ?? "unavailable";
      if (s === "available") available++;
      else if (s === "in_camp") inCamp++;
      else unavailable++;
    }
    return { available, inCamp, unavailable };
  }, [favourites]);

  const allTags = useMemo(() => {
    const set = new Set<string>();
    for (const f of favourites) for (const t of f.tags ?? []) set.add(t);
    return Array.from(set).sort();
  }, [favourites]);

  const displayed = useMemo(() => {
    let list = favourites.filter(fav => {
      const fighter = fav.fighters;
      if (!fighter) return false;
      if (statusFilter !== "all" && fighter.availability_status !== statusFilter) return false;
      if (tagFilter.length > 0 && !tagFilter.some(t => (fav.tags ?? []).includes(t))) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.trim().toLowerCase();
        const name = `${fighter.first_name} ${fighter.last_name ?? ""}`.toLowerCase();
        if (!name.includes(q) && !(fighter.nickname ?? "").toLowerCase().includes(q)) return false;
      }
      return true;
    });
    if (sortBy === "name") {
      list = [...list].sort((a, b) =>
        `${a.fighters?.first_name ?? ""} ${a.fighters?.last_name ?? ""}`.trim()
          .localeCompare(`${b.fighters?.first_name ?? ""} ${b.fighters?.last_name ?? ""}`.trim())
      );
    } else if (sortBy === "status") {
      list = [...list].sort((a, b) =>
        (STATUS_ORDER[a.fighters?.availability_status ?? "unavailable"] ?? 3) -
        (STATUS_ORDER[b.fighters?.availability_status ?? "unavailable"] ?? 3)
      );
    }
    return list;
  }, [favourites, statusFilter, tagFilter, searchQuery, sortBy]);

  const selectedFav    = selectedFavId != null ? favourites.find(f => f.id === selectedFavId) ?? null : null;
  const panelOpen      = selectedFav != null;
  const selectedFighterIds = useMemo(
    () => favourites.filter(f => selectedFavIds.has(f.id)).map(f => f.fighter_id),
    [favourites, selectedFavIds]
  );

  function toggleSelect(favId: number, e: React.MouseEvent) {
    e.stopPropagation();
    setSelectedFavIds(prev => {
      const n = new Set(prev);
      n.has(favId) ? n.delete(favId) : n.add(favId);
      return n;
    });
  }

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Spinner size="lg" />
      </div>
    );
  }

  if (favourites.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4 px-6">
        <Heart className="h-10 w-10 text-muted-foreground/30" />
        <div className="text-center">
          <p className="font-semibold text-foreground">No saved fighters yet</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Hover over a fighter card in search and click the heart to save them here.
          </p>
        </div>
      </div>
    );
  }

  return (
    <>
      {/* Outer wrapper — shifts left when panel is open to make room for fixed panel */}
      <div className={cn(
        "transition-[padding] duration-200 ease-in-out",
        panelOpen && "pr-[380px]"
      )}>
        {/* ── Centered list ─────────────────────────────────────────────────── */}
        <div className="mx-auto max-w-6xl">

        {/* ── Left: list ─────────────────────────────────────────────────────── */}
        <div className="min-w-0 flex-1">

          {/* Sticky controls header */}
          <div className="sticky top-0 z-20 border-b border-border bg-background/96 backdrop-blur-md">
            {/* Top bar */}
            <div className="flex items-center gap-3 px-8 py-3">
              <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                <span className="font-semibold text-foreground">{favourites.length}</span>
                <span>saved</span>
                {counts.available > 0 && (
                  <span className="text-available">· {counts.available} available</span>
                )}
              </div>

              <div className="flex-1" />

              {/* Search */}
              <div className="relative w-52">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground/50" />
                <input
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder="Search..."
                  className="h-8 w-full rounded-lg border border-border/60 bg-surface pl-8 pr-3 text-sm text-foreground placeholder:text-muted-foreground/50 focus:border-border focus:outline-none focus:ring-1 focus:ring-ring"
                />
                {searchQuery && (
                  <button onClick={() => setSearchQuery("")}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground/50 hover:text-muted-foreground">
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>

              {/* Sort */}
              <select
                value={sortBy}
                onChange={e => setSortBy(e.target.value as SortBy)}
                className="h-8 cursor-pointer rounded-lg border border-border/60 bg-surface px-2.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
              >
                <option value="recent">Recent</option>
                <option value="name">Name</option>
                <option value="status">Status</option>
              </select>
            </div>

            {/* Filter row */}
            <div className="flex items-center gap-2 px-8 pb-2">
              {([
                { key: "all" as StatusFilter,         label: "All",         count: favourites.length },
                { key: "available" as StatusFilter,   label: "Available",   count: counts.available },
                { key: "in_camp" as StatusFilter,     label: "In Camp",     count: counts.inCamp },
                { key: "unavailable" as StatusFilter, label: "Unavailable", count: counts.unavailable },
              ] as const).map(tab => {
                const isActive = statusFilter === tab.key;
                return (
                  <button key={tab.key} onClick={() => setStatusFilter(tab.key)}
                    className={cn(
                      "flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium transition-all",
                      isActive && tab.key === "all"         && "border-white/20 bg-white/10 text-foreground",
                      isActive && tab.key === "available"   && "border-available/25 bg-available/12 text-available",
                      isActive && tab.key === "in_camp"     && "border-in-camp/25 bg-in-camp/12 text-in-camp",
                      isActive && tab.key === "unavailable" && "border-border bg-muted/80 text-muted-foreground",
                      !isActive && "border-transparent text-muted-foreground hover:text-foreground"
                    )}>
                    {tab.label}
                    <span className={cn("text-[10px]", isActive ? "opacity-80" : "opacity-40")}>
                      {tab.count}
                    </span>
                  </button>
                );
              })}

              {allTags.length > 0 && (
                <>
                  <div className="h-4 w-px bg-border" />
                  <Tag className="h-3 w-3 shrink-0 text-muted-foreground/40" />
                  {allTags.map(tag => {
                    const isActive = tagFilter.includes(tag);
                    const c = tagColor(tag);
                    return (
                      <button key={tag}
                        onClick={() => setTagFilter(prev => isActive ? prev.filter(t => t !== tag) : [...prev, tag])}
                        className={cn("rounded-full border px-2 py-0.5 text-[11px] font-medium transition-all",
                          isActive ? "opacity-100" : "opacity-40 hover:opacity-70"
                        )}
                        style={isActive ? { backgroundColor: c.bg, color: c.text, borderColor: c.border } : { borderColor: "transparent" }}>
                        #{tag}
                      </button>
                    );
                  })}
                  {tagFilter.length > 0 && (
                    <button onClick={() => setTagFilter([])} className="text-[11px] text-muted-foreground/40 hover:text-muted-foreground">
                      Clear
                    </button>
                  )}
                </>
              )}
            </div>
          </div>

          {/* Cards */}
          <div className="space-y-1.5 px-8 py-4 pb-20">
            {displayed.length > 0
              ? displayed.map(fav => {
                  const fighter = fav.fighters;
                  if (!fighter) return null;
                  const isActiveFav = selectedFavId === fav.id;
                  const isSelected  = selectedFavIds.has(fav.id);
                  const anySelected = selectedFavIds.size > 0;
                  return (
                    <FavCard
                      key={fav.id}
                      fav={fav}
                      fighter={fighter}
                      isActive={isActiveFav}
                      isSelected={isSelected}
                      anySelected={anySelected}
                      onOpen={() => setSelectedFavId(isActiveFav ? null : fav.id)}
                      onSelect={e => toggleSelect(fav.id, e)}
                      onToggleNotify={() => toggleNotify.mutate({ id: fav.id, notify: !fav.notify })}
                      onRemove={() => removeFavourite.mutate(fav.id)}
                    />
                  );
                })
              : (
                <div className="py-20">
                  <EmptyState
                    icon={<Heart className="h-6 w-6" />}
                    title="No fighters match"
                    description="Try adjusting your filters."
                  />
                </div>
              )
            }
          </div>

          {/* Bulk selection island */}
          {selectedFavIds.size > 0 && (
            <div className="sticky bottom-0 z-20 px-8 pb-6">
              <div className="flex items-center justify-between rounded-full border border-border bg-sidebar/95 px-5 py-2.5 shadow-[var(--shadow-elevated)] backdrop-blur-md">
                <div className="flex items-center gap-3">
                  <span className="text-sm font-medium">{selectedFavIds.size} selected</span>
                  <button onClick={() => setSelectedFavIds(new Set())}
                    className="text-xs text-muted-foreground hover:text-foreground">Clear</button>
                </div>
                <div className="flex items-center gap-2">
                  {selectedFighterIds.length >= 2 && selectedFighterIds.length <= 4 && (
                    <Button variant="secondary" size="sm" asChild>
                      <Link to="/compare" search={{ fighters: selectedFighterIds }}>
                        <ArrowLeftRight className="h-3.5 w-3.5" /> Compare
                      </Link>
                    </Button>
                  )}
                  <Button variant="destructive" size="sm"
                    onClick={() => bulkRemove.mutate(Array.from(selectedFavIds))}
                    disabled={bulkRemove.isPending}>
                    <Trash2 className="h-3.5 w-3.5" /> Remove {selectedFavIds.size}
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>

        </div>{/* /mx-auto */}
      </div>{/* /pr-[380px] wrapper */}

      {/* ── Right: fixed panel — always anchored to viewport right edge ────── */}
      {panelOpen && selectedFav && (
        <div className="fixed right-0 top-14 bottom-0 z-30 w-[380px] overflow-hidden">
          <DetailPanel
            fav={selectedFav}
            fighter={selectedFav.fighters!}
            allTags={allTags}
            onClose={() => setSelectedFavId(null)}
            onToggleNotify={() => toggleNotify.mutate({ id: selectedFav.id, notify: !selectedFav.notify })}
            onRemove={() => removeFavourite.mutate(selectedFav.id)}
            onAddNote={body => addNote.mutate({ favouriteId: selectedFav.id, body })}
            onDeleteNote={id => deleteNote.mutate(id)}
            onUpdateTags={tags => updateTags.mutate({ id: selectedFav.id, tags })}
            onOpenProfile={() => setViewFighterId(selectedFav.fighter_id)}
          />
        </div>
      )}

      {viewFighterId && (
        <FighterDrawer fighterId={viewFighterId} onClose={() => setViewFighterId(null)} />
      )}
    </>
  );
}

// ── FavCard ────────────────────────────────────────────────────────────────────
function FavCard({
  fav, fighter, isActive, isSelected, anySelected,
  onOpen, onSelect, onToggleNotify, onRemove,
}: {
  fav: FavRow; fighter: FighterRow; isActive: boolean; isSelected: boolean; anySelected: boolean;
  onOpen: () => void; onSelect: (e: React.MouseEvent) => void;
  onToggleNotify: () => void; onRemove: () => void;
}) {
  const { format } = useCurrency();
  const status = fighter.availability_status;
  const sports = (fighter.fighter_sports ?? []).filter(s => s.is_active);
  const sportSummary = sports.map(s => {
    const t = s.pro_w + s.pro_l + s.pro_d;
    return t === 0 ? s.sport.toUpperCase() : `${s.sport.toUpperCase()} ${s.pro_w}-${s.pro_l}-${s.pro_d}`;
  }).join(" · ");
  const location = [fighter.current_city, fighter.current_city_country].filter(Boolean).join(", ");
  const tags = fav.tags ?? [];

  return (
    <article
      className={cn(
        "fc-card fc-card--fav group cursor-pointer",
        isActive && "fc-card--fav-active"
      )}
      data-status={isActive ? undefined : status}
      onClick={onOpen}
    >
      {/* Left status accent */}
      <div className="fc-card-accent" aria-hidden style={isActive ? { backgroundColor: "oklch(0.55 0.24 25)" } : undefined} />

      {/* Photo + select checkbox */}
      <div className="relative shrink-0" onClick={onSelect}>
        {/* Checkbox */}
        <div className={cn(
          "absolute -left-1.5 -top-1.5 z-20 flex h-5 w-5 items-center justify-center rounded-full border-2 transition-all duration-150",
          isSelected
            ? "scale-100 border-primary bg-primary opacity-100"
            : anySelected
            ? "scale-100 border-border bg-card/90 opacity-100"
            : "scale-75 border-border bg-card/90 opacity-0 group-hover:scale-100 group-hover:opacity-100"
        )}>
          {isSelected && <Check className="h-2.5 w-2.5 text-primary-foreground" />}
        </div>
        {/* Circle photo */}
        <div className={cn(
          "h-11 w-11 overflow-hidden rounded-full ring-2",
          status === "available" ? "ring-available/35" : status === "in_camp" ? "ring-in-camp/35" : "ring-white/8"
        )}>
          {fighter.photo_url
            ? <img src={fighter.photo_url} alt="" className="h-full w-full object-cover" draggable={false} />
            : <div className="flex h-full w-full items-center justify-center bg-surface text-sm font-semibold text-muted-foreground">
                {[fighter.first_name?.[0], fighter.last_name?.[0]].filter(Boolean).join("").toUpperCase() || "?"}
              </div>
          }
        </div>
      </div>

      {/* Main info */}
      <div className="fc-card-main min-w-0">
        <h3 className="fc-name truncate">
          {fighter.first_name} {fighter.last_name}
        </h3>
        <div className="fc-card-row2 flex-wrap gap-x-2">
          <span className="fc-status shrink-0" data-status={status}>
            <span className="fc-status-dot" aria-hidden />
            {{ available: "Available", in_camp: "In Camp", unavailable: "Unavailable" }[status] ?? "Unknown"}
          </span>
          {fighter.nickname && (
            <span className="fc-nickname shrink-0">&ldquo;{fighter.nickname}&rdquo;</span>
          )}
          {sportSummary && (
            <>
              <span className="fc-row2-sep" aria-hidden />
              <span className="truncate text-muted-foreground/60 text-xs">{sportSummary}</span>
            </>
          )}
        </div>
        <div className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground/50">
          {location && <span className="flex shrink-0 items-center gap-0.5">
            <MapPin className="h-2.5 w-2.5 shrink-0" />{location}
          </span>}
          {fighter.purse_usd != null && <span className="shrink-0">{format(fighter.purse_usd)}</span>}
        </div>
        {tags.length > 0 && (
          <div className="mt-1.5 flex items-center gap-1 overflow-hidden"
            onClick={e => e.stopPropagation()}>
            {tags.map(tag => {
              const c = tagColor(tag);
              return (
                <span key={tag} className="shrink-0 rounded-full border px-2 text-[10px] font-medium leading-[18px]"
                  style={{ backgroundColor: c.bg, color: c.text, borderColor: c.border }}>
                  #{tag}
                </span>
              );
            })}
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="fc-card-actions" onClick={e => e.stopPropagation()}>
        <button
          onClick={onToggleNotify}
          className={cn("fc-fav", fav.notify && "fc-fav--on")}
          title={fav.notify ? "Stop notifications" : "Notify when available"}
        >
          {fav.notify
            ? <Bell className="h-4 w-4" />
            : <BellOff className="h-4 w-4" strokeWidth={1.5} />}
        </button>
        <button
          onClick={onRemove}
          className="fc-fav hover:text-destructive"
          title="Remove from saved"
        >
          <Trash2 className="h-4 w-4" strokeWidth={1.5} />
        </button>
      </div>
    </article>
  );
}

// ── DetailPanel ────────────────────────────────────────────────────────────────
function DetailPanel({
  fav, fighter, allTags,
  onClose, onToggleNotify, onRemove, onAddNote, onDeleteNote, onUpdateTags, onOpenProfile,
}: {
  fav: FavRow; fighter: FighterRow; allTags: string[];
  onClose: () => void; onToggleNotify: () => void; onRemove: () => void;
  onAddNote: (body: string) => void; onDeleteNote: (id: number) => void;
  onUpdateTags: (tags: string[]) => void; onOpenProfile: () => void;
}) {
  const { format } = useCurrency();
  const [tagPickerOpen, setTagPickerOpen] = useState(false);
  const notes = [...(fav.matchmaker_favourite_notes ?? [])].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );
  const sports = (fighter.fighter_sports ?? []).filter(s => s.is_active);
  const location = [fighter.current_city, fighter.current_city_country].filter(Boolean).join(", ");
  const status = fighter.availability_status;

  return (
    <aside className="flex h-full flex-col border-l border-border bg-sidebar shadow-[-4px_0_32px_oklch(0_0_0/18%)]">
      {/* Panel header */}
      <div className="flex shrink-0 items-center justify-between border-b border-border px-5 py-3">
        <span className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
          Saved Fighter
        </span>
        <button onClick={onClose} className="rounded-md p-1 text-muted-foreground hover:text-foreground">
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Scrollable content */}
      <div className="fd-drawer-scroll scrollbar-thin flex-1 overflow-y-auto">
        {/* Fighter header */}
        <div className="border-b border-border px-5 py-5">
          <div className="flex items-start gap-4">
            {/* Photo */}
            <div className="relative shrink-0">
              {fighter.photo_url
                ? <img src={fighter.photo_url} alt="" className="h-16 w-16 rounded-full object-cover ring-2 ring-border" />
                : <div className="flex h-16 w-16 items-center justify-center rounded-full bg-surface text-2xl font-semibold text-muted-foreground ring-2 ring-border">
                    {[fighter.first_name?.[0], fighter.last_name?.[0]].filter(Boolean).join("").toUpperCase() || "?"}
                  </div>
              }
              <div className="absolute -bottom-0.5 -right-0.5 h-4 w-4 rounded-full border-2 border-sidebar"
                style={{ backgroundColor: statusColor(status) }} />
            </div>
            {/* Name + status */}
            <div className="min-w-0 flex-1">
              <h2 className="text-lg font-semibold leading-tight text-foreground">
                {fighter.first_name} {fighter.last_name}
              </h2>
              {fighter.nickname && (
                <p className="text-sm italic text-muted-foreground">&ldquo;{fighter.nickname}&rdquo;</p>
              )}
              <div className="mt-2">
                <AvailabilityBadge status={status} />
              </div>
            </div>
          </div>
          <p className="mt-3 text-xs text-muted-foreground/40">
            Saved {relativeTime(fav.created_at)}
          </p>
        </div>

        {/* Info rows */}
        <div className="border-b border-border px-5 py-4 space-y-2.5">
          {location && (
            <InfoRow icon={<MapPin className="h-3.5 w-3.5" />} label="Location" value={location} />
          )}
          {fighter.purse_usd != null && (
            <InfoRow icon={<DollarSign className="h-3.5 w-3.5" />} label="Purse"
              value={`${format(fighter.purse_usd)}${fighter.purse_negotiable ? " (neg.)" : ""}`} />
          )}
          {fighter.available_from && (
            <InfoRow icon={<Calendar className="h-3.5 w-3.5" />}
              label={status === "in_camp" ? "Available from" : "Available"}
              value={formatAvailableFrom(fighter.available_from)} />
          )}
          {sports.map(s => {
            const total = s.pro_w + s.pro_l + s.pro_d;
            return (
              <div key={s.sport} className="flex items-center gap-2">
                <span className="w-24 shrink-0 text-xs text-muted-foreground/60">
                  {s.sport.toUpperCase()}
                </span>
                {total > 0 ? (
                  <div className="flex items-center gap-1 font-display text-sm tracking-wide">
                    <span className="text-available">{s.pro_w}W</span>
                    <span className="text-muted-foreground/30">·</span>
                    <span className="text-destructive">{s.pro_l}L</span>
                    {s.pro_d > 0 && <>
                      <span className="text-muted-foreground/30">·</span>
                      <span className="text-muted-foreground">{s.pro_d}D</span>
                    </>}
                  </div>
                ) : (
                  <span className="text-xs text-muted-foreground/40">No pro record</span>
                )}
              </div>
            );
          })}
        </div>

        {/* Tags */}
        <div className="border-b border-border px-5 py-4">
          <p className="mb-2.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/60">Tags</p>
          <div className="relative flex flex-wrap items-center gap-1.5">
            {(fav.tags ?? []).map(tag => {
              const c = tagColor(tag);
              return (
                <span key={tag}
                  className="inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium"
                  style={{ backgroundColor: c.bg, color: c.text, borderColor: c.border }}>
                  #{tag}
                  <button onClick={() => onUpdateTags((fav.tags ?? []).filter(t => t !== tag))}
                    className="opacity-50 hover:opacity-100">
                    <X className="h-3 w-3" />
                  </button>
                </span>
              );
            })}
            <button
              onClick={() => setTagPickerOpen(v => !v)}
              className="inline-flex items-center gap-1 rounded-full border border-dashed border-border px-2.5 py-1 text-xs text-muted-foreground/50 hover:border-border/80 hover:text-muted-foreground transition-colors"
            >
              <Plus className="h-3 w-3" /> Add tag
            </button>
            {tagPickerOpen && (
              <TagPicker
                allTags={allTags}
                currentTags={fav.tags ?? []}
                onUpdate={onUpdateTags}
                onClose={() => setTagPickerOpen(false)}
              />
            )}
          </div>
        </div>

        {/* Notes */}
        <div className="px-5 py-4">
          <p className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/60">Notes</p>
          <NoteLog notes={notes} onAdd={onAddNote} onDelete={onDeleteNote} />
        </div>
      </div>

      {/* Footer actions */}
      <div className="shrink-0 border-t border-border px-5 py-3 flex items-center justify-between">
        <button
          onClick={onOpenProfile}
          className="flex items-center gap-1.5 text-sm text-primary hover:text-primary/80 transition-colors"
        >
          Full profile <ExternalLink className="h-3.5 w-3.5" />
        </button>
        <div className="flex items-center gap-1">
          <button
            onClick={onToggleNotify}
            className={cn("rounded-md p-2 transition-colors",
              fav.notify ? "text-primary hover:text-primary/70" : "text-muted-foreground/40 hover:text-muted-foreground")}
            title={fav.notify ? "Stop notifications" : "Notify when available"}
          >
            {fav.notify ? <Bell className="h-4 w-4" /> : <BellOff className="h-4 w-4" />}
          </button>
          <button
            onClick={onRemove}
            className="rounded-md p-2 text-muted-foreground/40 hover:text-destructive transition-colors"
            title="Remove from saved"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>
    </aside>
  );
}

// ── InfoRow ────────────────────────────────────────────────────────────────────
function InfoRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center gap-2.5">
      <span className="text-muted-foreground/40">{icon}</span>
      <span className="w-24 shrink-0 text-xs text-muted-foreground/60">{label}</span>
      <span className="text-sm text-foreground/80">{value}</span>
    </div>
  );
}

// ── TagPicker ──────────────────────────────────────────────────────────────────
function TagPicker({ allTags, currentTags, onUpdate, onClose }: {
  allTags: string[]; currentTags: string[];
  onUpdate: (tags: string[]) => void; onClose: () => void;
}) {
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
    function onMouseDown(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) onClose();
    }
    document.addEventListener("mousedown", onMouseDown);
    return () => document.removeEventListener("mousedown", onMouseDown);
  }, [onClose]);

  const normalized = query.trim().toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
  const filtered   = allTags.filter(t => t.includes(query.toLowerCase().trim()));
  const canCreate  = normalized.length > 0 && !allTags.includes(normalized);

  function toggle(tag: string) {
    onUpdate(currentTags.includes(tag) ? currentTags.filter(t => t !== tag) : [...currentTags, tag]);
  }
  function create() {
    if (!canCreate) return;
    onUpdate([...currentTags, normalized]);
    setQuery("");
  }

  return (
    <div ref={containerRef}
      className="absolute left-0 top-full z-50 mt-1.5 w-52 overflow-hidden rounded-xl border border-border bg-popover shadow-[var(--shadow-elevated)]">
      <div className="border-b border-border px-3 py-2">
        <input ref={inputRef} value={query} onChange={e => setQuery(e.target.value)}
          onKeyDown={e => e.key === "Enter" && create()}
          placeholder="Search or create..."
          className="w-full bg-transparent text-xs text-foreground placeholder:text-muted-foreground/60 focus:outline-none" />
      </div>
      <div className="max-h-52 overflow-y-auto py-1">
        {canCreate && (
          <button onClick={create}
            className="flex w-full items-center gap-2 px-3 py-2 text-xs text-primary hover:bg-accent">
            <Plus className="h-3 w-3" /> Create &ldquo;#{normalized}&rdquo;
          </button>
        )}
        {filtered.length === 0 && !canCreate && (
          <p className="px-3 py-3 text-center text-xs text-muted-foreground">
            {allTags.length === 0 ? "Type to create your first tag" : "No matching tags"}
          </p>
        )}
        {filtered.map(tag => {
          const isOn = currentTags.includes(tag);
          const c = tagColor(tag);
          return (
            <button key={tag} onClick={() => toggle(tag)}
              className="flex w-full items-center gap-2.5 px-3 py-2 hover:bg-accent">
              <div className={cn("flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-sm border transition-colors",
                isOn ? "border-primary bg-primary" : "border-border")}>
                {isOn && <Check className="h-2.5 w-2.5 text-primary-foreground" />}
              </div>
              <span className="rounded-full border px-2 py-0.5 text-[10px] font-medium"
                style={{ backgroundColor: c.bg, color: c.text, borderColor: c.border }}>
                #{tag}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ── NoteLog ────────────────────────────────────────────────────────────────────
function NoteLog({ notes, onAdd, onDelete }: {
  notes: NoteRow[]; onAdd: (body: string) => void; onDelete: (id: number) => void;
}) {
  const [draft, setDraft] = useState("");

  function submit() {
    if (!draft.trim()) return;
    onAdd(draft.trim());
    setDraft("");
  }

  return (
    <div className="space-y-4">
      {notes.length > 0 && (
        <div className="space-y-3">
          {notes.map(note => (
            <div key={note.id} className="group/note flex gap-3">
              <div className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-border" />
              <div className="flex-1 min-w-0">
                <p className="text-sm leading-relaxed text-foreground/75">{note.body}</p>
                <div className="mt-1 flex items-center gap-2">
                  <span className="text-[11px] text-muted-foreground/40">{formatNoteDate(note.created_at)}</span>
                  <button onClick={() => onDelete(note.id)}
                    className="text-[11px] text-muted-foreground/30 opacity-0 transition-opacity hover:text-destructive group-hover/note:opacity-100">
                    Delete
                  </button>
                </div>
              </div>
            </div>
          ))}
          <div className="h-px bg-border/30" />
        </div>
      )}

      <div className="flex flex-col gap-2">
        <textarea
          value={draft}
          onChange={e => setDraft(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) submit(); }}
          placeholder={notes.length === 0 ? "Write your first note..." : "Add a note..."}
          rows={3}
          className="w-full resize-none rounded-lg border border-border/60 bg-surface p-3 text-sm text-foreground placeholder:text-muted-foreground/40 focus:border-border focus:outline-none focus:ring-1 focus:ring-ring"
        />
        {draft.trim() && (
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground/30">⌘↵ to save</span>
            <Button size="sm" onClick={submit}>Save note</Button>
          </div>
        )}
      </div>
    </div>
  );
}
