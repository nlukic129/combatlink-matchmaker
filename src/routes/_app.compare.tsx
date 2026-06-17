import { useState, useRef, useEffect } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { z } from "zod";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft, ArrowLeftRight, Heart, Instagram, Search, Shield,
  Swords, UserPlus, X, Zap,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { coercedStringArray } from "@/lib/search-params";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/auth-context";
import { useCurrency } from "@/contexts/currency-context";
import { AvailabilityBadge } from "@/components/ui/availability-badge";
import { Spinner } from "@/components/ui/spinner";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { FighterDrawer } from "@/components/fighter-drawer/fighter-drawer";
import type { Fighter } from "@/types/database";

// ── Schema ─────────────────────────────────────────────────────────────────────

const compareSchema = z.object({
  fighters: coercedStringArray,
  sport: z.string().optional(),
  gender: z.enum(["male", "female"]).optional(),
});

export const Route = createFileRoute("/_app/compare")({
  validateSearch: compareSchema,
  component: ComparePage,
});

// ── Helpers ────────────────────────────────────────────────────────────────────

const SPORT_LABELS: Record<string, string> = {
  mma: "MMA", boxing: "Boxing", kickboxing: "Kickboxing",
  muay_thai: "Muay Thai", wrestling: "Wrestling", bjj: "BJJ",
  grappling: "Grappling", judo: "Judo", karate: "Karate", sambo: "Sambo",
};
function sportLabel(slug: string): string {
  return SPORT_LABELS[slug.toLowerCase()] ?? slug.charAt(0).toUpperCase() + slug.slice(1).replace(/_/g, " ");
}

function calcAge(dob: string | null): number | null {
  if (!dob) return null;
  return Math.floor((Date.now() - new Date(dob).getTime()) / (365.25 * 24 * 60 * 60 * 1000));
}

function winRate(w: number, l: number, d: number): number | null {
  const total = w + l + d;
  if (total === 0) return null;
  return Math.round((w / total) * 100);
}

const METHOD_LABEL: Record<string, string> = {
  ko_tko: "KO / TKO", submission: "Sub", technical_submission: "Tech Sub",
  decision_unanimous: "UD", decision_split: "SD", decision_majority: "MD",
  technical_decision: "TD", draw: "Draw", dq: "DQ", no_contest: "NC",
};
function methodLabel(m: string | null): string | null {
  if (!m || m === "other") return null;
  return METHOD_LABEL[m] ?? m;
}

type FinishBucket = "ko" | "sub" | "dec" | "dq" | "other";
type FinishBreakdown = Record<FinishBucket, number>;

const FINISH_COLORS: Record<FinishBucket, string> = {
  ko: "#E8001D", sub: "#fb923c", dec: "rgba(255,255,255,0.55)", dq: "#a78bfa", other: "rgba(255,255,255,0.22)",
};
const FINISH_LABELS: Record<FinishBucket, string> = {
  ko: "KO / TKO", sub: "Submission", dec: "Decision", dq: "DQ", other: "Other",
};
const FINISH_ORDER: FinishBucket[] = ["ko", "sub", "dec", "dq", "other"];

function parseFightOutcome(result: AnyRow): "W" | "L" | "D" | "NC" {
  if (!result) return "NC";
  const k = String(result).trim().toLowerCase();
  if (k.startsWith("w")) return "W";
  if (k.startsWith("l")) return "L";
  if (k.startsWith("d")) return "D";
  return "NC";
}
function bucketMethod(method: string | null): FinishBucket {
  if (!method?.trim()) return "other";
  const s = method.trim().toLowerCase();
  if (/ko|tko|knock|stoppage|punches|strikes|corner|doctor|retirement|kick|elbow|pound|injur/.test(s)) return "ko";
  if (/sub|choke|armbar|triangle|kimura|guillotine|rear.?naked|tap|anaconda|north.?south|d.?arce/.test(s)) return "sub";
  if (/dec/.test(s)) return "dec";
  if (/\bdq\b|disqualif/.test(s)) return "dq";
  return "other";
}
function buildBreakdown(fights: AnyRow[], outcome: "W" | "L"): FinishBreakdown {
  const out: FinishBreakdown = { ko: 0, sub: 0, dec: 0, dq: 0, other: 0 };
  for (const f of fights) {
    if (parseFightOutcome(f.result) !== outcome) continue;
    const resultStr = String(f.result ?? "").toLowerCase();
    const isDq = /\bdq\b|disqualif/.test(resultStr);
    out[isDq ? "dq" : bucketMethod(f.method)] += 1;
  }
  return out;
}
function buildCareerHighlights(fights: AnyRow[]): { titleFights: number; titlesWon: number; bonusCount: number } {
  let titleFights = 0, titlesWon = 0, bonusCount = 0;
  for (const f of fights) {
    if (f.title_bout?.trim()) {
      titleFights += 1;
      if (parseFightOutcome(f.result) === "W") titlesWon += 1;
    }
    for (const b of (f.bonuses ?? [])) { if (b?.trim()) bonusCount += 1; }
  }
  return { titleFights, titlesWon, bonusCount };
}

function recentForm(fights: AnyRow[]): { streak: number; type: "W" | "L" | "D" | null } {
  if (fights.length === 0) return { streak: 0, type: null };
  const first = parseFightOutcome(fights[0].result);
  if (first === "NC") return { streak: 0, type: null };
  let streak = 0;
  for (const f of fights) {
    const o = parseFightOutcome(f.result);
    if (o !== first) break;
    streak += 1;
  }
  return { streak, type: first };
}

