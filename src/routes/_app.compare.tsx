import { useState, useRef, useEffect, useMemo } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { z } from "zod";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft, ArrowLeftRight, Calendar, Clock, Globe, Heart, Instagram,
  Lock, MapPin, Search, Shield, Swords, UserPlus, X, Zap,
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

function opponentDisplayName(fight: AnyRow): string {
  const name = fight.name ?? fight.opponent_name;
  if (typeof name === "string" && name.trim()) return name.trim();
  return "Opponent not listed";
}

function formatFightDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m) return iso;
  const dt = d ? new Date(y, m - 1, d) : new Date(y, m - 1, 1);
  return dt.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

type FightOutcome = "W" | "L" | "D" | "NC";

function fightOutcomeMeta(result: string | null | undefined): {
  label: string;
  tone: "win" | "loss" | "draw" | "nc";
} {
  const o = parseFightOutcome(result ?? "");
  if (o === "W") return { label: "W", tone: "win" };
  if (o === "L") return { label: "L", tone: "loss" };
  if (o === "D") return { label: "D", tone: "draw" };
  return { label: "–", tone: "nc" };
}

function historyInsight(
  leftName: string,
  rightName: string,
  left: FighterData,
  right: FighterData,
): string {
  const lf = left.form;
  const rf = right.form;
  if (lf.streak >= 2 && rf.streak >= 2 && lf.type === rf.type) {
    if (lf.type === "W") {
      return `Both on win streaks — ${leftName} ${lf.streak}W, ${rightName} ${rf.streak}W.`;
    }
    if (lf.type === "L") {
      return "Both fighters on losing runs — form risk on both sides.";
    }
  }
  if (lf.streak >= 2 && lf.type === "W") {
    return `${leftName} enters on a ${lf.streak}-fight win streak.`;
  }
  if (rf.streak >= 2 && rf.type === "W") {
    return `${rightName} enters on a ${rf.streak}-fight win streak.`;
  }
  if (lf.streak >= 2 && lf.type === "L") {
    return `${leftName} has dropped ${lf.streak} straight — momentum question.`;
  }
  if (rf.streak >= 2 && rf.type === "L") {
    return `${rightName} has dropped ${rf.streak} straight — momentum question.`;
  }
  return "Last five recorded bouts — scan recent form before making the call.";
}

function stanceLabel(stance: string | null | undefined): string {
  if (!stance?.trim()) return "—";
  return stance.trim().replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function physicalInsight(
  leftName: string,
  rightName: string,
  lf: Fighter,
  rf: Fighter,
): string {
  const heightAdv = calcAdv(lf.height_cm, rf.height_cm, "higher");
  const reachAdv = calcAdv(lf.reach_cm, rf.reach_cm, "higher");
  const heightDelta = lf.height_cm != null && rf.height_cm != null
    ? Math.abs(lf.height_cm - rf.height_cm) : null;
  const reachDelta = lf.reach_cm != null && rf.reach_cm != null
    ? Math.abs(lf.reach_cm - rf.reach_cm) : null;

  if (reachAdv !== "none" && reachDelta != null && reachDelta >= 5) {
    const leader = reachAdv === "left" ? leftName : rightName;
    return `${leader} brings a +${reachDelta} cm reach edge — range matters in this matchup.`;
  }
  if (heightAdv !== "none" && heightDelta != null && heightDelta >= 3) {
    const leader = heightAdv === "left" ? leftName : rightName;
    return `${leader} is +${heightDelta} cm taller — frame advantage at the centre.`;
  }
  if (lf.stance && rf.stance && lf.stance.toLowerCase() !== rf.stance.toLowerCase()) {
    return `Opposite stances — ${stanceLabel(lf.stance)} vs ${stanceLabel(rf.stance)}.`;
  }
  if (heightAdv === "equal" && reachAdv === "equal") {
    return "Near-identical size and range — neither fighter owns the physical edge.";
  }
  return "Size, reach, and stance shape how this fight plays out in the pocket.";
}

type FinishBucket = "ko" | "sub" | "dec" | "dq" | "other";
type FinishBreakdown = Record<FinishBucket, number>;

const FINISH_COLORS: Record<FinishBucket, string> = {
  ko: "#E8001D", sub: "#fb923c", dec: "rgba(255,255,255,0.55)", dq: "#a78bfa", other: "rgba(255,255,255,0.22)",
};
const FINISH_LABELS: Record<FinishBucket, string> = {
  ko: "KO / TKO", sub: "Submission", dec: "Decision", dq: "DQ", other: "Other",
};
const FINISH_ABBR: Record<FinishBucket, string> = {
  ko: "KO/TKO", sub: "SUB", dec: "DEC", dq: "DQ", other: "OTH",
};
const FINISH_TOOLTIPS: Record<FinishBucket, string> = {
  ko: "Knockout / Technical Knockout — stoppage from strikes, doctor, corner, or injury",
  sub: "Submission — tap out, choke, joint lock, or technical submission",
  dec: "Decision — unanimous (UD), split (SD), or majority (MD) scorecards",
  dq: "Disqualification (DQ) — foul or rule violation",
  other: "Other — no contest, overturned result, or uncategorized method",
};
const FINISH_ORDER: FinishBucket[] = ["ko", "sub", "dec", "dq", "other"];

function breakdownTotal(b: FinishBreakdown): number {
  return FINISH_ORDER.reduce((sum, k) => sum + b[k], 0);
}

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

type IgSnapshot = { followerCount: number; recordedAt: string };

type IgGrowthStats = {
  latest: number;
  delta: number;
  deltaPct: string;
  deltaPctNum: number;
  days: number;
  snapshotCount: number;
  coords: { x: number; y: number; count: number; label: string }[];
  line: string;
  area: string;
  width: number;
  height: number;
};

function latestFollowerCount(snapshots: IgSnapshot[]): number | null {
  if (snapshots.length === 0) return null;
  return snapshots[snapshots.length - 1].followerCount;
}

function computeIgGrowth(snapshots: IgSnapshot[]): IgGrowthStats | null {
  if (snapshots.length < 2) return null;
  const sorted = [...snapshots].sort(
    (a, b) => new Date(a.recordedAt).getTime() - new Date(b.recordedAt).getTime(),
  );
  const min = Math.min(...sorted.map((s) => s.followerCount));
  const max = Math.max(...sorted.map((s) => s.followerCount));
  const span = Math.max(max - min, Math.max(max * 0.01, 1));
  const mid = (max + min) / 2;
  const vMin = mid - span / 2;
  const vMax = mid + span / 2;
  const range = vMax - vMin;
  const width = 320;
  const height = 72;
  const pad = 6;
  const coords = sorted.map((s, i) => ({
    x: pad + (i / (sorted.length - 1)) * (width - pad * 2),
    y: height - pad - ((s.followerCount - vMin) / range) * (height - pad * 2),
    count: s.followerCount,
    label: new Date(s.recordedAt).toLocaleDateString("en-GB", { month: "short", day: "numeric" }),
  }));
  let line = `M${coords[0].x},${coords[0].y}`;
  for (let i = 1; i < coords.length; i++) {
    const prev = coords[i - 1];
    const curr = coords[i];
    const cpx = (prev.x + curr.x) / 2;
    line += ` C${cpx},${prev.y} ${cpx},${curr.y} ${curr.x},${curr.y}`;
  }
  const area = `${line} L${coords[coords.length - 1].x},${height} L${coords[0].x},${height} Z`;
  const first = sorted[0].followerCount;
  const last = sorted[sorted.length - 1].followerCount;
  const delta = last - first;
  const pct = first > 0 ? (delta / first) * 100 : 0;
  const deltaPct = Math.abs(pct) < 1
    ? `${pct >= 0 ? "+" : ""}${pct.toFixed(1)}%`
    : `${pct >= 0 ? "+" : ""}${Math.round(pct)}%`;
  const days = Math.max(
    1,
    Math.round(
      (new Date(sorted[sorted.length - 1].recordedAt).getTime()
        - new Date(sorted[0].recordedAt).getTime()) / 86_400_000,
    ),
  );
  return {
    latest: last,
    delta,
    deltaPct,
    deltaPctNum: pct,
    days,
    snapshotCount: sorted.length,
    coords,
    line,
    area,
    width,
    height,
  };
}

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

  const socialSnapshots = useQuery<IgSnapshot[]>({
    queryKey: ["fighter-social-snapshots", fighterId],
    enabled: !!fighterId,
    queryFn: async () => {
      const { data } = await supabase
        .from("fighter_social_snapshots")
        .select("follower_count, recorded_at")
        .eq("fighter_id", fighterId!)
        .order("recorded_at", { ascending: true });
      return (data ?? []).map((row) => ({
        followerCount: row.follower_count,
        recordedAt: row.recorded_at,
      }));
    },
  });

  const followerSnapshots = socialSnapshots.data ?? [];

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
    followerSnapshots,
    followerCount: latestFollowerCount(followerSnapshots),
    form: recentForm(lastFights),
    isLoading: fighter.isLoading || sports.isLoading || fights.isLoading || socialSnapshots.isLoading,
  };
}

type FighterData = ReturnType<typeof useFighterData>;

type SectionId = "record" | "physical" | "booking" | "visibility" | "history";
const SECTIONS: { id: SectionId; label: string }[] = [
  { id: "record", label: "Record" },
  { id: "booking", label: "Booking" },
  { id: "history", label: "Recent Fights" },
  { id: "physical", label: "Physical" },
  { id: "visibility", label: "Visibility" },
];

// ── Main page ─────────────────────────────────────────────────────────────────

function ComparePage() {
  const { fighters: rawIds, sport, gender } = Route.useSearch();
  const navigate = useNavigate({ from: "/compare" });
  const [drawerFighterId, setDrawerFighterId] = useState<string | null>(null);
  const [activeSection, setActiveSection] = useState<SectionId>("record");

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

const AVAIL_RANK: Record<string, number> = {
  available: 3,
  in_camp: 2,
  unavailable: 1,
};

function formatAvailableFrom(fighter: Fighter): string {
  if (fighter.available_from) {
    return new Date(fighter.available_from).toLocaleDateString("en-GB", {
      day: "numeric", month: "short", year: "numeric",
    });
  }
  if (fighter.availability_status === "available") return "Now";
  return "—";
}

function prepLabel(weeks: number | null | undefined): string {
  if (weeks == null) return "—";
  if (weeks === 0) return "Always ready";
  return `${weeks} week${weeks === 1 ? "" : "s"}`;
}

function promoLabel(status: string | null | undefined): string {
  if (status === "exclusive") return "Exclusive";
  if (status === "free_agent") return "Free agent";
  return status ?? "—";
}

function locationLabel(fighter: Fighter): string {
  return [fighter.current_city, fighter.current_city_country].filter(Boolean).join(", ") || "—";
}

function instagramHandle(handle: string | null | undefined): string | null {
  if (!handle?.trim()) return null;
  return handle.trim().replace(/^@/, "");
}

function visibilityInsight(
  leftName: string,
  rightName: string,
  left: FighterData,
  right: FighterData,
): string {
  const lIg = instagramHandle(left.fighter?.instagram);
  const rIg = instagramHandle(right.fighter?.instagram);
  const lF = left.followerCount;
  const rF = right.followerCount;
  const lGrowth = computeIgGrowth(left.followerSnapshots);
  const rGrowth = computeIgGrowth(right.followerSnapshots);

  if (!lIg && !rIg && lF == null && rF == null) {
    return "No social footprint on file — limited promotable reach for both fighters.";
  }

  if (lGrowth && rGrowth && Math.abs(lGrowth.deltaPctNum - rGrowth.deltaPctNum) >= 8) {
    const leader = lGrowth.deltaPctNum > rGrowth.deltaPctNum ? leftName : rightName;
    return `${leader} is growing faster on Instagram across the tracked snapshot window.`;
  }

  if (lGrowth && lGrowth.delta > 0 && !rGrowth) {
    return `${leftName} gained ${lGrowth.delta.toLocaleString()} followers over ${lGrowth.days} tracked days.`;
  }
  if (rGrowth && rGrowth.delta > 0 && !lGrowth) {
    return `${rightName} gained ${rGrowth.delta.toLocaleString()} followers over ${rGrowth.days} tracked days.`;
  }

  const fAdv = calcAdv(lF, rF, "higher");
  if (fAdv !== "none" && fAdv !== "equal" && lF != null && rF != null) {
    const leader = fAdv === "left" ? leftName : rightName;
    const hi = Math.max(lF, rF);
    const lo = Math.min(lF, rF);
    if (hi - lo >= 5000 || (lo > 0 && hi / lo >= 1.5)) {
      return `${leader} brings a stronger Instagram audience — useful for card marketing and buzz.`;
    }
  }

  if (lGrowth || rGrowth) {
    return "Follower snapshots on file — compare current reach and growth trend side by side.";
  }

  if (lIg && rIg) {
    return "Both fighters have Instagram presence — compare reach before shaping the narrative.";
  }

  if (lIg || rIg) {
    const who = lIg ? leftName : rightName;
    return `Only ${who} has Instagram listed — asymmetry in promotable reach.`;
  }

  return "Social reach shapes how much attention this matchup can pull pre-fight.";
}

function bookingReadiness(left: Fighter, right: Fighter): {
  tone: "good" | "warn" | "neutral";
  message: string;
} {
  const la = left.availability_status ?? "unavailable";
  const ra = right.availability_status ?? "unavailable";
  if (la === "available" && ra === "available") {
    return { tone: "good", message: "Both fighters are available — strong window to open booking talks." };
  }
  if (la === "unavailable" && ra === "unavailable") {
    return { tone: "warn", message: "Both fighters are unavailable — confirm status before pitching this matchup." };
  }
  if (la === "in_camp" || ra === "in_camp") {
    return { tone: "neutral", message: "At least one fighter is in camp — align timelines before committing." };
  }
  return { tone: "warn", message: "Mixed availability — verify dates and camp schedules early." };
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

function PhysicalSection({ left, right }: { left: FighterData; right: FighterData }) {
  const lf = left.fighter!;
  const rf = right.fighter!;
  const insight = physicalInsight(lf.first_name, rf.first_name, lf, rf);
  const lAge = calcAge(lf.dob);
  const rAge = calcAge(rf.dob);
  const lApe = lf.height_cm != null && lf.reach_cm != null ? lf.reach_cm - lf.height_cm : null;
  const rApe = rf.height_cm != null && rf.reach_cm != null ? rf.reach_cm - rf.height_cm : null;
  const hasProfile = lf.stance || rf.stance || lf.weight_kg != null || rf.weight_kg != null;

  return (
    <div className="cmp-physical-dossier">
      <div className="cmp-physical-insight">
        <span className="cmp-physical-insight-dot" aria-hidden />
        <p className="cmp-physical-insight-text">{insight}</p>
      </div>

      <div className="cmp-physical-duel">
        <div className="cmp-physical-duel-axis-line" aria-hidden />

        <div className="cmp-physical-duel-hero">
          <PhysicalHeroCard
            name={lf.first_name}
            age={lAge}
            height={lf.height_cm}
            reach={lf.reach_cm}
            ape={lApe}
            side="left"
          />
          <div className="cmp-physical-duel-axis">
            <div className="cmp-duel-vs" aria-hidden><span>VS</span></div>
          </div>
          <PhysicalHeroCard
            name={rf.first_name}
            age={rAge}
            height={rf.height_cm}
            reach={rf.reach_cm}
            ape={rApe}
            side="right"
          />
        </div>

        <div className="cmp-physical-metrics">
          <div className="cmp-physical-metrics-head">
            <h3 className="cmp-physical-metrics-title">Size & range</h3>
            <p className="cmp-physical-metrics-sub">Head-to-head measurements</p>
          </div>
          <PhysicalMetricRow
            label="Height"
            unit="cm"
            leftVal={lf.height_cm}
            rightVal={rf.height_cm}
          />
          <PhysicalMetricRow
            label="Reach"
            unit="cm"
            leftVal={lf.reach_cm}
            rightVal={rf.reach_cm}
          />
          {(lApe != null || rApe != null) && (
            <PhysicalMetricRow
              label="APE"
              unit="cm"
              leftVal={lApe}
              rightVal={rApe}
              hint="Reach minus height"
              showBars={false}
            />
          )}
          {hasProfile && (
            <>
              <div className="cmp-physical-metrics-split" aria-hidden />
              <PhysicalProfileRow
                label="Stance"
                left={stanceLabel(lf.stance)}
                right={stanceLabel(rf.stance)}
                clash={!!lf.stance && !!rf.stance && lf.stance.toLowerCase() !== rf.stance.toLowerCase()}
              />
              {(lf.weight_kg != null || rf.weight_kg != null) && (
                <PhysicalProfileRow
                  label="Walk-around"
                  left={lf.weight_kg != null ? `${lf.weight_kg} kg` : "—"}
                  right={rf.weight_kg != null ? `${rf.weight_kg} kg` : "—"}
                  adv={calcAdv(lf.weight_kg, rf.weight_kg, "higher")}
                />
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function PhysicalHeroCard({
  name, age, height, reach, ape, side,
}: {
  name: string;
  age: number | null;
  height: number | null;
  reach: number | null;
  ape: number | null;
  side: "left" | "right";
}) {
  return (
    <div className={cn(
      "cmp-physical-hero-card",
      side === "left" ? "cmp-physical-hero-card--left" : "cmp-physical-hero-card--right",
    )}>
      <span className="cmp-physical-hero-name">{name}</span>
      <div className="cmp-physical-hero-body">
        <div className="cmp-physical-hero-stat">
          <span className="cmp-physical-hero-stat-lbl">Age</span>
          <span className="cmp-physical-hero-stat-val">{age != null ? `${age} yrs` : "—"}</span>
        </div>
        <div className="cmp-physical-hero-stat">
          <span className="cmp-physical-hero-stat-lbl">Height</span>
          <span className="cmp-physical-hero-stat-val">{height != null ? `${height} cm` : "—"}</span>
        </div>
        <div className="cmp-physical-hero-stat">
          <span className="cmp-physical-hero-stat-lbl">Reach</span>
          <span className="cmp-physical-hero-stat-val">{reach != null ? `${reach} cm` : "—"}</span>
        </div>
        {ape != null && (
          <span className="cmp-physical-hero-ape">
            {ape >= 0 ? `+${ape}` : ape} cm APE
          </span>
        )}
      </div>
    </div>
  );
}

function PhysicalMetricRow({
  label, unit, leftVal, rightVal, hint, showBars = true,
}: {
  label: string;
  unit: string;
  leftVal: number | null;
  rightVal: number | null;
  hint?: string;
  showBars?: boolean;
}) {
  const adv = calcAdv(leftVal, rightVal, "higher");
  const max = Math.max(leftVal ?? 0, rightVal ?? 0, 1);
  const lPct = leftVal != null && leftVal > 0 ? Math.round((leftVal / max) * 100) : 0;
  const rPct = rightVal != null && rightVal > 0 ? Math.round((rightVal / max) * 100) : 0;
  const maxPct = Math.max(lPct, rPct, 1);

  function formatVal(v: number | null): string {
    if (v == null) return "—";
    if (label === "APE" && v > 0) return `+${v} ${unit}`;
    return `${v} ${unit}`;
  }

  const tag = (
    <div className="cmp-physical-metric-tag-inner">
      <span>{label}</span>
      {hint && <span className="cmp-physical-metric-hint">{hint}</span>}
    </div>
  );

  return (
    <div className="cmp-physical-metric-row">
      <div className="cmp-physical-metric-tag cmp-physical-metric-tag--left">{tag}</div>
      <div className={cn("cmp-physical-metric-side cmp-physical-metric-side--left", adv === "left" && "cmp-physical-metric-side--adv")}>
        <span className="cmp-physical-metric-val">{formatVal(leftVal)}</span>
        {showBars && leftVal != null && leftVal > 0 && (
          <div className="cmp-physical-metric-bar">
            <div
              className="cmp-physical-metric-bar-fill cmp-physical-metric-bar-fill--left"
              style={{ width: `${(lPct / maxPct) * 100}%` }}
            />
          </div>
        )}
      </div>
      <div className="cmp-physical-metric-axis" aria-hidden />
      <div className={cn("cmp-physical-metric-side cmp-physical-metric-side--right", adv === "right" && "cmp-physical-metric-side--adv")}>
        {showBars && rightVal != null && rightVal > 0 && (
          <div className="cmp-physical-metric-bar">
            <div
              className="cmp-physical-metric-bar-fill cmp-physical-metric-bar-fill--right"
              style={{ width: `${(rPct / maxPct) * 100}%` }}
            />
          </div>
        )}
        <span className="cmp-physical-metric-val">{formatVal(rightVal)}</span>
      </div>
      <div className="cmp-physical-metric-tag cmp-physical-metric-tag--right">{tag}</div>
    </div>
  );
}

function PhysicalProfileRow({
  label, left, right, adv = "none", clash = false,
}: {
  label: string;
  left: string;
  right: string;
  adv?: AdvDir;
  clash?: boolean;
}) {
  return (
    <div className={cn("cmp-physical-profile-row", clash && "cmp-physical-profile-row--clash")}>
      <span className="cmp-physical-profile-tag cmp-physical-profile-tag--left">{label}</span>
      <span className={cn(
        "cmp-physical-profile-side cmp-physical-profile-side--left",
        adv === "left" && "cmp-physical-profile-side--adv",
      )}>
        {left}
      </span>
      <div className="cmp-physical-metric-axis" aria-hidden />
      <span className={cn(
        "cmp-physical-profile-side cmp-physical-profile-side--right",
        adv === "right" && "cmp-physical-profile-side--adv",
      )}>
        {right}
      </span>
      <span className="cmp-physical-profile-tag cmp-physical-profile-tag--right">{label}</span>
    </div>
  );
}

function RecordHeroCard({
  name, sportLevel, w, l, d, rate, form, side,
}: {
  name: string;
  sportLevel: string | null;
  w: number;
  l: number;
  d: number;
  rate: number | null;
  form: { streak: number; type: "W" | "L" | "D" | null };
  side: "left" | "right";
}) {
  return (
    <div className={cn("cmp-record-hero-card", side === "left" ? "cmp-record-hero-card--left" : "cmp-record-hero-card--right")}>
      <div className="cmp-record-hero-top">
        <p className="cmp-record-hero-name">{name}</p>
        {sportLevel && <span className="cmp-record-hero-level">{sportLevel}</span>}
      </div>
      <RecordBlock w={w} l={l} d={d} />
      <div className="cmp-record-hero-meta">
        {rate != null ? (
          <span className="cmp-record-hero-rate">{rate}%<span className="cmp-record-hero-rate-lbl"> win rate</span></span>
        ) : (
          <span className="cmp-record-hero-rate cmp-record-hero-rate--empty">—</span>
        )}
        {form.streak >= 2 && form.type && (
          <span className={cn(
            "cmp-record-form",
            form.type === "W" ? "cmp-record-form--hot" : form.type === "L" ? "cmp-record-form--cold" : "",
          )}>
            {form.streak}{form.type} streak
          </span>
        )}
      </div>
    </div>
  );
}

function TitleFightDuel({
  leftName, rightName, left, right,
}: {
  leftName: string;
  rightName: string;
  left: { titleFights: number; titlesWon: number };
  right: { titleFights: number; titlesWon: number };
}) {
  const lLost = left.titleFights - left.titlesWon;
  const rLost = right.titleFights - right.titlesWon;
  const lRate = left.titleFights > 0 ? Math.round((left.titlesWon / left.titleFights) * 100) : null;
  const rRate = right.titleFights > 0 ? Math.round((right.titlesWon / right.titleFights) * 100) : null;
  const adv = calcAdv(lRate, rRate, "higher");

  return (
    <div className="cmp-title-duel">
      <div className="cmp-title-duel-head">
        <span className="cmp-title-duel-eyebrow">Championship pedigree</span>
        <span className="cmp-title-duel-hint">Title bouts on record</span>
      </div>
      <div className="cmp-title-duel-grid">
        <div className={cn("cmp-title-duel-side", adv === "left" && "cmp-title-duel-side--adv")}>
          <span className="cmp-title-duel-fighter">{leftName}</span>
          <div className="cmp-title-duel-body">
            {left.titleFights > 0 ? (
              <>
                <div className="cmp-title-duel-score">
                  <span className="cmp-title-duel-won">{left.titlesWon}</span>
                  <span className="cmp-title-duel-sep">–</span>
                  <span className="cmp-title-duel-lost">{lLost}</span>
                </div>
                <span className="cmp-title-duel-caption">{left.titleFights} title fight{left.titleFights === 1 ? "" : "s"} · {lRate}% won</span>
                <div className="cmp-title-duel-bar">
                  <div className="cmp-title-duel-bar-win" style={{ width: `${lRate ?? 0}%` }} />
                </div>
              </>
            ) : (
              <span className="cmp-title-duel-empty">No title fights logged</span>
            )}
          </div>
        </div>

        <div className="cmp-duel-vs" aria-hidden><span>VS</span></div>

        <div className={cn("cmp-title-duel-side cmp-title-duel-side--right", adv === "right" && "cmp-title-duel-side--adv")}>
          <span className="cmp-title-duel-fighter">{rightName}</span>
          <div className="cmp-title-duel-body">
            {right.titleFights > 0 ? (
              <>
                <div className="cmp-title-duel-score">
                  <span className="cmp-title-duel-won">{right.titlesWon}</span>
                  <span className="cmp-title-duel-sep">–</span>
                  <span className="cmp-title-duel-lost">{rLost}</span>
                </div>
                <span className="cmp-title-duel-caption">{right.titleFights} title fight{right.titleFights === 1 ? "" : "s"} · {rRate}% won</span>
                <div className="cmp-title-duel-bar">
                  <div className="cmp-title-duel-bar-win" style={{ width: `${rRate ?? 0}%` }} />
                </div>
              </>
            ) : (
              <span className="cmp-title-duel-empty">No title fights logged</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function MethodDuelPanel({
  mode, leftName, rightName, left, right,
}: {
  mode: "win" | "loss";
  leftName: string;
  rightName: string;
  left: FinishBreakdown;
  right: FinishBreakdown;
}) {
  const leftTotal = breakdownTotal(left);
  const rightTotal = breakdownTotal(right);
  if (leftTotal === 0 && rightTotal === 0) return null;

  const modeLabel = mode === "win" ? "Win methods" : "Loss methods";
  const modeHint = mode === "win"
    ? "How each fighter closes out victories"
    : "How each fighter has been beaten";

  return (
    <div className="cmp-method-duel">
      <div className="cmp-method-duel-head">
        <div>
          <h3 className="cmp-method-duel-title">{modeLabel}</h3>
          <p className="cmp-method-duel-sub">{modeHint}</p>
        </div>
        <div className="cmp-method-duel-names">
          <span>{leftName}</span>
          <span className="cmp-method-duel-names-sep">vs</span>
          <span>{rightName}</span>
        </div>
      </div>

      <div className="cmp-method-duel-rows">
        {FINISH_ORDER.map((key) => {
          const lCount = left[key];
          const rCount = right[key];
          const lPct = leftTotal > 0 ? Math.round((lCount / leftTotal) * 100) : 0;
          const rPct = rightTotal > 0 ? Math.round((rCount / rightTotal) * 100) : 0;
          const maxPct = Math.max(lPct, rPct, 1);
          const adv = leftTotal > 0 && rightTotal > 0 ? calcAdv(lPct, rPct, "higher") : "none";

          return (
            <div key={key} className="cmp-method-duel-row">
              <div className={cn("cmp-method-duel-end cmp-method-duel-end--left", adv === "left" && "cmp-method-duel-end--adv")}>
                <div className="cmp-method-duel-stats">
                  <span className="cmp-method-duel-count">{lCount}</span>
                  <span className="cmp-method-duel-pct">{leftTotal > 0 ? `${lPct}%` : "—"}</span>
                </div>
                <div className="cmp-method-duel-bar-track">
                  <div
                    className="cmp-method-duel-bar-fill cmp-method-duel-bar-fill--left"
                    style={{ width: `${(lPct / maxPct) * 100}%`, background: FINISH_COLORS[key] }}
                  />
                </div>
              </div>

              <div className="cmp-method-duel-center">
                <span
                  className="cmp-method-tip"
                  data-tip={FINISH_TOOLTIPS[key]}
                  tabIndex={0}
                  aria-label={`${FINISH_LABELS[key]}: ${FINISH_TOOLTIPS[key]}`}
                >
                  <span className="cmp-method-abbr">{FINISH_ABBR[key]}</span>
                  <span className="cmp-method-full">{FINISH_LABELS[key]}</span>
                </span>
              </div>

              <div className={cn("cmp-method-duel-end cmp-method-duel-end--right", adv === "right" && "cmp-method-duel-end--adv")}>
                <div className="cmp-method-duel-bar-track">
                  <div
                    className="cmp-method-duel-bar-fill cmp-method-duel-bar-fill--right"
                    style={{ width: `${(rPct / maxPct) * 100}%`, background: FINISH_COLORS[key] }}
                  />
                </div>
                <div className="cmp-method-duel-stats">
                  <span className="cmp-method-duel-count">{rCount}</span>
                  <span className="cmp-method-duel-pct">{rightTotal > 0 ? `${rPct}%` : "—"}</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="cmp-method-duel-foot">
        <span>{leftTotal} {mode === "win" ? "wins" : "losses"} logged</span>
        <span>{rightTotal} {mode === "win" ? "wins" : "losses"} logged</span>
      </div>
    </div>
  );
}

function RecordSection({ left, right, sport }: { left: FighterData; right: FighterData; sport: string | undefined }) {
  const lf = left.fighter!;
  const rf = right.fighter!;
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
  const sportTag = sport ? sportLabel(sport) : null;
  const lLevel = ls?.level ? (ls.level === "pro" ? "Pro" : "Amateur") : null;
  const rLevel = rs?.level ? (rs.level === "pro" ? "Pro" : "Amateur") : null;

  const hasMeta = lAmateurTotal > 0 || rAmateurTotal > 0
    || !!ls?.level || !!rs?.level
    || lWc.length > 0 || rWc.length > 0
    || lFs.length > 0 || rFs.length > 0;

  return (
    <div className="cmp-record-dossier">
      <div className="cmp-record-hero-grid">
        {ls ? (
          <RecordHeroCard
            name={lf.first_name}
            sportLevel={sportTag && lLevel ? `${sportTag} · ${lLevel}` : sportTag ?? lLevel}
            w={ls.pro_w}
            l={ls.pro_l}
            d={ls.pro_d}
            rate={lRate}
            form={left.form}
            side="left"
          />
        ) : (
          <div className="cmp-record-hero-card cmp-record-hero-card--left">
            <p className="cmp-record-hero-name">{lf.first_name}</p>
            <span className="text-sm text-muted-foreground">No record for this sport</span>
          </div>
        )}
        <div className="cmp-record-hero-divider" aria-hidden />
        {rs ? (
          <RecordHeroCard
            name={rf.first_name}
            sportLevel={sportTag && rLevel ? `${sportTag} · ${rLevel}` : sportTag ?? rLevel}
            w={rs.pro_w}
            l={rs.pro_l}
            d={rs.pro_d}
            rate={rRate}
            form={right.form}
            side="right"
          />
        ) : (
          <div className="cmp-record-hero-card cmp-record-hero-card--right">
            <p className="cmp-record-hero-name">{rf.first_name}</p>
            <span className="text-sm text-muted-foreground">No record for this sport</span>
          </div>
        )}
      </div>

      <TitleFightDuel
        leftName={lf.first_name}
        rightName={rf.first_name}
        left={left.careerHighlights}
        right={right.careerHighlights}
      />

      <MethodDuelPanel
        mode="win"
        leftName={lf.first_name}
        rightName={rf.first_name}
        left={left.winBreakdown}
        right={right.winBreakdown}
      />

      <MethodDuelPanel
        mode="loss"
        leftName={lf.first_name}
        rightName={rf.first_name}
        left={left.lossBreakdown}
        right={right.lossBreakdown}
      />

      {hasMeta && (
        <div className="cmp-compare-card cmp-record-meta">
          {(lAmateurTotal > 0 || rAmateurTotal > 0) && (
            <CompareRow
              label="Amateur"
              left={lAmateurTotal > 0 && ls ? `${ls.amateur_w}W ${ls.amateur_l}L ${ls.amateur_d}D` : "—"}
              right={rAmateurTotal > 0 && rs ? `${rs.amateur_w}W ${rs.amateur_l}L ${rs.amateur_d}D` : "—"}
              adv={calcAdv(lAmateurTotal > 0 ? ls?.amateur_w : null, rAmateurTotal > 0 ? rs?.amateur_w : null, "higher")}
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
      )}
    </div>
  );
}

function BookingSection({ left, right }: { left: FighterData; right: FighterData }) {
  const { format } = useCurrency();
  const lf = left.fighter!;
  const rf = right.fighter!;
  const readiness = bookingReadiness(lf, rf);
  const availAdv = calcAdv(
    AVAIL_RANK[lf.availability_status ?? "unavailable"],
    AVAIL_RANK[rf.availability_status ?? "unavailable"],
    "higher",
  );
  const purseAdv = calcAdv(lf.purse_usd, rf.purse_usd, "lower");
  const prepAdv = calcAdv(lf.preparation_weeks, rf.preparation_weeks, "lower");
  const maxPurse = Math.max(lf.purse_usd ?? 0, rf.purse_usd ?? 0, 1);
  const maxPrep = Math.max(lf.preparation_weeks ?? 0, rf.preparation_weeks ?? 0, 1);

  const hasDetails = lf.promotional_status || rf.promotional_status
    || lf.team_name || rf.team_name
    || lf.current_city || rf.current_city
    || lf.promoter_name || rf.promoter_name;

  return (
    <div className="cmp-booking-dossier">
      <div className={cn("cmp-booking-readiness", `cmp-booking-readiness--${readiness.tone}`)}>
        <span className="cmp-booking-readiness-dot" aria-hidden />
        <p className="cmp-booking-readiness-text">{readiness.message}</p>
      </div>

      <div className="cmp-booking-hero-grid">
        <BookingHeroCard
          name={lf.first_name}
          fighter={lf}
          side="left"
          adv={availAdv === "left"}
        />
        <div className="cmp-duel-vs" aria-hidden><span>VS</span></div>
        <BookingHeroCard
          name={rf.first_name}
          fighter={rf}
          side="right"
          adv={availAdv === "right"}
        />
      </div>

      <div className="cmp-booking-purse">
        <div className="cmp-booking-purse-head">
          <span className="cmp-booking-purse-eyebrow">Fight purse</span>
          <span className="cmp-booking-purse-hint">Ask vs ask · lower may ease budget</span>
        </div>
        <div className="cmp-booking-purse-grid">
          <div className={cn("cmp-booking-purse-side", purseAdv === "left" && "cmp-booking-purse-side--adv")}>
            <span className="cmp-booking-purse-fighter">{lf.first_name}</span>
            <div className="cmp-booking-purse-body">
              {lf.purse_usd != null ? (
                <>
                  <span className="cmp-booking-purse-val">{format(lf.purse_usd)}</span>
                  <span className="cmp-booking-purse-tag">
                    {lf.purse_negotiable ? "Negotiable" : "Fixed ask"}
                  </span>
                  <div className="cmp-booking-purse-bar">
                    <div
                      className="cmp-booking-purse-bar-fill"
                      style={{ width: `${((lf.purse_usd ?? 0) / maxPurse) * 100}%` }}
                    />
                  </div>
                </>
              ) : (
                <span className="cmp-booking-purse-empty">Purse not listed</span>
              )}
            </div>
          </div>

          <div className="cmp-duel-vs" aria-hidden><span>VS</span></div>

          <div className={cn("cmp-booking-purse-side cmp-booking-purse-side--right", purseAdv === "right" && "cmp-booking-purse-side--adv")}>
            <span className="cmp-booking-purse-fighter">{rf.first_name}</span>
            <div className="cmp-booking-purse-body">
              {rf.purse_usd != null ? (
                <>
                  <span className="cmp-booking-purse-val">{format(rf.purse_usd)}</span>
                  <span className="cmp-booking-purse-tag">
                    {rf.purse_negotiable ? "Negotiable" : "Fixed ask"}
                  </span>
                  <div className="cmp-booking-purse-bar">
                    <div
                      className="cmp-booking-purse-bar-fill"
                      style={{ width: `${((rf.purse_usd ?? 0) / maxPurse) * 100}%` }}
                    />
                  </div>
                </>
              ) : (
                <span className="cmp-booking-purse-empty">Purse not listed</span>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="cmp-booking-logistics">
        <div className="cmp-booking-logistics-head">
          <h3 className="cmp-booking-logistics-title">Lead time & flexibility</h3>
          <p className="cmp-booking-logistics-sub">Prep required and short-notice appetite</p>
        </div>

        <div className="cmp-booking-logistics-row">
          <div className="cmp-booking-logistics-label">
            <Clock className="h-3.5 w-3.5" aria-hidden />
            <span>Prep time</span>
          </div>
          <div className={cn("cmp-booking-logistics-end cmp-booking-logistics-end--left", prepAdv === "left" && "cmp-booking-logistics-end--adv")}>
            <span className="cmp-booking-logistics-val">{prepLabel(lf.preparation_weeks)}</span>
            {lf.preparation_weeks != null && (
              <div className="cmp-booking-logistics-bar">
                <div
                  className="cmp-booking-logistics-bar-fill cmp-booking-logistics-bar-fill--left"
                  style={{
                    width: `${((maxPrep - (lf.preparation_weeks ?? 0)) / maxPrep) * 100}%`,
                  }}
                />
              </div>
            )}
          </div>
          <div className={cn("cmp-booking-logistics-end cmp-booking-logistics-end--right", prepAdv === "right" && "cmp-booking-logistics-end--adv")}>
            {rf.preparation_weeks != null && (
              <div className="cmp-booking-logistics-bar">
                <div
                  className="cmp-booking-logistics-bar-fill cmp-booking-logistics-bar-fill--right"
                  style={{
                    width: `${((maxPrep - (rf.preparation_weeks ?? 0)) / maxPrep) * 100}%`,
                  }}
                />
              </div>
            )}
            <span className="cmp-booking-logistics-val">{prepLabel(rf.preparation_weeks)}</span>
          </div>
        </div>

        <div className="cmp-booking-logistics-row">
          <div className="cmp-booking-logistics-label">
            <Zap className="h-3.5 w-3.5" aria-hidden />
            <span>Short notice</span>
          </div>
          <div className={cn(
            "cmp-booking-logistics-end cmp-booking-logistics-end--left",
            lf.open_to_short_notice && !rf.open_to_short_notice && "cmp-booking-logistics-end--adv",
          )}>
            <span className={cn(
              "cmp-booking-short",
              lf.open_to_short_notice ? "cmp-booking-short--yes" : "cmp-booking-short--no",
            )}>
              {lf.open_to_short_notice ? <><Zap className="h-3 w-3" />Yes</> : "No"}
            </span>
          </div>
          <div className={cn(
            "cmp-booking-logistics-end cmp-booking-logistics-end--right",
            rf.open_to_short_notice && !lf.open_to_short_notice && "cmp-booking-logistics-end--adv",
          )}>
            <span className={cn(
              "cmp-booking-short",
              rf.open_to_short_notice ? "cmp-booking-short--yes" : "cmp-booking-short--no",
            )}>
              {rf.open_to_short_notice ? <><Zap className="h-3 w-3" />Yes</> : "No"}
            </span>
          </div>
        </div>
      </div>

      {hasDetails && (
        <div className="cmp-compare-card cmp-booking-meta">
          {(lf.promotional_status || rf.promotional_status) && (
            <CompareRow
              label="Promotion"
              left={
                <span className="inline-flex flex-col items-end gap-0.5">
                  <span className="inline-flex items-center gap-1.5">
                    {lf.promotional_status === "exclusive"
                      ? <Lock className="h-3 w-3 text-muted-foreground" />
                      : <Globe className="h-3 w-3 text-muted-foreground" />}
                    {promoLabel(lf.promotional_status)}
                  </span>
                  {lf.promoter_name && (
                    <span className="text-[10px] text-muted-foreground">{lf.promoter_name}</span>
                  )}
                </span>
              }
              right={
                <span className="inline-flex flex-col items-start gap-0.5">
                  <span className="inline-flex items-center gap-1.5">
                    {rf.promotional_status === "exclusive"
                      ? <Lock className="h-3 w-3 text-muted-foreground" />
                      : <Globe className="h-3 w-3 text-muted-foreground" />}
                    {promoLabel(rf.promotional_status)}
                  </span>
                  {rf.promoter_name && (
                    <span className="text-[10px] text-muted-foreground">{rf.promoter_name}</span>
                  )}
                </span>
              }
            />
          )}
          {(lf.team_name || rf.team_name) && (
            <CompareRow label="Team / Gym" left={lf.team_name ?? "—"} right={rf.team_name ?? "—"} />
          )}
          {(lf.current_city || rf.current_city) && (
            <CompareRow
              label="Location"
              left={
                <span className="inline-flex items-center gap-1">
                  <MapPin className="h-3 w-3 text-muted-foreground" />
                  {locationLabel(lf)}
                </span>
              }
              right={
                <span className="inline-flex items-center gap-1">
                  <MapPin className="h-3 w-3 text-muted-foreground" />
                  {locationLabel(rf)}
                </span>
              }
            />
          )}
        </div>
      )}
    </div>
  );
}

function BookingHeroCard({
  name, fighter, side, adv,
}: {
  name: string;
  fighter: Fighter;
  side: "left" | "right";
  adv: boolean;
}) {
  return (
    <div className={cn(
      "cmp-booking-hero-card",
      side === "left" ? "cmp-booking-hero-card--left" : "cmp-booking-hero-card--right",
      adv && "cmp-booking-hero-card--adv",
    )}>
      <span className="cmp-booking-hero-name">{name}</span>
      <div className="cmp-booking-hero-body">
        <AvailabilityBadge status={fighter.availability_status} />
        <div className="cmp-booking-hero-facts">
          <div className="cmp-booking-hero-fact">
            <Calendar className="h-3 w-3" aria-hidden />
            <span className="cmp-booking-hero-fact-lbl">Available from</span>
            <span className="cmp-booking-hero-fact-val">{formatAvailableFrom(fighter)}</span>
          </div>
          <div className="cmp-booking-hero-fact">
            <Clock className="h-3 w-3" aria-hidden />
            <span className="cmp-booking-hero-fact-lbl">Prep needed</span>
            <span className="cmp-booking-hero-fact-val">{prepLabel(fighter.preparation_weeks)}</span>
          </div>
          <div className="cmp-booking-hero-fact">
            <Zap className="h-3 w-3" aria-hidden />
            <span className="cmp-booking-hero-fact-lbl">Short notice</span>
            <span className={cn(
              "cmp-booking-hero-fact-val",
              fighter.open_to_short_notice && "text-emerald-400",
            )}>
              {fighter.open_to_short_notice ? "Yes" : "No"}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

function VisibilitySection({ left, right }: { left: FighterData; right: FighterData }) {
  const lf = left.fighter!;
  const rf = right.fighter!;
  const insight = visibilityInsight(lf.first_name, rf.first_name, left, right);
  const followerAdv = calcAdv(left.followerCount, right.followerCount, "higher");
  const maxFollowers = Math.max(left.followerCount ?? 0, right.followerCount ?? 0, 1);
  const lIg = instagramHandle(lf.instagram);
  const rIg = instagramHandle(rf.instagram);
  const lGrowth = useMemo(() => computeIgGrowth(left.followerSnapshots), [left.followerSnapshots]);
  const rGrowth = useMemo(() => computeIgGrowth(right.followerSnapshots), [right.followerSnapshots]);
  const growthAdv = calcAdv(lGrowth?.deltaPctNum, rGrowth?.deltaPctNum, "higher");
  const hasFollowers = left.followerCount != null || right.followerCount != null;
  const hasGrowth = lGrowth != null || rGrowth != null;
  const hasSocial = lIg || rIg || hasFollowers;

  if (!hasSocial) {
    return (
      <div className="cmp-visibility-dossier">
        <div className="cmp-visibility-insight cmp-visibility-insight--empty">
          <span className="cmp-visibility-insight-dot" aria-hidden />
          <p className="cmp-visibility-insight-text">{insight}</p>
        </div>
        <p className="cmp-visibility-empty">No Instagram or follower data on record for either fighter.</p>
      </div>
    );
  }

  return (
    <div className="cmp-visibility-dossier">
      <div className="cmp-visibility-insight">
        <span className="cmp-visibility-insight-dot" aria-hidden />
        <p className="cmp-visibility-insight-text">{insight}</p>
      </div>

      <div className="cmp-visibility-hero-grid">
        <VisibilityHeroCard
          name={lf.first_name}
          handle={lIg}
          followers={left.followerCount}
          growth={lGrowth}
          side="left"
          adv={followerAdv === "left"}
        />
        <div className="cmp-duel-vs" aria-hidden><span>VS</span></div>
        <VisibilityHeroCard
          name={rf.first_name}
          handle={rIg}
          followers={right.followerCount}
          growth={rGrowth}
          side="right"
          adv={followerAdv === "right"}
        />
      </div>

      {hasFollowers && (
        <div className="cmp-visibility-reach">
          <div className="cmp-visibility-reach-head">
            <span className="cmp-visibility-reach-eyebrow">Instagram reach</span>
            <span className="cmp-visibility-reach-hint">
              {hasGrowth ? "Latest snapshot · tracked history below" : "Latest follower snapshot"}
            </span>
          </div>
          <div className="cmp-visibility-reach-grid">
            <div className={cn("cmp-visibility-reach-side", followerAdv === "left" && "cmp-visibility-reach-side--adv")}>
              <span className="cmp-visibility-reach-fighter">{lf.first_name}</span>
              <div className="cmp-visibility-reach-body">
                {left.followerCount != null ? (
                  <>
                    <span className="cmp-visibility-reach-val">{left.followerCount.toLocaleString()}</span>
                    <span className="cmp-visibility-reach-tag">followers</span>
                    <div className="cmp-visibility-reach-bar">
                      <div
                        className="cmp-visibility-reach-bar-fill"
                        style={{ width: `${((left.followerCount ?? 0) / maxFollowers) * 100}%` }}
                      />
                    </div>
                  </>
                ) : (
                  <span className="cmp-visibility-reach-empty">No snapshot</span>
                )}
              </div>
            </div>

            <div className="cmp-duel-vs" aria-hidden><span>VS</span></div>

            <div className={cn("cmp-visibility-reach-side cmp-visibility-reach-side--right", followerAdv === "right" && "cmp-visibility-reach-side--adv")}>
              <span className="cmp-visibility-reach-fighter">{rf.first_name}</span>
              <div className="cmp-visibility-reach-body">
                {right.followerCount != null ? (
                  <>
                    <span className="cmp-visibility-reach-val">{right.followerCount.toLocaleString()}</span>
                    <span className="cmp-visibility-reach-tag">followers</span>
                    <div className="cmp-visibility-reach-bar">
                      <div
                        className="cmp-visibility-reach-bar-fill"
                        style={{ width: `${((right.followerCount ?? 0) / maxFollowers) * 100}%` }}
                      />
                    </div>
                  </>
                ) : (
                  <span className="cmp-visibility-reach-empty">No snapshot</span>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {hasGrowth && (
        <div className="cmp-visibility-growth">
          <div className="cmp-visibility-growth-head">
            <span className="cmp-visibility-growth-eyebrow">Follower trend</span>
            <span className="cmp-visibility-growth-hint">From tracked snapshots</span>
          </div>
          <div className="cmp-visibility-growth-grid">
            <FollowerGrowthCard
              name={lf.first_name}
              growth={lGrowth}
              side="left"
              adv={growthAdv === "left"}
            />
            <div className="cmp-duel-vs" aria-hidden><span>VS</span></div>
            <FollowerGrowthCard
              name={rf.first_name}
              growth={rGrowth}
              side="right"
              adv={growthAdv === "right"}
            />
          </div>
        </div>
      )}
    </div>
  );
}

function VisibilityHeroCard({
  name, handle, followers, growth, side, adv,
}: {
  name: string;
  handle: string | null;
  followers: number | null;
  growth: IgGrowthStats | null;
  side: "left" | "right";
  adv: boolean;
}) {
  const url = handle ? `https://instagram.com/${handle}` : null;

  return (
    <div className={cn(
      "cmp-visibility-hero-card",
      `cmp-visibility-hero-card--${side}`,
      adv && "cmp-visibility-hero-card--adv",
    )}>
      <p className="cmp-visibility-hero-name">{name}</p>
      <div className="cmp-visibility-hero-body">
        {handle && url ? (
          <a href={url} target="_blank" rel="noopener noreferrer" className="cmp-visibility-hero-ig">
            <Instagram className="h-4 w-4" aria-hidden />
            <span>@{handle}</span>
          </a>
        ) : (
          <span className="cmp-visibility-hero-ig cmp-visibility-hero-ig--empty">No Instagram</span>
        )}
        {followers != null ? (
          <div className="cmp-visibility-hero-followers">
            <span className="cmp-visibility-hero-followers-val">{followers.toLocaleString()}</span>
            <span className="cmp-visibility-hero-followers-lbl">followers</span>
            {growth && (
              <span className={cn(
                "cmp-visibility-hero-growth",
                growth.delta >= 0 ? "cmp-visibility-hero-growth--up" : "cmp-visibility-hero-growth--down",
              )}>
                {growth.delta >= 0 ? "+" : ""}{growth.delta.toLocaleString()} ({growth.deltaPct})
              </span>
            )}
          </div>
        ) : (
          <span className="cmp-visibility-hero-followers-empty">Follower count not tracked</span>
        )}
      </div>
    </div>
  );
}

function FollowerGrowthCard({
  name, growth, side, adv,
}: {
  name: string;
  growth: IgGrowthStats | null;
  side: "left" | "right";
  adv: boolean;
}) {
  const gradId = `cmp-ig-grad-${side}`;

  if (!growth) {
    return (
      <div className={cn("cmp-visibility-growth-card", `cmp-visibility-growth-card--${side}`)}>
        <span className="cmp-visibility-growth-fighter">{name}</span>
        <p className="cmp-visibility-growth-empty">Need 2+ snapshots to show trend</p>
      </div>
    );
  }

  const lastPt = growth.coords[growth.coords.length - 1];
  const firstPt = growth.coords[0];

  return (
    <div className={cn(
      "cmp-visibility-growth-card",
      `cmp-visibility-growth-card--${side}`,
      adv && "cmp-visibility-growth-card--adv",
    )}>
      <span className="cmp-visibility-growth-fighter">{name}</span>
      <div className="cmp-visibility-growth-stats">
        <span className="cmp-visibility-growth-val">{growth.latest.toLocaleString()}</span>
        <span className={cn(
          "cmp-visibility-growth-delta",
          growth.delta >= 0 ? "cmp-visibility-growth-delta--up" : "cmp-visibility-growth-delta--down",
        )}>
          {growth.delta >= 0 ? "+" : ""}{growth.delta.toLocaleString()} ({growth.deltaPct})
        </span>
      </div>
      <p className="cmp-visibility-growth-meta">
        {growth.days} days · {growth.snapshotCount} snapshots
      </p>
      <svg
        className="cmp-visibility-growth-chart"
        width="100%"
        height={growth.height}
        viewBox={`0 0 ${growth.width} ${growth.height}`}
        preserveAspectRatio="xMidYMid meet"
        aria-hidden
      >
        <defs>
          <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#E8001D" stopOpacity="0.22" />
            <stop offset="100%" stopColor="#E8001D" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={growth.area} fill={`url(#${gradId})`} />
        <path
          d={growth.line}
          fill="none"
          stroke="#E8001D"
          strokeWidth="2"
          strokeLinecap="round"
          opacity="0.85"
        />
        <circle cx={lastPt.x} cy={lastPt.y} r="4" fill="#E8001D" />
      </svg>
      <div className="cmp-visibility-growth-range">
        <span>{firstPt.label} · {firstPt.count.toLocaleString()}</span>
        <span>{lastPt.label} · {lastPt.count.toLocaleString()}</span>
      </div>
    </div>
  );
}

function HistorySection({ left, right }: { left: FighterData; right: FighterData }) {
  const lf = left.fighter!;
  const rf = right.fighter!;
  const insight = historyInsight(lf.first_name, rf.first_name, left, right);
  const lHot = left.form.streak >= 2 && left.form.type === "W";
  const rHot = right.form.streak >= 2 && right.form.type === "W";
  const lCold = left.form.streak >= 2 && left.form.type === "L";
  const rCold = right.form.streak >= 2 && right.form.type === "L";

  return (
    <div className="cmp-history-dossier">
      <div className="cmp-history-insight">
        <span className="cmp-history-insight-dot" aria-hidden />
        <p className="cmp-history-insight-text">{insight}</p>
      </div>

      <RecentFormStrip
        leftName={lf.first_name}
        rightName={rf.first_name}
        leftFights={left.lastFights}
        rightFights={right.lastFights}
      />

      <div className="cmp-history-duel-grid">
        <FighterFightTimeline
          name={`${lf.first_name} ${lf.last_name}`}
          fights={left.lastFights}
          streak={left.form}
          side="left"
          hot={lHot}
          cold={lCold}
        />
        <div className="cmp-duel-vs" aria-hidden><span>VS</span></div>
        <FighterFightTimeline
          name={`${rf.first_name} ${rf.last_name}`}
          fights={right.lastFights}
          streak={right.form}
          side="right"
          hot={rHot}
          cold={rCold}
        />
      </div>
    </div>
  );
}

function RecentFormStrip({
  leftName, rightName, leftFights, rightFights,
}: {
  leftName: string;
  rightName: string;
  leftFights: AnyRow[];
  rightFights: AnyRow[];
}) {
  const slots = 5;
  const leftOutcomes = leftFights.slice(0, slots).map((f) => parseFightOutcome(f.result));
  const rightOutcomes = rightFights.slice(0, slots).map((f) => parseFightOutcome(f.result));

  return (
    <div className="cmp-history-form">
      <div className="cmp-history-form-head">
        <span className="cmp-history-form-title">Recent form</span>
        <span className="cmp-history-form-hint">Most recent ← left</span>
      </div>
      <div className="cmp-history-form-duel">
        <FormStripSide name={leftName} outcomes={leftOutcomes} slots={slots} />
        <div className="cmp-history-form-split" aria-hidden />
        <FormStripSide name={rightName} outcomes={rightOutcomes} slots={slots} side="right" />
      </div>
    </div>
  );
}

function FormStripSide({
  name, outcomes, slots, side = "left",
}: {
  name: string;
  outcomes: FightOutcome[];
  slots: number;
  side?: "left" | "right";
}) {
  const cells = Array.from({ length: slots }, (_, i) => outcomes[i] ?? null);
  return (
    <div className={cn(
      "cmp-history-form-side",
      side === "right" && "cmp-history-form-side--right",
    )}>
      <span className="cmp-history-form-name">{name}</span>
      <div className="cmp-history-form-track">
        {cells.map((o, i) => (
          <FormOutcomeCell key={i} outcome={o} />
        ))}
      </div>
    </div>
  );
}

function FormOutcomeCell({ outcome }: { outcome: FightOutcome | null }) {
  if (!outcome || outcome === "NC") {
    return (
      <span className="cmp-history-form-cell cmp-history-form-cell--empty" aria-hidden>
        <span className="cmp-history-form-cell-char">–</span>
      </span>
    );
  }
  return (
    <span className={cn(
      "cmp-history-form-cell",
      outcome === "W" && "cmp-history-form-cell--win",
      outcome === "L" && "cmp-history-form-cell--loss",
      outcome === "D" && "cmp-history-form-cell--draw",
    )}>
      <span className="cmp-history-form-cell-char">{outcome}</span>
    </span>
  );
}

function FighterFightTimeline({
  name, fights, streak, side, hot, cold,
}: {
  name: string;
  fights: AnyRow[];
  streak: { streak: number; type: "W" | "L" | "D" | null };
  side: "left" | "right";
  hot: boolean;
  cold: boolean;
}) {
  return (
    <div className={cn(
      "cmp-history-timeline",
      side === "left" ? "cmp-history-timeline--left" : "cmp-history-timeline--right",
    )}>
      <div className="cmp-history-timeline-head">
        <div>
          <h3 className="cmp-history-timeline-name">{name}</h3>
          <p className="cmp-history-timeline-sub">Last {fights.length || 0} bout{fights.length === 1 ? "" : "s"} on record</p>
        </div>
        {streak.streak >= 2 && streak.type && (
          <span className={cn(
            "cmp-form-badge",
            hot && "cmp-form-badge--hot",
            cold && "cmp-form-badge--cold",
          )}>
            {streak.streak}{streak.type} streak
          </span>
        )}
      </div>
      {fights.length === 0 ? (
        <p className="cmp-history-timeline-empty">No fights logged for this sport</p>
      ) : (
        <div className="cmp-history-timeline-list">
          {fights.map((f) => (
            <FightTimelineRow key={f.id} fight={f} />
          ))}
        </div>
      )}
    </div>
  );
}

function FightTimelineRow({ fight }: { fight: AnyRow }) {
  const meta = fightOutcomeMeta(fight.result);
  const method = methodLabel(fight.method);
  const opponent = opponentDisplayName(fight);
  const dateStr = fight.event_date ? formatFightDate(fight.event_date) : null;
  const hasTitle = Boolean(fight.title_bout?.trim());
  const hasBonus = Array.isArray(fight.bonuses) && fight.bonuses.some((b: string) => b?.trim());

  return (
    <div className="cmp-fight-row">
      <div className={cn("cmp-fight-row-result", `cmp-fight-row-result--${meta.tone}`)}>
        {meta.label}
      </div>
      <div className="cmp-fight-row-body">
        <p className="cmp-fight-row-line cmp-fight-row-line--opp">vs {opponent}</p>
        <p className="cmp-fight-row-line cmp-fight-row-line--meta">
          <span className={cn("cmp-fight-row-method", `cmp-fight-row-method--${meta.tone}`)}>
            {method ?? "—"}
          </span>
          <span className="cmp-fight-row-dot" aria-hidden>·</span>
          <span>{fight.organization ?? "—"}</span>
          <span className="cmp-fight-row-dot" aria-hidden>·</span>
          <span>{dateStr ?? "—"}</span>
          {(hasTitle || hasBonus) && (
            <span className="cmp-fight-row-badges">
              {hasTitle && <span className="cmp-fight-badge cmp-fight-badge--title">Title</span>}
              {hasBonus && <span className="cmp-fight-badge cmp-fight-badge--bonus">Bonus</span>}
            </span>
          )}
        </p>
        <p className={cn(
          "cmp-fight-row-line cmp-fight-row-line--event",
          !fight.event_name && "cmp-fight-row-line--muted",
        )}>
          {fight.event_name ?? "—"}
        </p>
      </div>
    </div>
  );
}