type AdvDir = "left" | "right" | "equal" | "none";
function calcAdv(
  l: number | null | undefined,
  r: number | null | undefined,
  dir: "higher" | "lower",
): AdvDir {
  if (l == null || r == null) return "none";
  if (l === r) return "equal";
  return (dir === "higher" ? l > r : l < r) ? "left" : "right";
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyRow = any;

function useFighterData(fighterId: string | null, sport: string | undefined) {
  const fighter = useQuery<Fighter | null>({
    queryKey: ["fighter-detail", fighterId],
    enabled: !!fighterId,
    queryFn: async () => {
      const { data } = await supabase
        .from("fighters").select("*")
        .eq("id", fighterId!).eq("identity_verified", true).maybeSingle();
      return (data as Fighter | null) ?? null;
    },
  });

  const sports = useQuery<AnyRow[]>({
    queryKey: ["fighter-sports", fighterId],
    enabled: !!fighterId,
    queryFn: async () => {
      const { data } = await supabase
        .from("fighter_sports")
        .select(`id, sport, level, pro_w, pro_l, pro_d, amateur_w, amateur_l, amateur_d, is_active,
          fighter_sport_weight_classes(weight_classes(id, name, limit_kg)),
          fighter_sport_fight_styles(fight_styles(id, label, slug))`)
        .eq("user_id", fighterId!);
      return data ?? [];
    },
  });

  const fights = useQuery<AnyRow[]>({
    queryKey: ["fighter-fights-compare", fighterId, sport],
    enabled: !!fighterId,
    queryFn: async () => {
      const { data } = await supabase
        .from("opponents").select("*")
        .eq("user_id", fighterId!)
        .order("event_date", { ascending: false, nullsFirst: false });
      const all = (data ?? []) as AnyRow[];
      return sport ? all.filter(f => !f.sport || f.sport === sport) : all;
    },
  });

  const follower = useQuery<number | null>({
    queryKey: ["fighter-social", fighterId],
    enabled: !!fighterId,
    queryFn: async () => {
      const { data } = await supabase
        .from("fighter_social_snapshots").select("follower_count")
        .eq("fighter_id", fighterId!)
        .order("recorded_at", { ascending: false }).limit(1).maybeSingle();
      return data?.follower_count ?? null;
    },
  });

  const activeSport = sports.data?.find((s: AnyRow) => s.sport === sport) ?? sports.data?.[0] ?? null;
  const allFights = fights.data ?? [];
  const lastFights = allFights.slice(0, 5);
  const winBreakdown = buildBreakdown(allFights, "W");
  const wbTotal = winBreakdown.ko + winBreakdown.sub + winBreakdown.dec + winBreakdown.other;

  return {
    fighter: fighter.data ?? null,
    activeSport,
    lastFights,
    winMethods: { ...winBreakdown, total: wbTotal },
    winBreakdown,
    lossBreakdown: buildBreakdown(allFights, "L"),
    careerHighlights: buildCareerHighlights(allFights),
    followerCount: follower.data ?? null,
    form: recentForm(lastFights),
    isLoading: fighter.isLoading || sports.isLoading || fights.isLoading,
  };
}

type FighterData = ReturnType<typeof useFighterData>;

type SectionId = "physical" | "record" | "booking" | "visibility" | "career" | "breakdown" | "history";
const SECTIONS: { id: SectionId; label: string }[] = [
  { id: "physical", label: "Physical" },
  { id: "record", label: "Record" },
  { id: "booking", label: "Booking" },
  { id: "visibility", label: "Visibility" },
  { id: "career", label: "Career" },
  { id: "breakdown", label: "Finish Methods" },
  { id: "history", label: "Recent Fights" },
];

// ── Main page ─────────────────────────────────────────────────────────────────

function ComparePage() {
  const { fighters: rawIds, sport, gender } = Route.useSearch();
  const navigate = useNavigate({ from: "/compare" });
  const [drawerFighterId, setDrawerFighterId] = useState<string | null>(null);
  const [activeSection, setActiveSection] = useState<SectionId>("physical");

  const leftId = rawIds[0] ?? null;
  const rightId = rawIds[1] ?? null;

  function setLeft(id: string | null) {
    const ids = [id, rightId].filter((x): x is string => x !== null);
    navigate({ search: (s) => ({ ...s, fighters: ids }), replace: true });
  }
  function setRight(id: string | null) {
    const ids = [leftId, id].filter((x): x is string => x !== null);
    navigate({ search: (s) => ({ ...s, fighters: ids }), replace: true });
  }
  function swapFighters() {
    if (!leftId && !rightId) return;
    navigate({ search: (s) => ({ ...s, fighters: [rightId, leftId].filter((x): x is string => x !== null) }), replace: true });
  }

  const left = useFighterData(leftId, sport);
  const right = useFighterData(rightId, sport);
  const bothLoaded = left.fighter !== null && right.fighter !== null;

  if (!leftId && !rightId && !sport) {
    return (
      <div className="cmp-page">
        <div className="cmp-empty">
          <div className="cmp-empty-icon">
            <Swords className="h-7 w-7" />
          </div>
          <h1 className="cmp-empty-title">Head to Head</h1>
          <p className="cmp-empty-desc">
            Select two fighters from search to analyse their matchup side by side — records, physical attributes, booking details, and fight history.
          </p>
          <Button asChild size="lg">
            <Link to="/search">
              <Search className="h-4 w-4" />
              Find fighters
            </Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="cmp-page">
      <div className="cmp-inner">
        {/* Header */}
        <header className="cmp-header">
          <div>
            <Link to="/search" search={{ sport, gender }} className="cmp-back">
              <ArrowLeft className="h-3.5 w-3.5" />
              Back to search
            </Link>
            <div className="cmp-eyebrow">Matchup Analysis</div>
            <h1 className="cmp-title">HEAD TO HEAD</h1>
            {sport && (
              <span className="cmp-sport-pill">
                {sportLabel(sport)}
                {gender ? ` · ${gender === "female" ? "Women" : "Men"}` : ""}
              </span>
            )}
          </div>
          {bothLoaded && (
            <div className="cmp-header-actions">
              <button type="button" onClick={swapFighters} className="cmp-swap-btn" aria-label="Swap fighters">
                <ArrowLeftRight className="h-3.5 w-3.5" />
                Swap sides
              </button>
            </div>
          )}
        </header>

        {/* Arena */}
        <div className="cmp-arena">
          <FighterPanel
            side="left"
            data={left}
            sport={sport}
            gender={gender}
            otherFighterId={rightId}
            onSelect={setLeft}
            onRemove={() => setLeft(null)}
            onOpenDrawer={setDrawerFighterId}
          />
          <div className="cmp-vs-col">
            <div className="cmp-vs" aria-hidden>VS</div>
          </div>
          <FighterPanel
            side="right"
            data={right}
            sport={sport}
            gender={gender}
            otherFighterId={leftId}
            onSelect={setRight}
            onRemove={() => setRight(null)}
            onOpenDrawer={setDrawerFighterId}
          />
        </div>

        {bothLoaded && (
          <>
            <MatchInsights left={left} right={right} />

            <nav className="cmp-section-nav" aria-label="Comparison sections" role="tablist">
              {SECTIONS.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  role="tab"
                  id={`cmp-tab-${s.id}`}
                  aria-selected={activeSection === s.id}
                  aria-controls={`cmp-section-${s.id}`}
                  className={cn("cmp-section-tab", activeSection === s.id && "cmp-section-tab--active")}
                  onClick={() => setActiveSection(s.id)}
                >
                  {s.label}
                </button>
              ))}
            </nav>

            <ComparisonSections
              left={left}
              right={right}
              sport={sport}
              activeSection={activeSection}
            />
          </>
        )}
      </div>

      {drawerFighterId && (
        <FighterDrawer
          fighterId={drawerFighterId}
          activeSport={sport}
          onClose={() => setDrawerFighterId(null)}
        />
      )}
    </div>
  );
}

// ── Fighter panel (poster) ────────────────────────────────────────────────────

function FighterPanel({
  side, data, sport, gender, otherFighterId, onSelect, onRemove, onOpenDrawer,
}: {
  side: "left" | "right";
  data: FighterData;
  sport: string | undefined;
  gender: "male" | "female" | undefined;
  otherFighterId: string | null;
  onSelect: (id: string) => void;
  onRemove: () => void;
  onOpenDrawer: (id: string) => void;
}) {
  const qc = useQueryClient();
  const { matchmaker } = useAuth();
  const { format } = useCurrency();
  const fighterId = data.fighter?.id ?? null;

  const { data: isFavourite } = useQuery({
    queryKey: ["favourite", fighterId],
    enabled: !!fighterId,
    queryFn: async () => {
      const { data: row } = await supabase
        .from("matchmaker_favourites").select("id")
        .eq("fighter_id", fighterId!).maybeSingle();
      return !!row;
    },
  });

  const toggleFav = useMutation({
    mutationFn: async () => {
      if (!fighterId) return;
      if (isFavourite) {
        await supabase.from("matchmaker_favourites").delete().eq("fighter_id", fighterId);
      } else {
        await supabase.from("matchmaker_favourites").insert({ matchmaker_id: matchmaker!.id, fighter_id: fighterId });
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["favourite", fighterId] });
      qc.invalidateQueries({ queryKey: ["favourites"] });
      qc.invalidateQueries({ queryKey: ["saved-fighter-ids"] });
    },
  });

  if (data.isLoading) {
    return <div className="cmp-poster-loading"><Spinner size="lg" /></div>;
  }

  if (!data.fighter) {
    return (
      <div className="cmp-poster-empty">
        <div className="cmp-poster-empty-icon">
          <UserPlus className="h-5 w-5" />
        </div>
        <p className="cmp-poster-empty-title">Add fighter</p>
        <p className="cmp-poster-empty-desc">Search by name to build your matchup</p>
        <InlineSearch sport={sport} gender={gender} excludeId={otherFighterId} onSelect={onSelect} />
      </div>
    );
  }

  const f = data.fighter;
  const sp = data.activeSport as AnyRow | null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const weightClasses = (sp?.fighter_sport_weight_classes ?? []).map((r: any) => r.weight_classes).filter(Boolean) as AnyRow[];
  const primaryWC = weightClasses[0];
  const total = sp ? sp.pro_w + sp.pro_l + sp.pro_d : 0;
  const rate = sp && total > 0 ? winRate(sp.pro_w, sp.pro_l, sp.pro_d) : null;
  const initials = [f.first_name?.[0], f.last_name?.[0]].filter(Boolean).join("").toUpperCase();

  return (
    <div className={cn("cmp-poster", side === "left" ? "cmp-poster--left" : "cmp-poster--right")}>
      <div className="cmp-poster-accent" aria-hidden />
      <div className="cmp-poster-corner" aria-hidden />

      <button type="button" onClick={onRemove} className="cmp-poster-remove" aria-label="Remove fighter">
        <X className="h-3.5 w-3.5" />
      </button>

      <div className="cmp-poster-body">
        <div className="cmp-poster-hero">
          <div className="cmp-poster-spotlight" aria-hidden />
          <div className="cmp-poster-avatar-ring">
            <Avatar
              src={f.photo_url}
              alt={f.first_name}
              fallback={initials || "?"}
              size="xl"
              className="cmp-poster-avatar-img h-[5.25rem] w-[5.25rem] text-2xl"
            />
            {f.identity_verified && (
              <div className="cmp-poster-verified">
                <Shield className="h-2.5 w-2.5 text-available" />
              </div>
            )}
          </div>
        </div>

        <div className="cmp-poster-content">
          <div className="cmp-poster-zone cmp-poster-zone--identity">
            <h2 className="cmp-poster-name">{f.first_name} {f.last_name}</h2>
            <p className="cmp-poster-nick">
              {f.nickname ? `\u201C${f.nickname}\u201D` : "\u00A0"}
            </p>
            <p className="cmp-poster-loc">
              {[f.country, f.current_city].filter(Boolean).join(" · ") || "—"}
            </p>
            <div className="cmp-poster-status">
              <AvailabilityBadge status={f.availability_status} />
            </div>
          </div>

          <div className="cmp-poster-zone cmp-poster-zone--record">
            {sp && total > 0 ? (
              <>
                <RecordBlock w={sp.pro_w} l={sp.pro_l} d={sp.pro_d} />
                <p className="cmp-poster-record-meta">
                  {rate != null ? `${rate}% win rate` : "\u00A0"}
                </p>
              </>
            ) : (
              <p className="cmp-poster-zone-empty">No record</p>
            )}
          </div>

          <div className="cmp-poster-zone cmp-poster-zone--tags">
            <div className="cmp-poster-tags">
              {primaryWC && <span className="cmp-tag">{primaryWC.name}</span>}
              {sp?.level && (
                <span className="cmp-tag">{sp.level === "pro" ? "Professional" : "Amateur"}</span>
              )}
            </div>
          </div>

          <div className="cmp-poster-zone cmp-poster-zone--booking">
            <div className="cmp-poster-booking">
              <div className="cmp-booking-stat">
                <span className="cmp-booking-stat-lbl">Purse</span>
                <span className="cmp-booking-stat-val">
                  {f.purse_usd != null ? (
                    <>
                      {format(f.purse_usd)}
                      {f.purse_negotiable && (
                        <span className="text-muted-foreground/60 font-normal"> · Neg.</span>
                      )}
                    </>
                  ) : "—"}
                </span>
              </div>
              <div className="cmp-booking-stat">
                <span className="cmp-booking-stat-lbl">Prep time</span>
                <span className="cmp-booking-stat-val">
                  {f.preparation_weeks != null ? `${f.preparation_weeks} weeks` : "—"}
                </span>
              </div>
              <div className="cmp-booking-stat cmp-booking-stat--wide">
                <span className="cmp-booking-stat-lbl">Short notice</span>
                <span className={cn(
                  "cmp-booking-stat-val",
                  f.open_to_short_notice && "inline-flex items-center gap-1 text-emerald-400",
                )}>
                  {f.open_to_short_notice ? (
                    <><Zap className="h-3 w-3 shrink-0" /> Yes</>
                  ) : (
                    <span className="text-muted-foreground font-normal">No</span>
                  )}
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="cmp-poster-actions">
          <Button
            variant="outline"
            size="sm"
            onClick={() => toggleFav.mutate()}
            className={cn("flex-1", isFavourite && "border-red-500/40 text-red-400")}
          >
            <Heart className={cn("h-3.5 w-3.5", isFavourite && "fill-current")} />
            {isFavourite ? "Saved" : "Save"}
          </Button>
          <Button variant="outline" size="sm" className="flex-1" onClick={() => onOpenDrawer(f.id)}>
            Full profile
          </Button>
        </div>
      </div>
    </div>
  );
}

type SearchHit = {
  id: string; first_name: string; last_name: string | null;
  country: string | null; photo_url: string | null; availability_status: string;
};

function InlineSearch({
  sport, gender, excludeId, onSelect,
}: {
  sport: string | undefined;
  gender: "male" | "female" | undefined;
  excludeId: string | null;
  onSelect: (id: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const trimmed = query.trim();

  const { data: results = [], isLoading: searching } = useQuery<SearchHit[]>({
    queryKey: ["inline-fighter-search", trimmed, sport, gender, excludeId],
    enabled: trimmed.length >= 2,
    staleTime: 30_000,
    queryFn: async () => {
      let q = supabase
        .from("fighters")
        .select("id, first_name, last_name, country, photo_url, availability_status")
        .eq("identity_verified", true);
      if (gender) q = q.eq("gender", gender);
      q = (q as ReturnType<typeof q.eq>).or(`first_name.ilike.%${trimmed}%,last_name.ilike.%${trimmed}%`);
      const { data } = await q.limit(12);
      let hits = ((data ?? []) as SearchHit[]).filter(f => f.id !== excludeId);

      if (sport && hits.length > 0) {
        const ids = hits.map(h => h.id);
        const { data: sportRows } = await supabase
          .from("fighter_sports").select("user_id").in("user_id", ids).eq("sport", sport);
        const valid = new Set((sportRows ?? []).map(r => r.user_id));
        hits = hits.filter(h => valid.has(h.id));
      }

      return hits.slice(0, 8);
    },
  });

  useEffect(() => { inputRef.current?.focus(); }, []);

  useEffect(() => {
    function onDown(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, []);

  return (
    <div ref={containerRef} className="cmp-search">
      <div className="cmp-search-input-wrap">
        <Search className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
          onFocus={() => trimmed.length >= 2 && setOpen(true)}
          placeholder="Search by name…"
          className="cmp-search-input"
        />
        {searching && trimmed.length >= 2 && <Spinner size="sm" />}
      </div>

      {open && trimmed.length >= 2 && (
        <div className="cmp-search-dropdown scrollbar-thin">
          {results.length === 0 ? (
            <p className="px-4 py-3 text-sm text-muted-foreground">No fighters found</p>
          ) : (
            results.map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => { onSelect(f.id); setQuery(""); setOpen(false); }}
                className="cmp-search-hit"
              >
                <Avatar
                  src={f.photo_url}
                  alt={f.first_name}
                  fallback={f.first_name?.[0] ?? "?"}
                  size="sm"
                  className="h-7 w-7 text-[10px]"
                />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-foreground leading-tight">
                    {f.first_name} {f.last_name}
                  </p>
                  {f.country && <p className="text-xs text-muted-foreground">{f.country}</p>}
                </div>
                <span className={cn(
                  "h-2 w-2 rounded-full shrink-0",
                  f.availability_status === "available" ? "bg-emerald-400" :
                  f.availability_status === "in_camp" ? "bg-orange-400" : "bg-muted-foreground/30",
                )} />
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}

// ── Record block ───────────────────────────────────────────────────────────────

function RecordBlock({ w, l, d }: { w: number; l: number; d: number }) {
  const total = w + l + d;
  return (
    <div>
      <div className="cmp-record-row">
        <span className="cmp-record-num cmp-record-num--win">{w}</span>
        <span className="cmp-record-lbl cmp-record-num--win">W</span>
        <span className="text-muted-foreground/20 text-lg mx-0.5">–</span>
        <span className="cmp-record-num cmp-record-num--loss">{l}</span>
        <span className="cmp-record-lbl cmp-record-num--loss">L</span>
        {d > 0 && (
          <>
            <span className="text-muted-foreground/20 text-lg mx-0.5">–</span>
            <span className="cmp-record-num cmp-record-num--draw">{d}</span>
            <span className="cmp-record-lbl cmp-record-num--draw">D</span>
          </>
        )}
      </div>
      {total > 0 && (
        <div className="cmp-record-bar">
          <div className="cmp-record-bar-seg--win transition-all" style={{ width: `${(w / total) * 100}%` }} />
          <div className="cmp-record-bar-seg--loss transition-all" style={{ width: `${(l / total) * 100}%` }} />
          {d > 0 && <div className="cmp-record-bar-seg--draw transition-all" style={{ width: `${(d / total) * 100}%` }} />}
        </div>
      )}
    </div>
  );
}

// ── Match insights ─────────────────────────────────────────────────────────────

const AVAIL_SHORT: Record<string, string> = {
  available: "Available",
  in_camp: "In camp",
  unavailable: "Unavailable",
};
function availShort(status: string): string {
  return AVAIL_SHORT[status] ?? status;
}

function purseHeadline(adv: AdvDir, leftName: string, rightName: string): string {
  if (adv === "equal") return "Same purse";
  if (adv === "none") return "—";
  const leader = adv === "left" ? leftName : rightName;
  return `${leader} · higher purse`;
}

function purseDetailLine(
  leftName: string,
  rightName: string,
  leftPurse: number | null,
  rightPurse: number | null,
  format: (n: number) => string,
): string | undefined {
  if (leftPurse == null && rightPurse == null) return undefined;
  const l = leftPurse != null ? format(leftPurse) : "—";
  const r = rightPurse != null ? format(rightPurse) : "—";
  return `${leftName} ${l} vs ${rightName} ${r}`;
}

function insightHeadline(
  adv: AdvDir,
  leftName: string,
  rightName: string,
  equalText: string,
  detail?: string,
): string {
  if (adv === "equal") return equalText;
  if (adv === "none") return detail ?? "—";
  const leader = adv === "left" ? leftName : rightName;
  return detail ? `${leader} · ${detail}` : `${leader} leads`;
}

function MatchInsights({ left, right }: { left: FighterData; right: FighterData }) {
  const lf = left.fighter!;
  const rf = right.fighter!;
  const ls = left.activeSport as AnyRow | null;
  const rs = right.activeSport as AnyRow | null;
  const { format } = useCurrency();

  const lRate = ls ? winRate(ls.pro_w, ls.pro_l, ls.pro_d) : null;
  const rRate = rs ? winRate(rs.pro_w, rs.pro_l, rs.pro_d) : null;
  const rateAdv = calcAdv(lRate, rRate, "higher");

  const heightAdv = calcAdv(lf.height_cm, rf.height_cm, "higher");
  const heightDelta = lf.height_cm != null && rf.height_cm != null
    ? Math.abs(lf.height_cm - rf.height_cm) : null;

  const lProTotal = ls ? ls.pro_w + ls.pro_l + ls.pro_d : null;
  const rProTotal = rs ? rs.pro_w + rs.pro_l + rs.pro_d : null;
  const expAdv = calcAdv(lProTotal, rProTotal, "higher");
  const expDelta = lProTotal != null && rProTotal != null
    ? Math.abs(lProTotal - rProTotal) : null;

  const bothAvailable = lf.availability_status === "available"
    && rf.availability_status === "available";

  const lKoPct = left.winMethods.total > 0
    ? Math.round((left.winMethods.ko / left.winMethods.total) * 100) : null;
  const rKoPct = right.winMethods.total > 0
    ? Math.round((right.winMethods.ko / right.winMethods.total) * 100) : null;
  const koAdv = calcAdv(lKoPct, rKoPct, "higher");
  const koDelta = lKoPct != null && rKoPct != null ? Math.abs(lKoPct - rKoPct) : null;

  const winRateDetail = lRate != null && rRate != null
    ? `${lRate}% vs ${rRate}%`
    : lRate != null ? `${lRate}% vs —` : rRate != null ? `— vs ${rRate}%` : undefined;

  const heightDetail = lf.height_cm != null && rf.height_cm != null
    ? `${lf.height_cm} vs ${rf.height_cm} cm`
    : lf.height_cm != null ? `${lf.height_cm} cm vs —`
    : rf.height_cm != null ? `— vs ${rf.height_cm} cm` : undefined;

  const expDetail = lProTotal != null && rProTotal != null
    ? `${lProTotal} vs ${rProTotal} fights`
    : lProTotal != null ? `${lProTotal} vs — fights`
    : rProTotal != null ? `— vs ${rProTotal} fights` : undefined;

  const bookingDetail = `${availShort(lf.availability_status)} vs ${availShort(rf.availability_status)}`;

  const purseDetail = purseDetailLine(
    lf.first_name, rf.first_name, lf.purse_usd, rf.purse_usd, format,
  );

  const purseAdv = calcAdv(lf.purse_usd, rf.purse_usd, "higher");

  const koDetail = `${lKoPct != null ? `${lKoPct}%` : "—"} vs ${rKoPct != null ? `${rKoPct}%` : "—"}`;

  const insights = [
    {
      label: "Win rate",
      headline: insightHeadline(rateAdv, lf.first_name, rf.first_name, "Even win rate"),
      detail: winRateDetail,
    },
    {
      label: "Height",
      headline: insightHeadline(
        heightAdv, lf.first_name, rf.first_name, "Same height",
        heightDelta != null ? `+${heightDelta} cm` : undefined,
      ),
      detail: heightDetail,
    },
    {
      label: "Experience",
      headline: insightHeadline(
        expAdv, lf.first_name, rf.first_name, "Same experience",
        expDelta != null && expDelta > 0 ? `+${expDelta} fights` : undefined,
      ),
      detail: expDetail,
    },
    {
      label: "Booking",
      headline: bothAvailable ? "Both ready now" : "Check availability",
      detail: bookingDetail,
    },
    {
      label: "Purse",
      headline: purseHeadline(purseAdv, lf.first_name, rf.first_name),
      detail: purseDetail,
    },
    {
      label: "KO rate",
      headline: insightHeadline(
        koAdv, lf.first_name, rf.first_name, "Same KO finish rate",
        koDelta != null && koDelta > 0 ? `+${koDelta}%` : undefined,
      ),
      detail: koDetail,
    },
  ];

  return (
    <div className="cmp-insights">
      {insights.map((ins) => (
        <div key={ins.label} className="cmp-insight">
          <span className="cmp-insight-lbl">{ins.label}</span>
          <span className="cmp-insight-headline">{ins.headline}</span>
          {ins.detail && (
            <span className="cmp-insight-detail">{ins.detail}</span>
          )}
        </div>
      ))}
    </div>
  );
}

// ── Comparison sections ────────────────────────────────────────────────────────

function sectionTitle(id: SectionId, sport: string | undefined): string {
  if (id === "record") return `Record${sport ? ` · ${sportLabel(sport)}` : ""}`;
  if (id === "career") return "Career Highlights";
  if (id === "breakdown") return "Finish Methods";
  if (id === "history") return "Recent Fights";
  return SECTIONS.find((s) => s.id === id)?.label ?? id;
}

function ComparisonSections({
  left, right, sport, activeSection,
}: {
  left: FighterData;
  right: FighterData;
  sport: string | undefined;
  activeSection: SectionId;
}) {
  return (
    <CmpSection id={activeSection} title={sectionTitle(activeSection, sport)}>
      {activeSection === "physical" && <PhysicalSection left={left} right={right} />}
      {activeSection === "record" && <RecordSection left={left} right={right} sport={sport} />}
      {activeSection === "booking" && <BookingSection left={left} right={right} />}
      {activeSection === "visibility" && <VisibilitySection left={left} right={right} />}
      {activeSection === "career" && <CareerSection left={left} right={right} />}
      {activeSection === "breakdown" && <BreakdownSection left={left} right={right} />}
      {activeSection === "history" && <HistorySection left={left} right={right} />}
    </CmpSection>
  );
}

function CmpSection({
  id, title, children,
}: {
  id: SectionId;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section
      id={`cmp-section-${id}`}
      role="tabpanel"
      aria-labelledby={`cmp-tab-${id}`}
      className="cmp-section"
    >
      <div className="cmp-section-head">
        <h2 className="cmp-section-title">{title}</h2>
        <div className="cmp-section-line" aria-hidden />
      </div>
      {children}
    </section>
  );
}

function CompareRow({
  label, left, right, adv = "none",
}: {
  label: string;
  left: React.ReactNode;
  right: React.ReactNode;
  adv?: AdvDir;
}) {
  return (
    <div className="cmp-compare-row">
      <div className={cn("cmp-compare-cell cmp-compare-cell--left", adv === "left" && "cmp-compare-cell--adv")}>
        {left}
      </div>
      <div className="cmp-compare-label">
        <span className="cmp-compare-label-text">{label}</span>
      </div>
      <div className={cn("cmp-compare-cell cmp-compare-cell--right", adv === "right" && "cmp-compare-cell--adv")}>
        {right}
      </div>
    </div>
  );
}

function PhysicalBar({
  value, max, adv, side,
}: {
  value: number;
  max: number;
  adv: boolean;
  side: "left" | "right";
}) {
  const pct = max > 0 ? (value / max) * 100 : 0;
  return (
    <div className={cn("cmp-phys-bar-wrap", side === "left" ? "cmp-phys-bar-wrap--left" : "cmp-phys-bar-wrap--right")}>
      <span className={cn("cmp-phys-val", adv && "text-emerald-400")}>{value} cm</span>
      <div className="cmp-phys-bar">
        <div
          className={cn("cmp-phys-bar-fill", adv && "cmp-phys-bar-fill--adv")}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

function PhysicalSection({ left, right }: { left: FighterData; right: FighterData }) {
  const lf = left.fighter!;
  const rf = right.fighter!;
  const maxHeight = Math.max(lf.height_cm ?? 0, rf.height_cm ?? 0, 1);
  const maxReach = Math.max(lf.reach_cm ?? 0, rf.reach_cm ?? 0, 1);
  const heightAdv = calcAdv(lf.height_cm, rf.height_cm, "higher");
  const reachAdv = calcAdv(lf.reach_cm, rf.reach_cm, "higher");

  return (
    <div className="cmp-compare-card">
      <CompareRow
        label="Age"
        left={calcAge(lf.dob) != null ? `${calcAge(lf.dob)} yrs` : "—"}
        right={calcAge(rf.dob) != null ? `${calcAge(rf.dob)} yrs` : "—"}
      />
      <CompareRow
        label="Height"
        left={lf.height_cm ? <PhysicalBar value={lf.height_cm} max={maxHeight} adv={heightAdv === "left"} side="left" /> : "—"}
        right={rf.height_cm ? <PhysicalBar value={rf.height_cm} max={maxHeight} adv={heightAdv === "right"} side="right" /> : "—"}
        adv={heightAdv}
      />
      <CompareRow
        label="Reach"
        left={lf.reach_cm ? <PhysicalBar value={lf.reach_cm} max={maxReach} adv={reachAdv === "left"} side="left" /> : "—"}
        right={rf.reach_cm ? <PhysicalBar value={rf.reach_cm} max={maxReach} adv={reachAdv === "right"} side="right" /> : "—"}
        adv={reachAdv}
      />
      <CompareRow label="Stance" left={lf.stance ?? "—"} right={rf.stance ?? "—"} />
    </div>
  );
}

function WinMethodsBar({ ko, sub, dec, other, total }: {
  ko: number; sub: number; dec: number; other: number; total: number;
}) {
  if (total === 0) return <span className="text-sm text-muted-foreground">—</span>;
  const segments = [
    { value: ko, label: "KO", color: "#f87171" },
    { value: sub, label: "Sub", color: "#fb923c" },
    { value: dec, label: "Dec", color: "rgba(255,255,255,0.38)" },
    { value: other, label: "Other", color: "rgba(255,255,255,0.14)" },
  ].filter((s) => s.value > 0);

  return (
    <div>
      <div className="cmp-methods-bar">
        {segments.map((s, i) => (
          <div key={i} style={{ width: `${(s.value / total) * 100}%`, background: s.color }}
            title={`${s.label}: ${s.value}`} />
        ))}
      </div>
      <div className="cmp-methods-legend">
        {segments.map((s, i) => (
          <span key={i} className="cmp-methods-legend-item">
            <span className="cmp-methods-dot" style={{ background: s.color }} />
            {s.label} {Math.round((s.value / total) * 100)}%
          </span>
        ))}
      </div>
    </div>
  );
}

function RecordSection({ left, right, sport }: { left: FighterData; right: FighterData; sport: string | undefined }) {
  const ls = left.activeSport as AnyRow | null;
  const rs = right.activeSport as AnyRow | null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const lWc = (ls?.fighter_sport_weight_classes ?? []).map((r: any) => r.weight_classes).filter(Boolean) as AnyRow[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rWc = (rs?.fighter_sport_weight_classes ?? []).map((r: any) => r.weight_classes).filter(Boolean) as AnyRow[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const lFs = (ls?.fighter_sport_fight_styles ?? []).map((r: any) => r.fight_styles).filter(Boolean) as AnyRow[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rFs = (rs?.fighter_sport_fight_styles ?? []).map((r: any) => r.fight_styles).filter(Boolean) as AnyRow[];

  const lAmateurTotal = ls ? ls.amateur_w + ls.amateur_l + ls.amateur_d : 0;
  const rAmateurTotal = rs ? rs.amateur_w + rs.amateur_l + rs.amateur_d : 0;
  const lRate = ls ? winRate(ls.pro_w, ls.pro_l, ls.pro_d) : null;
  const rRate = rs ? winRate(rs.pro_w, rs.pro_l, rs.pro_d) : null;

  return (
    <div className="cmp-compare-card">
      <CompareRow
        label="Pro record"
        left={ls ? <RecordBlock w={ls.pro_w} l={ls.pro_l} d={ls.pro_d} /> : "—"}
        right={rs ? <RecordBlock w={rs.pro_w} l={rs.pro_l} d={rs.pro_d} /> : "—"}
        adv={calcAdv(ls?.pro_w, rs?.pro_w, "higher")}
      />
      {(lRate != null || rRate != null) && (
        <CompareRow
          label="Win rate"
          left={lRate != null ? (
            <span className="font-display text-2xl tracking-wide">{lRate}%</span>
          ) : "—"}
          right={rRate != null ? (
            <span className="font-display text-2xl tracking-wide">{rRate}%</span>
          ) : "—"}
          adv={calcAdv(lRate, rRate, "higher")}
        />
      )}
      <CompareRow
        label="Win methods"
        left={<WinMethodsBar {...left.winMethods} />}
        right={<WinMethodsBar {...right.winMethods} />}
      />
      {(lAmateurTotal > 0 || rAmateurTotal > 0) && (
        <CompareRow
          label="Amateur"
          left={lAmateurTotal > 0 && ls ? `${ls.amateur_w}W ${ls.amateur_l}L ${ls.amateur_d}D` : "—"}
          right={rAmateurTotal > 0 && rs ? `${rs.amateur_w}W ${rs.amateur_l}L ${rs.amateur_d}D` : "—"}
          adv={calcAdv(lAmateurTotal > 0 ? ls?.amateur_w : null, rAmateurTotal > 0 ? rs?.amateur_w : null, "higher")}
        />
      )}
      {(ls?.level || rs?.level) && (
        <CompareRow
          label="Level"
          left={ls?.level ? (ls.level === "pro" ? "Professional" : "Amateur") : "—"}
          right={rs?.level ? (rs.level === "pro" ? "Professional" : "Amateur") : "—"}
        />
      )}
      {(lWc.length > 0 || rWc.length > 0) && (
        <CompareRow
          label="Weight class"
          left={lWc.length > 0 ? (
            <div className="flex flex-wrap justify-end gap-1">
              {lWc.map((wc: AnyRow) => <span key={wc.id} className="cmp-tag">{wc.name}</span>)}
            </div>
          ) : "—"}
          right={rWc.length > 0 ? (
            <div className="flex flex-wrap gap-1">
              {rWc.map((wc: AnyRow) => <span key={wc.id} className="cmp-tag">{wc.name}</span>)}
            </div>
          ) : "—"}
        />
      )}
      {(lFs.length > 0 || rFs.length > 0) && (
        <CompareRow
          label="Fight style"
          left={lFs.length > 0 ? (
            <div className="flex flex-wrap justify-end gap-1">
              {lFs.map((fs: AnyRow) => <span key={fs.id} className="cmp-tag">{fs.label}</span>)}
            </div>
          ) : "—"}
          right={rFs.length > 0 ? (
            <div className="flex flex-wrap gap-1">
              {rFs.map((fs: AnyRow) => <span key={fs.id} className="cmp-tag">{fs.label}</span>)}
            </div>
          ) : "—"}
        />
      )}
    </div>
  );
}

function BookingSection({ left, right }: { left: FighterData; right: FighterData }) {
  const { format } = useCurrency();
  const lf = left.fighter!;
  const rf = right.fighter!;

  return (
    <div className="cmp-compare-card">
      <CompareRow
        label="Availability"
        left={<AvailabilityBadge status={lf.availability_status} />}
        right={<AvailabilityBadge status={rf.availability_status} />}
      />
      {(lf.available_from || rf.available_from) && (
        <CompareRow
          label="Available from"
          left={lf.available_from
            ? new Date(lf.available_from).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })
            : "—"}
          right={rf.available_from
            ? new Date(rf.available_from).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })
            : "—"}
        />
      )}
      {(lf.purse_usd != null || rf.purse_usd != null) && (
        <CompareRow
          label="Fight purse"
          left={lf.purse_usd != null ? (
            <span className="font-semibold">{format(lf.purse_usd)}{lf.purse_negotiable ? <span className="ml-1 text-xs text-muted-foreground font-normal">Neg.</span> : null}</span>
          ) : "—"}
          right={rf.purse_usd != null ? (
            <span className="font-semibold">{format(rf.purse_usd)}{rf.purse_negotiable ? <span className="ml-1 text-xs text-muted-foreground font-normal">Neg.</span> : null}</span>
          ) : "—"}
        />
      )}
      {(lf.preparation_weeks != null || rf.preparation_weeks != null) && (
        <CompareRow
          label="Prep weeks"
          left={lf.preparation_weeks != null ? `${lf.preparation_weeks}w` : "—"}
          right={rf.preparation_weeks != null ? `${rf.preparation_weeks}w` : "—"}
          adv={calcAdv(lf.preparation_weeks, rf.preparation_weeks, "lower")}
        />
      )}
      <CompareRow
        label="Short notice"
        left={lf.open_to_short_notice ? (
          <span className="inline-flex items-center gap-1 text-emerald-400"><Zap className="h-3 w-3" />Yes</span>
        ) : <span className="text-muted-foreground">No</span>}
        right={rf.open_to_short_notice ? (
          <span className="inline-flex items-center gap-1 text-emerald-400"><Zap className="h-3 w-3" />Yes</span>
        ) : <span className="text-muted-foreground">No</span>}
      />
      {(lf.promotional_status || rf.promotional_status) && (
        <CompareRow label="Promo status" left={lf.promotional_status ?? "—"} right={rf.promotional_status ?? "—"} />
      )}
      {(lf.team_name || rf.team_name) && (
        <CompareRow label="Team / Gym" left={lf.team_name ?? "—"} right={rf.team_name ?? "—"} />
      )}
    </div>
  );
}

function VisibilitySection({ left, right }: { left: FighterData; right: FighterData }) {
  const lf = left.fighter!;
  const rf = right.fighter!;

  return (
    <div className="cmp-compare-card">
      <CompareRow
        label="Instagram"
        left={lf.instagram ? (
          <span className="inline-flex items-center gap-1"><Instagram className="h-3 w-3" />@{lf.instagram}</span>
        ) : "—"}
        right={rf.instagram ? (
          <span className="inline-flex items-center gap-1"><Instagram className="h-3 w-3" />@{rf.instagram}</span>
        ) : "—"}
      />
      {(left.followerCount !== null || right.followerCount !== null) && (
        <CompareRow
          label="Followers"
          left={left.followerCount != null ? (
            <span className="font-display text-xl tracking-wide">{left.followerCount.toLocaleString()}</span>
          ) : "—"}
          right={right.followerCount != null ? (
            <span className="font-display text-xl tracking-wide">{right.followerCount.toLocaleString()}</span>
          ) : "—"}
          adv={calcAdv(left.followerCount, right.followerCount, "higher")}
        />
      )}
    </div>
  );
}

function TitleFightsBar({ total, won }: { total: number; won: number }) {
  if (total === 0) return <span className="text-sm text-muted-foreground">—</span>;
  const lost = total - won;
  return (
    <div>
      <div className="flex items-baseline justify-center gap-1.5">
        <span className="font-display text-2xl text-amber-400">{won}</span>
        <span className="text-[10px] font-bold text-amber-400/60 uppercase">won</span>
        <span className="text-muted-foreground/30 mx-0.5">·</span>
        <span className="font-display text-2xl text-muted-foreground">{total}</span>
        <span className="text-[10px] font-bold text-muted-foreground/50 uppercase">total</span>
      </div>
      <div className="cmp-record-bar mt-1.5 max-w-[6rem] mx-auto">
        <div className="bg-amber-400/70" style={{ width: `${(won / total) * 100}%` }} />
        <div className="bg-muted-foreground/20" style={{ width: `${(lost / total) * 100}%` }} />
      </div>
    </div>
  );
}

function CareerSection({ left, right }: { left: FighterData; right: FighterData }) {
  const hasTitles = left.careerHighlights.titleFights > 0 || right.careerHighlights.titleFights > 0;
  const hasBonuses = left.careerHighlights.bonusCount > 0 || right.careerHighlights.bonusCount > 0;
  if (!hasTitles && !hasBonuses) {
    return <p className="text-sm text-muted-foreground py-4 text-center">No title fight or bonus data on record</p>;
  }

  return (
    <div className="cmp-compare-card">
      {hasTitles && (
        <CompareRow
          label="Title fights"
          left={<TitleFightsBar total={left.careerHighlights.titleFights} won={left.careerHighlights.titlesWon} />}
          right={<TitleFightsBar total={right.careerHighlights.titleFights} won={right.careerHighlights.titlesWon} />}
          adv={calcAdv(left.careerHighlights.titlesWon, right.careerHighlights.titlesWon, "higher")}
        />
      )}
      {hasBonuses && (
        <CompareRow
          label="Bonuses"
          left={<span className="font-display text-2xl">{left.careerHighlights.bonusCount}</span>}
          right={<span className="font-display text-2xl">{right.careerHighlights.bonusCount}</span>}
          adv={calcAdv(left.careerHighlights.bonusCount, right.careerHighlights.bonusCount, "higher")}
        />
      )}
    </div>
  );
}

function FinishDonut({ breakdown, centerLabel }: { breakdown: FinishBreakdown; centerLabel: string }) {
  const total = breakdown.ko + breakdown.sub + breakdown.dec + breakdown.other;
  if (total === 0) return <p className="text-xs text-muted-foreground py-4 text-center">No data</p>;

  const size = 88, r = 32, innerR = 19, cx = 44, cy = 44;
  let angle = -Math.PI / 2;
  const arcs = FINISH_ORDER.filter((k) => breakdown[k] > 0).map((key) => {
    const sweep = (breakdown[key] / total) * Math.PI * 2;
    const x1 = cx + r * Math.cos(angle);
    const y1 = cy + r * Math.sin(angle);
    angle += sweep;
    const x2 = cx + r * Math.cos(angle);
    const y2 = cy + r * Math.sin(angle);
    return { key, d: `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${sweep > Math.PI ? 1 : 0} 1 ${x2} ${y2} Z` };
  });

  const legend = FINISH_ORDER.map((k) => ({
    key: k, value: breakdown[k], pct: Math.round((breakdown[k] / total) * 100),
  }));

  return (
    <div className="flex items-center gap-4">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden className="shrink-0">
        {arcs.map((a) => (
          <path key={a.key} d={a.d} fill={FINISH_COLORS[a.key]} stroke="rgba(10,10,15,0.9)" strokeWidth={1.5} />
        ))}
        <circle cx={cx} cy={cy} r={innerR} fill="rgba(18,18,22,0.96)" />
        <text x={cx} y={cy - 1} textAnchor="middle" fill="#fff" fontSize={14} className="font-display">{total}</text>
        <text x={cx} y={cy + 9} textAnchor="middle" fill="rgba(255,255,255,0.32)" fontSize={7}>{centerLabel}</text>
      </svg>
      <div className="flex flex-col gap-1.5">
        {legend.map((item) => (
          <div key={item.key} className="flex items-center gap-2">
            <span className="h-1.5 w-1.5 rounded-[2px] shrink-0"
              style={{ background: FINISH_COLORS[item.key], opacity: item.value > 0 ? 1 : 0.25 }} />
            <span className="text-[10px] text-muted-foreground flex-1">{FINISH_LABELS[item.key]}</span>
            <span className={cn("text-[10px] font-bold tabular-nums", item.value > 0 ? "text-foreground" : "text-muted-foreground/30")}>
              {item.pct}%
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function BreakdownSection({ left, right }: { left: FighterData; right: FighterData }) {
  const lf = left.fighter!;
  const rf = right.fighter!;
  const lWinTotal = Object.values(left.winBreakdown).reduce((a, b) => a + b, 0);
  const rWinTotal = Object.values(right.winBreakdown).reduce((a, b) => a + b, 0);
  const lLossTotal = Object.values(left.lossBreakdown).reduce((a, b) => a + b, 0);
  const rLossTotal = Object.values(right.lossBreakdown).reduce((a, b) => a + b, 0);

  if (lWinTotal + rWinTotal + lLossTotal + rLossTotal === 0) {
    return <p className="text-sm text-muted-foreground py-4 text-center">No finish method data on record</p>;
  }

  return (
    <div className="space-y-3">
      {(lWinTotal > 0 || rWinTotal > 0) && (
        <div className="cmp-breakdown-grid">
          <div className="cmp-breakdown-card">
            <p className="cmp-breakdown-title">How {lf.first_name} wins</p>
            <FinishDonut breakdown={left.winBreakdown} centerLabel="wins" />
          </div>
          <div className="cmp-breakdown-card">
            <p className="cmp-breakdown-title">How {rf.first_name} wins</p>
            <FinishDonut breakdown={right.winBreakdown} centerLabel="wins" />
          </div>
        </div>
      )}
      {(lLossTotal > 0 || rLossTotal > 0) && (
        <div className="cmp-breakdown-grid">
          <div className="cmp-breakdown-card">
            <p className="cmp-breakdown-title">How {lf.first_name} loses</p>
            <FinishDonut breakdown={left.lossBreakdown} centerLabel="losses" />
          </div>
          <div className="cmp-breakdown-card">
            <p className="cmp-breakdown-title">How {rf.first_name} loses</p>
            <FinishDonut breakdown={right.lossBreakdown} centerLabel="losses" />
          </div>
        </div>
      )}
    </div>
  );
}

function HistorySection({ left, right }: { left: FighterData; right: FighterData }) {
  const lf = left.fighter!;
  const rf = right.fighter!;

  return (
    <div className="cmp-history-grid">
      <div className="cmp-history-card">
        <div className="cmp-history-head">
          <h3 className="cmp-history-name">{lf.first_name} {lf.last_name}</h3>
          {left.form.streak >= 2 && left.form.type && (
            <span className={cn(
              "cmp-form-badge",
              left.form.type === "W" ? "cmp-form-badge--hot" : left.form.type === "L" ? "cmp-form-badge--cold" : "",
            )}>
              {left.form.streak}{left.form.type} streak
            </span>
          )}
        </div>
        <FightList fights={left.lastFights} />
      </div>
      <div className="cmp-history-card">
        <div className="cmp-history-head">
          <h3 className="cmp-history-name">{rf.first_name} {rf.last_name}</h3>
          {right.form.streak >= 2 && right.form.type && (
            <span className={cn(
              "cmp-form-badge",
              right.form.type === "W" ? "cmp-form-badge--hot" : right.form.type === "L" ? "cmp-form-badge--cold" : "",
            )}>
              {right.form.streak}{right.form.type} streak
            </span>
          )}
        </div>
        <FightList fights={right.lastFights} />
      </div>
    </div>
  );
}

function FightList({ fights }: { fights: AnyRow[] }) {
  if (fights.length === 0) {
    return <p className="text-xs text-muted-foreground py-4 text-center">No fights on record</p>;
  }
  return (
    <div>
      {fights.map((f: AnyRow) => {
        const result = f.result?.toLowerCase() ?? "";
        const isWin = result.startsWith("w");
        const isLoss = result.startsWith("l");
        const isDraw = result.startsWith("d");
        const method = methodLabel(f.method);

        return (
          <div key={f.id} className="cmp-fight-item">
            <div className={cn(
              "cmp-fight-result",
              isWin && "cmp-fight-result--win",
              isLoss && "cmp-fight-result--loss",
              isDraw && "cmp-fight-result--draw",
            )}>
              {isWin ? "W" : isLoss ? "L" : isDraw ? "D" : "NC"}
            </div>
            <div className="min-w-0 flex-1">
              <p className="cmp-fight-opp">{f.opponent_name ?? "Unknown opponent"}</p>
              {(method || f.organization) && (
                <p className="cmp-fight-meta">{[method, f.organization].filter(Boolean).join(" · ")}</p>
              )}
              {f.event_date && (
                <p className="cmp-fight-date">
                  {new Date(f.event_date).toLocaleDateString("en-GB", { month: "short", year: "numeric" })}
                </p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
