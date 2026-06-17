import { useRef, useState, useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Bell, Calendar, ChevronDown, Clock, DollarSign, ExternalLink,
  Globe, Heart, Instagram, Lock, MapPin, Shield,
  ShieldCheck, Trophy, User, Video, Zap,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/auth-context";
import { cn, formatCurrency } from "@/lib/utils";
import { saveFavourite, removeSavedFavourite, setNotifyWatch } from "@/lib/favourite-mutations";
import { isSavedFavourite } from "@/lib/favourites-schema";
import { useFavouritesSchema } from "@/hooks/use-favourites-schema";
import type { Fighter } from "@/types/database";
import { VideosTab } from "@/components/fighter-drawer/videos-tab";

// ── Types & constants ─────────────────────────────────────────────────────────

type Tab = "booking" | "sports" | "fights" | "videos" | "about";

const TABS: { id: Tab; label: string; Icon: React.ElementType }[] = [
  { id: "booking", label: "Booking",  Icon: Calendar },
  { id: "sports",  label: "Sports",   Icon: Trophy   },
  { id: "fights",  label: "Fights",   Icon: Zap      },
  { id: "videos",  label: "Videos",   Icon: Video    },
  { id: "about",   label: "About",    Icon: User     },
];

const RESULT = {
  win:  { tone: "win"  as const, label: "W"  },
  loss: { tone: "loss" as const, label: "L"  },
  draw: { tone: "draw" as const, label: "D"  },
  nc:   { tone: "nc"   as const, label: "NC" },
} as const;

const STATUS_LABEL: Record<string, string> = {
  available:   "Available",
  in_camp:     "In Camp",
  unavailable: "Unavailable",
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function resultMeta(r: string | null) {
  if (!r) return RESULT.nc;
  const k = r.toLowerCase();
  if (k.startsWith("w")) return RESULT.win;
  if (k.startsWith("l")) return RESULT.loss;
  if (k.startsWith("d")) return RESULT.draw;
  return RESULT.nc;
}

function delay(ms: number): React.CSSProperties {
  return { animationDelay: `${ms}ms` };
}

function formatDate(iso: string | null): string {
  if (!iso) return "";
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m) return iso;
  const dt = d ? new Date(y, m - 1, d) : new Date(y, m - 1, 1);
  return dt.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

function opponentDisplayName(fight: { name?: string | null; opponent_name?: string | null }): string {
  const name = fight.name ?? fight.opponent_name;
  if (typeof name === "string" && name.trim()) return name.trim();
  return "Unknown";
}

function singleFighterBookingReadiness(fighter: Fighter): {
  tone: "good" | "warn" | "neutral";
  message: string;
} {
  const status = fighter.availability_status ?? "unavailable";
  if (status === "available") {
    return { tone: "good", message: "Fighter is available — good window to open booking talks." };
  }
  if (status === "unavailable") {
    return { tone: "warn", message: "Fighter is unavailable — confirm status before pitching." };
  }
  if (status === "in_camp") {
    return { tone: "neutral", message: "Fighter is in camp — align timelines before committing." };
  }
  return { tone: "neutral", message: "Check availability and camp schedule before booking." };
}

function sportsInsight(
  sports: { sport: string; is_active?: boolean | null; pro_w: number; pro_l: number; pro_d: number }[],
  activeSport?: string | null,
): string {
  const active = sports.filter(s => s.is_active);
  const featured = activeSport ? sports.find(s => s.sport === activeSport) : sports[0];
  if (featured) {
    const total = featured.pro_w + featured.pro_l + featured.pro_d;
    const name = sportDisplayLabel(featured.sport);
    if (total > 0) {
      const rate = Math.round((featured.pro_w / total) * 100);
      return `${name} pro record ${featured.pro_w}–${featured.pro_l}–${featured.pro_d} (${rate}% win rate).`;
    }
    return `${name} is on file${featured.is_active ? " and open to compete" : ""}.`;
  }
  if (active.length > 1) {
    return `Competes in ${active.length} active disciplines — review records per sport.`;
  }
  return "Sport profiles and records — confirm weight classes and fight styles.";
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function fightsFormInsight(fights: any[]): string {
  const recent = fights.slice(0, 8).map(f => parseFightOutcome(f.result));
  let streak = 0;
  const first = recent[0];
  if (first && first !== "NC") {
    for (const o of recent) {
      if (o === first) streak++;
      else break;
    }
  }
  if (streak >= 2 && first === "W") {
    return `On a ${streak}-fight win streak — momentum is strong.`;
  }
  if (streak >= 2 && first === "L") {
    return `Dropped ${streak} straight — form is a question mark.`;
  }
  if (recent.length > 0) {
    return "Recent form and finish breakdown — scan before making the call.";
  }
  return "Fight history on record — filter by sport and level.";
}

function aboutPhysicalInsight(fighter: Fighter, followerCount: number | null): string {
  const parts: string[] = [];
  if (fighter.height_cm) parts.push(`${fighter.height_cm} cm tall`);
  if (fighter.reach_cm) parts.push(`${fighter.reach_cm} cm reach`);
  if (fighter.stance) {
    parts.push(`${fighter.stance.replace(/_/g, " ")} stance`);
  }
  if (parts.length > 0) {
    return parts.join(" · ") + (followerCount != null ? ` — ${followerCount.toLocaleString()} Instagram followers tracked.` : ".");
  }
  if (followerCount != null) {
    return `${followerCount.toLocaleString()} Instagram followers tracked — social reach shapes promotability.`;
  }
  if (fighter.instagram) {
    return "Physical profile and social presence — size and reach shape how this fighter fights.";
  }
  return "Physical profile, travel eligibility, and team affiliation.";
}

// ── Main component ────────────────────────────────────────────────────────────

type Props = { fighter: Fighter; activeSport?: string | null };

export function FighterDrawerContent({ fighter, activeSport }: Props) {
  const { matchmaker } = useAuth();
  const qc = useQueryClient();
  const [tab, setTab] = useState<Tab>("booking");
  const [slideDir, setSlideDir] = useState<"right" | "left">("right");
  const tabIdxRef = useRef(0);

  // Record for hero chip — scoped to activeSport when present, otherwise sum all pro records
  const { data: record } = useQuery({
    queryKey: ["fighter-record-agg", fighter.id, activeSport ?? "all"],
    queryFn: async () => {
      let q = supabase.from("fighter_sports").select("pro_w, pro_l, pro_d").eq("user_id", fighter.id);
      if (activeSport) q = q.eq("sport", activeSport);
      const { data } = await q;
      if (!data?.length) return null;
      const t = data.reduce((a, s) => ({ w: a.w + s.pro_w, l: a.l + s.pro_l, d: a.d + s.pro_d }), { w: 0, l: 0, d: 0 });
      return t.w + t.l + t.d > 0 ? t : null;
    },
  });

  const { data: hasIsSaved } = useFavouritesSchema();

  const { data: favourite } = useQuery({
    queryKey: ["favourite-detail", fighter.id, hasIsSaved],
    enabled: !!matchmaker && hasIsSaved !== undefined,
    queryFn: async () => {
      const select = hasIsSaved ? "id, note, notify, is_saved" : "id, note, notify";
      const { data, error } = await supabase
        .from("matchmaker_favourites")
        .select(select)
        .eq("fighter_id", fighter.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const isFavourite = isSavedFavourite(favourite, hasIsSaved ?? false);
  const isNotify = favourite?.notify === true;

  const toggleFavourite = useMutation({
    mutationFn: async () => {
      if (isFavourite) {
        await removeSavedFavourite(supabase, fighter.id);
      } else {
        await saveFavourite(supabase, matchmaker!.id, fighter.id);
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["favourite", fighter.id] });
      qc.invalidateQueries({ queryKey: ["favourite-detail", fighter.id] });
      qc.invalidateQueries({ queryKey: ["favourites"] });
      qc.invalidateQueries({ queryKey: ["favourite-fighter-ids"] });
    },
  });

  const toggleNotify = useMutation({
    mutationFn: async () => {
      await setNotifyWatch(
        supabase,
        matchmaker!.id,
        fighter.id,
        !isNotify,
        isFavourite,
      );
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["favourite-detail", fighter.id] });
      qc.invalidateQueries({ queryKey: ["favourite", fighter.id] });
    },
  });

  function switchTab(id: Tab) {
    const newIdx = TABS.findIndex(t => t.id === id);
    setSlideDir(newIdx > tabIdxRef.current ? "right" : "left");
    tabIdxRef.current = newIdx;
    setTab(id);
  }

  return (
    <div className="fd-drawer-content flex flex-col min-h-0">
      <HeroSection
        fighter={fighter}
        record={record ?? null}
        isFavourite={isFavourite}
        isNotify={isNotify}
        onToggleFav={() => toggleFavourite.mutate()}
        onToggleNotify={() => toggleNotify.mutate()}
      />

      {/* Tab bar */}
      <div className="fd-tabs">
        <nav className="fd-section-nav" aria-label="Fighter sections" role="tablist">
          {TABS.map(({ id, label, Icon }) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={tab === id}
              onClick={() => switchTab(id)}
              className={cn("cmp-section-tab", tab === id && "cmp-section-tab--active")}
            >
              <Icon size={13} />
              {label}
            </button>
          ))}
        </nav>
      </div>

      {/* Sliding tab panel */}
      <div
        key={tab}
        className={cn(
          "fd-panel",
          tab === "fights" && "fd-panel--fights",
          slideDir === "right" ? "fd-slide-right" : "fd-slide-left"
        )}
      >
        {tab === "booking" && <BookingTab fighter={fighter} />}
        {tab === "sports"  && <SportsTab fighterId={fighter.id} activeSport={activeSport} />}
        {tab === "fights"  && <FightsTab fighterId={fighter.id} activeSport={activeSport} />}
        {tab === "videos"  && <VideosTab fighterId={fighter.id} matchmakerId={matchmaker?.id} />}
        {tab === "about"   && <AboutTab fighter={fighter} />}
      </div>
    </div>
  );
}

// ── Hero ──────────────────────────────────────────────────────────────────────

function HeroSection({ fighter, record, isFavourite, isNotify, onToggleFav, onToggleNotify }: {
  fighter: Fighter;
  record: { w: number; l: number; d: number } | null;
  isFavourite?: boolean;
  isNotify: boolean;
  onToggleFav: () => void;
  onToggleNotify: () => void;
}) {
  const status = fighter.availability_status ?? "unavailable";
  const fullName = [fighter.first_name, fighter.last_name].filter(Boolean).join(" ");
  const initials = [fighter.first_name?.[0], fighter.last_name?.[0]].filter(Boolean).join("").toUpperCase();

  const hasPills = fighter.purse_usd != null || fighter.open_to_short_notice ||
    fighter.preparation_weeks != null || !!fighter.promotional_status;

  return (
    <div className="fd-hero fd-up" style={delay(0)}>
      <div className={cn("fd-hero-photo", `fd-hero-photo--${status}`)}>
        {fighter.photo_url ? (
          <img src={fighter.photo_url} alt="" />
        ) : (
          <div className="fd-hero-photo-placeholder">{initials || "?"}</div>
        )}
      </div>

      <div className="fd-hero-body">
        <div className="fd-hero-name-row">
          <h2 className="fd-hero-name">{fullName}</h2>
          {record && (
            <span className="fd-hero-record">{record.w}–{record.l}–{record.d}</span>
          )}
          <div className="fd-hero-actions">
            <button
              type="button"
              className={cn("fd-action-btn", isNotify && "fd-action-btn--active")}
              onClick={onToggleNotify}
              title={isNotify ? "Stop notifications" : "Notify when available"}
            >
              <Bell size={14} />
            </button>
            <button
              type="button"
              className={cn("fd-action-btn", isFavourite && "fd-action-btn--fav")}
              onClick={onToggleFav}
              title={isFavourite ? "Remove from favourites" : "Add to favourites"}
            >
              <Heart size={14} fill={isFavourite ? "currentColor" : "none"} strokeWidth={1.5} />
            </button>
          </div>
        </div>

        <div className="fd-hero-meta">
          <span className={cn("fd-hero-status", `fd-hero-status--${status}`)}>
            <span className="fd-hero-status-dot" />
            {STATUS_LABEL[status] ?? "Unknown"}
          </span>
          {fighter.country && (
            <span className="fd-hero-meta-item"><MapPin size={10} />{fighter.country}</span>
          )}
          {fighter.team_name && (
            <span className="fd-hero-meta-item"><Shield size={10} />{fighter.team_name}</span>
          )}
          {fighter.nickname && (
            <span className="fd-hero-nickname">&ldquo;{fighter.nickname}&rdquo;</span>
          )}
          {fighter.identity_verified && (
            <span className="fd-hero-verified"><ShieldCheck size={9} />Identity Verified</span>
          )}
        </div>

        {hasPills && (
          <div className="fd-hero-pills">
            {fighter.purse_usd != null && (
              <span className="fd-pill"><DollarSign size={10} />{formatCurrency(fighter.purse_usd)}</span>
            )}
            {fighter.preparation_weeks != null && (
              <span className="fd-pill"><Clock size={10} />{fighter.preparation_weeks}w prep</span>
            )}
            {fighter.open_to_short_notice && (
              <span className="fd-pill fd-pill--green"><Zap size={10} />Short notice OK</span>
            )}
            {fighter.promotional_status === "open" && (
              <span className="fd-pill"><Globe size={10} />Free agent</span>
            )}
            {fighter.promotional_status === "exclusive" && (
              <span className="fd-pill fd-pill--amber"><Lock size={10} />Exclusive</span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Booking tab ───────────────────────────────────────────────────────────────

function BookingTab({ fighter }: { fighter: Fighter }) {
  const readiness = singleFighterBookingReadiness(fighter);
  const prepLabel = fighter.preparation_weeks != null
    ? fighter.preparation_weeks === 0 ? "Always ready" : `${fighter.preparation_weeks} weeks`
    : null;

  const availValue = fighter.available_from
    ? formatDate(fighter.available_from)
    : fighter.availability_status === "available" ? "Now" : "—";

  return (
    <div className="fd-dossier">
      <div className={cn("cmp-booking-readiness", `cmp-booking-readiness--${readiness.tone}`)}>
        <span className="cmp-booking-readiness-dot" aria-hidden />
        <p className="cmp-booking-readiness-text">{readiness.message}</p>
      </div>

      <div className="fd-booking-grid">
        {fighter.purse_usd != null && (
          <BookingCard icon={<DollarSign size={18} />} label="Fight Purse" value={formatCurrency(fighter.purse_usd)} detail={fighter.purse_negotiable ? "Negotiable" : "Fixed ask"} delayMs={0} />
        )}
        <BookingCard icon={<Calendar size={18} />} label="Available From" value={availValue} delayMs={40} />
        {prepLabel && (
          <BookingCard icon={<Clock size={18} />} label="Preparation" value={prepLabel} delayMs={80} />
        )}
        <BookingCard
          icon={<Zap size={18} />}
          label="Short Notice"
          value={fighter.open_to_short_notice ? "Available" : "No"}
          detail={fighter.open_to_short_notice ? "Can take fights on short turnaround" : "Prefers regular lead time"}
          highlight={fighter.open_to_short_notice}
          delayMs={120}
        />
        <BookingCard
          icon={fighter.promotional_status === "exclusive" ? <Lock size={18} /> : <Globe size={18} />}
          label="Promotion"
          value={fighter.promotional_status === "exclusive" ? "Exclusive" : "Free agent"}
          detail={fighter.promotional_status === "exclusive" && fighter.promoter_name ? fighter.promoter_name : undefined}
          delayMs={160}
        />
        {fighter.current_city && (
          <BookingCard icon={<MapPin size={18} />} label="Current Location" value={[fighter.current_city, fighter.current_city_country].filter(Boolean).join(", ")} delayMs={200} />
        )}
      </div>
    </div>
  );
}

function BookingCard({ icon, label, value, detail, highlight, delayMs }: {
  icon: React.ReactNode; label: string; value: string; detail?: string; highlight?: boolean; delayMs: number;
}) {
  return (
    <div className={cn("fd-stat-card fd-up", highlight && "fd-stat-card--highlight")} style={delay(delayMs)}>
      <div className="fd-stat-card-icon">{icon}</div>
      <div className="min-w-0">
        <p className="fd-stat-card-label">{label}</p>
        <p className="fd-stat-card-value">{value}</p>
        {detail && <p className="fd-stat-card-detail">{detail}</p>}
      </div>
    </div>
  );
}

// ── Sports tab ────────────────────────────────────────────────────────────────

function SportsTab({ fighterId, activeSport }: { fighterId: string; activeSport?: string | null }) {
  const { data: sports = [], isLoading } = useQuery({
    queryKey: ["fighter-sports", fighterId],
    queryFn: async () => {
      const { data } = await supabase
        .from("fighter_sports")
        .select(`id, sport, level, pro_w, pro_l, pro_d, amateur_w, amateur_l, amateur_d, is_active,
          fighter_sport_weight_classes(weight_classes(id, name, limit_kg)),
          fighter_sport_fight_styles(fight_styles(id, label, slug))`)
        .eq("user_id", fighterId).order("sport");
      return data ?? [];
    },
  });

  if (isLoading) return <TabLoader />;
  if (!sports.length) return <TabEmpty label="No sports on record" />;

  const featured = activeSport ? sports.find(s => s.sport === activeSport) : null;
  const rest = activeSport ? sports.filter(s => s.sport !== activeSport) : sports;

  return (
    <div className="fd-dossier">
      <div className="cmp-history-insight">
        <span className="cmp-history-insight-dot" aria-hidden />
        <p className="cmp-history-insight-text">{sportsInsight(sports, activeSport)}</p>
      </div>

      {featured && <SportCardFeatured sport={featured} delayMs={0} />}

      {featured && rest.length > 0 && (
        <div className="fd-section-split">
          <div className="fd-section-split-line" />
          <span className="fd-section-split-label">Also competes in</span>
          <div className="fd-section-split-line" />
        </div>
      )}

      {rest.length > 0 && (
        <div className="grid grid-cols-2 gap-2.5">
          {rest.map((s, i) => (
            <SportCardMini key={s.id} sport={s} delayMs={(featured ? 1 : i) * 60 + 60} />
          ))}
        </div>
      )}
    </div>
  );
}

function RecordBlocks({ levels, size = "normal" }: { levels: { key: string; label: string; w: number; l: number; d: number }[]; size?: "normal" | "hero" }) {
  return (
    <>
      {levels.map(lvl => (
        <div key={lvl.key}>
          {levels.length > 1 && (
            <p className="fd-record-level-label">{lvl.label}</p>
          )}
          <div className={cn("fd-record-grid", size === "hero" && "fd-record-grid--hero")}>
            <div className="fd-record-cell fd-record-cell--w">
              <p className="fd-record-cell-num">{lvl.w}</p>
              <p className="fd-record-cell-lbl">W</p>
            </div>
            <div className="fd-record-cell fd-record-cell--l">
              <p className="fd-record-cell-num">{lvl.l}</p>
              <p className="fd-record-cell-lbl">L</p>
            </div>
            {lvl.d > 0 && (
              <div className="fd-record-cell fd-record-cell--d">
                <p className="fd-record-cell-num">{lvl.d}</p>
                <p className="fd-record-cell-lbl">D</p>
              </div>
            )}
          </div>
        </div>
      ))}
    </>
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function SportCardFeatured({ sport, delayMs }: { sport: any; delayMs: number }) {
  const name = sportDisplayLabel(sport.sport);
  const levels = [
    { key: "pro",     label: "Pro",     w: sport.pro_w,     l: sport.pro_l,     d: sport.pro_d     },
    { key: "amateur", label: "Amateur", w: sport.amateur_w, l: sport.amateur_l, d: sport.amateur_d },
  ].filter(lvl => lvl.w + lvl.l + lvl.d > 0);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const weightClasses = (sport.fighter_sport_weight_classes ?? []).map((r: any) => r.weight_classes).filter(Boolean);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const fightStyles   = (sport.fighter_sport_fight_styles   ?? []).map((r: any) => r.fight_styles  ).filter(Boolean);

  return (
    <div className="fd-sport-featured fd-up" style={delay(delayMs)}>
      <div className="fd-sport-featured-head">
        <div>
          <p className="fd-sport-featured-name">{name}</p>
          {sport.level && (
            <span className="fd-sport-featured-level">
              {sport.level === "pro" ? "Professional" : "Amateur"}
            </span>
          )}
        </div>
        {sport.is_active ? (
          <span className="fd-sport-featured-badge fd-sport-featured-badge--active">
            <span className="fd-sport-featured-badge--active-dot" />
            Open to compete
          </span>
        ) : (
          <span className="fd-sport-featured-badge fd-sport-featured-badge--historical">Historical</span>
        )}
      </div>

      <div className="fd-sport-featured-body">
        <RecordBlocks levels={levels} size="hero" />

        {weightClasses.length > 0 && (
          <div>
            <p className="fd-eyebrow">Weight classes</p>
            <div className="flex flex-wrap gap-1.5">
              {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
              {weightClasses.map((wc: any) => (
                <span key={wc.id} className="cmp-tag">
                  {wc.name} · {wc.limit_kg} kg
                </span>
              ))}
            </div>
          </div>
        )}

        {fightStyles.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
            {fightStyles.map((fs: any) => (
              <span key={fs.id} className="cmp-tag">{fs.label}</span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function SportCardMini({ sport, delayMs }: { sport: any; delayMs: number }) {
  const name = sportDisplayLabel(sport.sport);
  const levels = [
    { key: "pro",     label: "Pro",     w: sport.pro_w,     l: sport.pro_l,     d: sport.pro_d     },
    { key: "amateur", label: "Amateur", w: sport.amateur_w, l: sport.amateur_l, d: sport.amateur_d },
  ].filter(lvl => lvl.w + lvl.l + lvl.d > 0);

  return (
    <div className="fd-sport-mini fd-up" style={delay(delayMs)}>
      <div className="fd-sport-mini-inner">
        <div className="fd-sport-mini-head">
          <p className="fd-sport-mini-name">{name}</p>
          {sport.level && (
            <span className="fd-sport-mini-level">{sport.level}</span>
          )}
        </div>
        <RecordBlocks levels={levels} size="normal" />
      </div>
    </div>
  );
}

// ── Fights tab ────────────────────────────────────────────────────────────────

function FightsTab({ fighterId, activeSport }: { fighterId: string; activeSport?: string | null }) {
  const [sportFilter, setSportFilter] = useState(activeSport ?? "all");
  const [levelFilter, setLevelFilter] = useState("all");

  const { data: fights = [], isLoading } = useQuery({
    queryKey: ["fighter-fights", fighterId],
    queryFn: async () => {
      const { data } = await supabase
        .from("opponents")
        .select("*")
        .eq("user_id", fighterId)
        .order("event_date", { ascending: false, nullsFirst: false });
      return data ?? [];
    },
  });

  const sports = useMemo(
    () => Array.from(new Set(fights.map((f: any) => f.sport).filter(Boolean))) as string[],
    [fights],
  );
  const levels = useMemo(
    () => Array.from(new Set(fights.map((f: any) => normalizeLevel(f.level)).filter(l => l !== "other"))) as string[],
    [fights],
  );
  const filtered = useMemo(
    () => fights.filter((f: any) => {
      const sport = f.sport ?? "";
      const level = normalizeLevel(f.level);
      return (sportFilter === "all" || sport === sportFilter) && (levelFilter === "all" || level === levelFilter);
    }),
    [fights, sportFilter, levelFilter],
  );

  const showSportFilters = sports.length > 1;
  const showLevelFilters = levels.length > 1;
  const showToolbar = showSportFilters || showLevelFilters;
  const currentSportLabel = sportFilter !== "all" ? sportDisplayLabel(sportFilter) : null;
  const currentLevelNote  = levelFilter !== "all" ? (LEVEL_DISPLAY[levelFilter] ?? levelFilter) : null;

  if (isLoading) return <TabLoader />;
  if (!fights.length) return <TabEmpty label="No fight history on record" />;

  return (
    <div className="fd-dossier fd-fights-layout">
      <div className="cmp-history-insight">
        <span className="cmp-history-insight-dot" aria-hidden />
        <p className="cmp-history-insight-text">{fightsFormInsight(fights)}</p>
      </div>

      {showToolbar && (
        <div className="fd-fights-filter-bar">
          {showSportFilters && (
            <FightsFilterGroup label="Sport">
              <FilterChip active={sportFilter === "all"} onClick={() => setSportFilter("all")} label="All" />
              {sports.map(slug => (
                <FilterChip key={slug} active={sportFilter === slug} onClick={() => setSportFilter(slug)} label={sportDisplayLabel(slug)} />
              ))}
            </FightsFilterGroup>
          )}
          {showSportFilters && showLevelFilters && <div className="fd-fights-divider" aria-hidden />}
          {showLevelFilters && (
            <FightsFilterGroup label="Level">
              <FilterChip active={levelFilter === "all"} onClick={() => setLevelFilter("all")} label="All levels" />
              {levels.map(lvl => (
                <FilterChip key={lvl} active={levelFilter === lvl} onClick={() => setLevelFilter(lvl)} label={LEVEL_DISPLAY[lvl] ?? lvl} />
              ))}
            </FightsFilterGroup>
          )}
        </div>
      )}

      <div className="fd-fights-body">
        <div className="fd-fights-insights-col">
          <FightInsights fights={filtered} sportLabel={currentSportLabel} levelNote={currentLevelNote} />
        </div>

        <div className="fd-fights-history-col">
          <div className="cmp-compare-card fd-fight-list fd-up" style={delay(60)}>
            {filtered.length === 0 ? (
              <div className="fd-fight-empty-filter">
                No fights match current filters
              </div>
            ) : (
              filtered.map((f: any, i: number) => (
                <FightRow key={f.id} fight={f} isLast={i === filtered.length - 1} />
              ))
            )}
            <div className="h-7" aria-hidden />
          </div>
        </div>
      </div>
    </div>
  );
}

function FightsFilterGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="fd-fights-filter-group">
      <span className="fd-fights-filter-label">{label}</span>
      {children}
    </div>
  );
}

function FilterChip({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button type="button" onClick={onClick} className={cn("fd-chip", active && "fd-chip--active")}>
      {label}
    </button>
  );
}

// ── Method labels ─────────────────────────────────────────────────────────────

const METHOD_LABELS: Record<string, string> = {
  ko_tko: "KO / TKO",
  submission: "Submission",
  decision_unanimous: "Decision — Unanimous",
  decision_split: "Decision — Split",
  decision_majority: "Decision — Majority",
  technical_decision: "Technical Decision",
  technical_submission: "Technical Submission",
  draw: "Draw",
  dq: "Disqualification",
  no_contest: "No Contest",
};
function methodLabel(method: string | null): string | null {
  if (!method || method === "other") return null;
  return METHOD_LABELS[method] ?? method;
}

// ── Fight highlight badges ─────────────────────────────────────────────────────

type HighlightKind = "title" | "title_champion" | "title_challenger" | "fight_of_night" | "perf_of_night" | "sub_of_night" | "ko_of_night" | "bonus";
type Highlight = { kind: HighlightKind; label: string; title: string };

const HIGHLIGHT_STYLES: Record<HighlightKind, { color: string; bg: string; border: string }> = {
  title:            { color: "#fbbf24", bg: "rgba(251,191,36,0.14)",   border: "rgba(251,191,36,0.32)"  },
  title_champion:   { color: "#fde68a", bg: "rgba(253,224,71,0.12)",   border: "rgba(253,224,71,0.28)"  },
  title_challenger: { color: "#93c5fd", bg: "rgba(147,197,253,0.12)", border: "rgba(147,197,253,0.28)" },
  fight_of_night:   { color: "#c4b5fd", bg: "rgba(196,181,253,0.14)", border: "rgba(196,181,253,0.32)" },
  perf_of_night:    { color: "#fb923c", bg: "rgba(251,146,60,0.14)",   border: "rgba(251,146,60,0.32)"  },
  sub_of_night:     { color: "#22d3ee", bg: "rgba(34,211,238,0.12)",   border: "rgba(34,211,238,0.28)" },
  ko_of_night:      { color: "#f87171", bg: "rgba(248,113,113,0.14)", border: "rgba(248,113,113,0.30)" },
  bonus:            { color: "rgba(255,255,255,0.70)", bg: "rgba(255,255,255,0.07)", border: "rgba(255,255,255,0.16)" },
};

function classifyBonus(raw: string): Highlight {
  const s = raw.trim();
  if (/fight of the night/i.test(s)) return { kind: "fight_of_night", label: "FOTN", title: s };
  if (/performance of the night/i.test(s)) return { kind: "perf_of_night", label: "POTN", title: s };
  if (/submission of the night/i.test(s)) return { kind: "sub_of_night", label: "SUBN", title: s };
  if (/ko of the night|knockout of the night/i.test(s)) return { kind: "ko_of_night", label: "KOTN", title: s };
  const short = s.replace(/^UFC\s+[\w.]+\s+/i, "").trim();
  return { kind: "bonus", label: short.length > 22 ? `${short.slice(0, 20)}…` : short, title: s };
}

function getHighlights(titleBout?: string | null, titleStatus?: string | null, bonuses?: string[] | null): Highlight[] {
  const hl: Highlight[] = [];
  const tb = titleBout?.trim();
  if (tb) {
    hl.push({ kind: "title", label: "Title Bout", title: tb });
    const s = titleStatus?.toLowerCase();
    if (s === "champion") hl.push({ kind: "title_champion", label: "Champion", title: "Defending champion" });
    else if (s === "challenger") hl.push({ kind: "title_challenger", label: "Challenger", title: "Title challenger" });
  }
  for (const raw of bonuses ?? []) {
    if (!raw?.trim()) continue;
    hl.push(classifyBonus(raw));
  }
  return hl;
}

function FightHighlightBadges({ titleBout, titleStatus, bonuses }: {
  titleBout?: string | null; titleStatus?: string | null; bonuses?: string[] | null;
}) {
  const hl = getHighlights(titleBout, titleStatus, bonuses);
  if (hl.length === 0) return null;
  return (
    <div className="fd-highlight-badges">
      {hl.map((h, i) => {
        const s = HIGHLIGHT_STYLES[h.kind];
        return (
          <span
            key={i}
            title={h.title}
            className="fd-highlight-badge"
            style={{ color: s.color, background: s.bg, border: `1px solid ${s.border}` }}
          >
            {h.label}
          </span>
        );
      })}
    </div>
  );
}

// ── Fight stats utilities (inlined) ──────────────────────────────────────────

type FightOutcome = "W" | "L" | "D" | "NC";
type FinishBucket = "ko" | "sub" | "dec" | "dq" | "other";
type FinishBreakdown = Record<FinishBucket, number>;

const OUTCOME_STYLE: Record<FightOutcome, { label: string }> = {
  W:  { label: "W" },
  L:  { label: "L" },
  D:  { label: "D" },
  NC: { label: "–" },
};

const FINISH_COLORS: Record<FinishBucket, string> = {
  ko: "#E8001D", sub: "#fb923c", dec: "rgba(255,255,255,0.55)", dq: "#a78bfa", other: "rgba(255,255,255,0.22)",
};
const FINISH_LABELS: Record<FinishBucket, string> = {
  ko: "KO / TKO", sub: "Submission", dec: "Decision", dq: "Disqualification", other: "Other",
};
const FINISH_ORDER: FinishBucket[] = ["ko", "sub", "dec", "dq", "other"];

const SPORT_LABELS: Record<string, string> = {
  mma: "MMA", boxing: "Boxing", kickboxing: "Kickboxing",
  muay_thai: "Muay Thai", wrestling: "Wrestling", bjj: "BJJ",
  grappling: "Grappling", judo: "Judo", karate: "Karate", sambo: "Sambo",
};
function sportDisplayLabel(slug: string): string {
  return SPORT_LABELS[slug.toLowerCase()] ?? slug.charAt(0).toUpperCase() + slug.slice(1).replace(/_/g, " ");
}

function normalizeLevel(level: string | null | undefined): "pro" | "amateur" | "other" {
  if (!level) return "other";
  const l = level.toLowerCase();
  if (l === "pro" || l === "professional") return "pro";
  if (l === "amateur" || l === "am") return "amateur";
  return "other";
}
const LEVEL_DISPLAY: Record<string, string> = { pro: "Professional", amateur: "Amateur", other: "Other" };

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function parseFightOutcome(result: any): FightOutcome {
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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function buildBreakdown(fights: any[], outcome: "W" | "L"): FinishBreakdown {
  const out: FinishBreakdown = { ko: 0, sub: 0, dec: 0, dq: 0, other: 0 };
  for (const f of fights) {
    if (parseFightOutcome(f.result) !== outcome) continue;
    const resultStr = String(f.result ?? "").toLowerCase();
    const isDq = /\bdq\b|disqualif/.test(resultStr);
    out[isDq ? "dq" : bucketMethod(f.method)] += 1;
  }
  return out;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function buildFightsPerYear(fights: any[]): { year: number; count: number }[] {
  const counts = new Map<number, number>();
  for (const f of fights) {
    if (!f.event_date) continue;
    const year = Number(String(f.event_date).slice(0, 4));
    if (!year) continue;
    counts.set(year, (counts.get(year) ?? 0) + 1);
  }
  return Array.from(counts.entries()).map(([year, count]) => ({ year, count })).sort((a, b) => a.year - b.year);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function buildLastFought(fights: any[]): string | null {
  let latest: string | null = null;
  for (const f of fights) {
    if (!f.event_date) continue;
    if (!latest || f.event_date > latest) latest = f.event_date;
  }
  if (!latest) return null;
  const [y, m, d] = latest.split("-").map(Number);
  if (!y || !m) return null;
  const fought = new Date(y, m - 1, d || 1);
  const months = Math.max(0, Math.floor((Date.now() - fought.getTime()) / (30.44 * 24 * 60 * 60 * 1000)));
  if (months === 0) return "Last fought this month";
  if (months === 1) return "Last fought 1 month ago";
  if (months < 12) return `Last fought ${months} months ago`;
  const years = Math.floor(months / 12), rem = months % 12;
  if (rem === 0) return `Last fought ${years} year${years > 1 ? "s" : ""} ago`;
  return `Last fought ${years}y ${rem}mo ago`;
}

function buildCareerHighlights(fights: any[]): { titleFights: number; titlesWon: number; bonusCount: number } {
  let titleFights = 0, titlesWon = 0, bonusCount = 0;
  for (const f of fights) {
    if (f.title_bout?.trim()) {
      titleFights += 1;
      if (parseFightOutcome(f.result) === "W") titlesWon += 1;
    }
    for (const b of f.bonuses ?? []) {
      if (b?.trim()) bonusCount += 1;
    }
  }
  return { titleFights, titlesWon, bonusCount };
}

function HighlightTile({ value, label, accent, tint, delayMs = 0 }: {
  value: number; label: string; accent: string; tint: string; delayMs?: number;
}) {
  return (
    <div
      className="fd-highlight-tile fd-scale-in"
      style={{ animationDelay: `${delayMs}ms`, background: tint, border: `1px solid ${accent}33` }}
    >
      <p className="fd-highlight-tile-val" style={{ color: accent }}>{value}</p>
      <p className="fd-highlight-tile-lbl">{label}</p>
    </div>
  );
}

function CareerHighlightsStrip({ titleFights, titlesWon, bonusCount }: { titleFights: number; titlesWon: number; bonusCount: number }) {
  const tiles: Array<{ value: number; label: string; accent: string; tint: string }> = [];
  if (titleFights > 0) {
    tiles.push({ value: titleFights, label: `Title fight${titleFights === 1 ? "" : "s"}`, accent: "#fbbf24", tint: "rgba(251,191,36,0.08)" });
    tiles.push({ value: titlesWon, label: `Belt${titlesWon === 1 ? "" : "s"} won`, accent: "#fde68a", tint: "rgba(253,224,71,0.06)" });
  }
  if (bonusCount > 0) {
    tiles.push({ value: bonusCount, label: `Bonus${bonusCount === 1 ? "" : "es"}`, accent: "#c4b5fd", tint: "rgba(196,181,253,0.08)" });
  }
  if (tiles.length === 0) return null;
  return (
    <div>
      <p className="fd-eyebrow">Career highlights</p>
      <div className="flex flex-wrap gap-2">
        {tiles.map((t, i) => <HighlightTile key={t.label} {...t} delayMs={i * 70} />)}
      </div>
    </div>
  );
}

// ── FinishDonut (SVG donut chart) ─────────────────────────────────────────────

function FinishDonut({ breakdown, title, centerLabel }: {
  breakdown: FinishBreakdown; title: string; centerLabel: string;
}) {
  const total = breakdown.ko + breakdown.sub + breakdown.dec + breakdown.dq + breakdown.other;
  if (total === 0) return null;

  const size = 90, r = 32, innerR = 20, cx = 45, cy = 45;
  let angle = -Math.PI / 2;

  const arcs = FINISH_ORDER.filter(k => breakdown[k] > 0).map((key, arcIdx) => {
    const value = breakdown[key];
    const sweep = (value / total) * Math.PI * 2;
    const x1 = cx + r * Math.cos(angle);
    const y1 = cy + r * Math.sin(angle);
    angle += sweep;
    const x2 = cx + r * Math.cos(angle);
    const y2 = cy + r * Math.sin(angle);
    const large = sweep > Math.PI ? 1 : 0;
    return { key, d: `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2} Z`, arcIdx };
  });

  const legend = FINISH_ORDER.filter(k => k !== "other" || breakdown.other > 0).map(k => ({
    key: k, value: breakdown[k], pct: Math.round((breakdown[k] / total) * 100),
  }));

  return (
    <div>
      <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase" as const, color: "rgba(255,255,255,0.32)", marginBottom: 10 }}>
        {title}
      </p>
      <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden style={{ flexShrink: 0 }}>
          {arcs.map((a) => (
            <path key={a.key} className="fd-arc-in" style={{ animationDelay: `${a.arcIdx * 80}ms` }}
              d={a.d} fill={FINISH_COLORS[a.key]} stroke="rgba(10,10,15,0.9)" strokeWidth={1.5} />
          ))}
          <circle cx={cx} cy={cy} r={innerR} fill="rgba(18,18,22,0.96)" />
          <text x={cx} y={cy - 1} textAnchor="middle" fill="#fff" fontSize={14} fontFamily="'Bebas Neue', sans-serif">{total}</text>
          <text x={cx} y={cy + 9} textAnchor="middle" fill="rgba(255,255,255,0.32)" fontSize={7}>{centerLabel}</text>
        </svg>
        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 7 }}>
          {legend.map(item => (
            <div key={item.key} style={{ display: "flex", alignItems: "center", gap: 7 }}>
              <span style={{ width: 7, height: 7, borderRadius: 2, background: FINISH_COLORS[item.key], flexShrink: 0, opacity: item.value > 0 ? 1 : 0.3 }} />
              <span style={{ flex: 1, fontSize: 10.5, color: "rgba(255,255,255,0.50)" }}>{FINISH_LABELS[item.key]}</span>
              <span style={{ fontSize: 10.5, fontWeight: 700, color: item.value > 0 ? "#fff" : "rgba(255,255,255,0.25)" }}>{item.pct}%</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── ActivityBars (fights per year bar chart) ──────────────────────────────────

function ActivityBars({ years }: { years: { year: number; count: number }[] }) {
  if (years.length === 0) return null;
  const max = Math.max(...years.map(y => y.count), 1);
  const barH = 52;
  return (
    <div>
      <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase" as const, color: "rgba(255,255,255,0.32)", marginBottom: 10 }}>
        Activity by year
      </p>
      <div style={{ display: "flex", alignItems: "flex-end", gap: 5, height: barH + 22 }}>
        {years.map((y, yi) => {
          const h = Math.max(4, (y.count / max) * barH);
          return (
            <div key={y.year} style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", alignItems: "center", gap: 3 }}>
              <span style={{ fontSize: 9, fontWeight: 700, color: "rgba(255,255,255,0.45)" }}>{y.count}</span>
              <div className="fd-bar-grow" title={`${y.count} fight${y.count === 1 ? "" : "s"} in ${y.year}`}
                style={{ animationDelay: `${yi * 55}ms`, width: "100%", height: h, borderRadius: "3px 3px 0 0",
                  background: "linear-gradient(180deg, rgba(232,0,29,0.85) 0%, rgba(232,0,29,0.35) 100%)", minHeight: 4 }} />
              <span style={{ fontSize: 9, color: "rgba(255,255,255,0.28)" }}>{String(y.year).slice(2)}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── FightInsights panel ───────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function FightInsights({ fights, sportLabel, levelNote }: {
  fights: any[];
  sportLabel?: string | null;
  levelNote?: string | null;
}) {
  const form = useMemo(() => fights.slice(0, 8).map(f => parseFightOutcome(f.result)), [fights]);
  const winBreakdown  = useMemo(() => buildBreakdown(fights, "W"), [fights]);
  const lossBreakdown = useMemo(() => buildBreakdown(fights, "L"), [fights]);
  const years       = useMemo(() => buildFightsPerYear(fights), [fights]);
  const lastFought  = useMemo(() => buildLastFought(fights), [fights]);
  const careerHL    = useMemo(() => buildCareerHighlights(fights), [fights]);

  const total    = fights.length;
  const wins     = fights.filter(f => parseFightOutcome(f.result) === "W").length;
  const losses   = fights.filter(f => parseFightOutcome(f.result) === "L").length;
  const winRate  = total > 0 ? Math.round((wins / total) * 100) : 0;
  const winTotal  = winBreakdown.ko  + winBreakdown.sub  + winBreakdown.dec  + winBreakdown.dq  + winBreakdown.other;
  const lossTotal = lossBreakdown.ko + lossBreakdown.sub + lossBreakdown.dec + lossBreakdown.dq + lossBreakdown.other;
  const hasHighlights = careerHL.titleFights > 0 || careerHL.bonusCount > 0;
  const hasNote = !!(lastFought || sportLabel || levelNote);

  return (
    <div className="cmp-compare-card fd-insights-panel fd-up" style={delay(0)}>
      <div className="fd-insights-header">
        {hasNote ? (
          <p className="fd-insights-note">
            {lastFought}
            {lastFought && (sportLabel || levelNote) && <span className="text-white/30"> · </span>}
            {sportLabel && <span className="text-white/35">{sportLabel}</span>}
            {sportLabel && levelNote && <span className="text-white/30"> · </span>}
            {levelNote && <span className="text-white/35">{levelNote} only</span>}
          </p>
        ) : <span />}
        <span className="fd-insights-count">{total} fights</span>
      </div>

      {form.length > 0 && (
        <div className="fd-insights-section">
          <p className="fd-eyebrow">Recent form</p>
          <div className="flex gap-1.5">
            {form.map((o, i) => (
              <div
                key={i}
                className={cn(
                  "fd-form-square fd-scale-in",
                  o === "W" ? "fd-form-square--w" : o === "L" ? "fd-form-square--l" : o === "D" ? "fd-form-square--d" : "fd-form-square--nc",
                )}
                style={delay(i * 40)}
              >
                {OUTCOME_STYLE[o].label}
              </div>
            ))}
          </div>
          <p className="fd-insights-form-hint">Most recent ← left</p>
        </div>
      )}

      {hasHighlights && (
        <div className="fd-insights-section">
          <CareerHighlightsStrip {...careerHL} />
        </div>
      )}

      <div className="fd-insights-section">
        <p className="fd-eyebrow">Win rate</p>
        <div className="flex items-baseline gap-2">
          <span className={cn("fd-insights-winrate-val", winRate >= 50 ? "fd-insights-winrate-val--good" : "fd-insights-winrate-val--bad")}>
            {winRate}%
          </span>
          <span className="fd-insights-winrate-sub">{wins}W · {losses}L</span>
        </div>
      </div>

      {(winTotal > 0 || lossTotal > 0) && (
        <div className="fd-insights-donut-grid">
          {winTotal > 0  && <FinishDonut breakdown={winBreakdown}  title="How wins ended"   centerLabel="wins"   />}
          {lossTotal > 0 && <FinishDonut breakdown={lossBreakdown} title="How losses ended" centerLabel="losses" />}
        </div>
      )}

      {years.length > 0 && <ActivityBars years={years} />}
      <div className="h-7" aria-hidden />
    </div>
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function FightRow({ fight, isLast }: { fight: any; isLast: boolean }) {
  const [expanded, setExpanded] = useState(false);
  const meta = resultMeta(fight.result);
  const method = methodLabel(fight.method);
  const roundStr = fight.round_ended
    ? `Round ${fight.round_ended}${fight.time_ended ? ` · ${fight.time_ended}` : ""}`
    : null;
  const scheduledStr = fight.scheduled_rounds ? `Scheduled for ${fight.scheduled_rounds} rounds` : null;
  const titleStr = fight.title_bout
    ? [fight.title_bout, fight.title_status].filter(Boolean).join(" — ")
    : null;
  const bonusStr = fight.bonuses?.length ? (fight.bonuses as string[]).join(", ") : null;
  const hasDetails =
    fight.event_name || fight.weight_class || roundStr || scheduledStr ||
    fight.organization || fight.level || fight.billing || fight.opponent_record ||
    titleStr || bonusStr;

  return (
    <div className={cn("fd-fight-row", isLast && "border-b-0")}>
      <div className={cn("fd-fight-result", `fd-fight-result--${meta.tone}`)}>
        {meta.label}
      </div>

      <div className="fd-fight-body">
        <div className="fd-fight-main">
          <button
            type="button"
            className={cn("fd-fight-toggle", expanded && "fd-fight-toggle--expanded")}
            onClick={() => hasDetails && setExpanded(v => !v)}
            disabled={!hasDetails}
          >
            <div className="fd-fight-content">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="fd-fight-opponent">vs. {opponentDisplayName(fight)}</p>
                  <div className="fd-fight-meta">
                    {method && <span className={`fd-fight-method--${meta.tone}`}>{method}</span>}
                    {fight.organization && <span className="fd-fight-org">{fight.organization}</span>}
                    {fight.event_date && <span className="fd-fight-date">{formatDate(fight.event_date)}</span>}
                  </div>
                  <FightHighlightBadges titleBout={fight.title_bout} titleStatus={fight.title_status} bonuses={fight.bonuses} />
                </div>
                {hasDetails && (
                  <ChevronDown size={14} className={cn("fd-fight-expand", expanded && "fd-fight-expand--open")} />
                )}
              </div>
            </div>
          </button>
          {fight.link && (
            <a href={fight.link} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()}
              aria-label="View fight record" className="fd-fight-link">
              <ExternalLink size={13} />
            </a>
          )}
        </div>

        {expanded && hasDetails && (
          <div className="fd-fight-expand-panel fd-detail-grid">
            {fight.event_name    && <DetailCell label="Event"           value={fight.event_name} />}
            {fight.sport         && <DetailCell label="Sport"           value={sportDisplayLabel(fight.sport)} />}
            {fight.billing       && <DetailCell label="Billing"         value={fight.billing} />}
            {fight.weight_class  && <DetailCell label="Weight class"    value={fight.weight_class} />}
            {roundStr            && <DetailCell label="Ended"           value={roundStr} />}
            {scheduledStr        && <DetailCell label="Distance"        value={scheduledStr} />}
            {titleStr            && <DetailCell label="Title bout"      value={titleStr} />}
            {bonusStr            && <DetailCell label="Bonuses"         value={bonusStr} />}
            {fight.opponent_record && <DetailCell label="Opponent record" value={fight.opponent_record} />}
            {fight.level         && <DetailCell label="Level"           value={LEVEL_DISPLAY[normalizeLevel(fight.level)] ?? fight.level} />}
          </div>
        )}
      </div>
    </div>
  );
}

function DetailCell({ label, value }: { label: string; value: string }) {
  return (
    <div className="fd-detail-cell">
      <p className="fd-detail-cell-label">{label}</p>
      <p className="fd-detail-cell-value">{value}</p>
    </div>
  );
}

// ── About tab ─────────────────────────────────────────────────────────────────

function AboutTab({ fighter }: { fighter: Fighter }) {
  const { data: snapshots = [] } = useQuery({
    queryKey: ["fighter-social-history", fighter.id],
    queryFn: async () => {
      const { data } = await supabase.from("fighter_social_snapshots").select("follower_count, recorded_at").eq("fighter_id", fighter.id).order("recorded_at", { ascending: true });
      return data ?? [];
    },
  });

  const { data: passports = [] } = useQuery({
    queryKey: ["fighter-passports", fighter.id],
    queryFn: async () => {
      const { data } = await supabase.from("passports").select("passport_country, verification_status, expiry_date").eq("fighter_id", fighter.id).eq("verification_status", "verified").gt("expiry_date", new Date().toISOString().split("T")[0]);
      return data ?? [];
    },
  });

  const statTiles = [
    fighter.height_cm  && { label: "Height", value: `${fighter.height_cm} cm`  },
    fighter.reach_cm   && { label: "Reach",  value: `${fighter.reach_cm} cm`   },
    fighter.stance     && { label: "Stance", value: fighter.stance              },
    fighter.dob        && { label: "Age",    value: String(Math.floor((Date.now() - new Date(fighter.dob).getTime()) / (365.25 * 24 * 60 * 60 * 1000))) },
  ].filter(Boolean) as { label: string; value: string }[];

  const igSnapshots = snapshots.map(s => ({ followerCount: s.follower_count, recordedAt: s.recorded_at }));
  const latestFollowers = snapshots.length > 0 ? snapshots[snapshots.length - 1].follower_count : null;

  return (
    <div className="fd-dossier">
      <div className="cmp-physical-insight">
        <span className="cmp-physical-insight-dot" aria-hidden />
        <p className="cmp-physical-insight-text">{aboutPhysicalInsight(fighter, latestFollowers)}</p>
      </div>

      {statTiles.length > 0 && (
        <div className="fd-metrics-grid fd-up" style={delay(0)}>
          {statTiles.map(t => (
            <div key={t.label} className="fd-metric-tile">
              <p className="fd-metric-tile-label">{t.label}</p>
              <p className="fd-metric-tile-value">{t.value}</p>
            </div>
          ))}
        </div>
      )}

      {igSnapshots.length >= 2 && (
        <div className="fd-up" style={delay(60)}>
          <InstagramGrowthChart snapshots={igSnapshots} />
        </div>
      )}

      {igSnapshots.length === 1 && latestFollowers != null && fighter.instagram && (
        <div className="cmp-compare-card fd-up" style={delay(60)}>
          <a href={`https://instagram.com/${fighter.instagram.replace("@", "")}`} target="_blank" rel="noopener noreferrer" className="fd-ig-link">
            <Instagram size={18} className="fd-ig-link-icon" />
            <div>
              <p className="fd-ig-link-handle">@{fighter.instagram.replace("@", "")}</p>
              <p className="fd-ig-link-followers">{latestFollowers.toLocaleString()} followers</p>
            </div>
            <ExternalLink size={13} className="fd-ig-link-ext" />
          </a>
        </div>
      )}

      {igSnapshots.length === 0 && fighter.instagram && (
        <div className="cmp-compare-card fd-up" style={delay(60)}>
          <a href={`https://instagram.com/${fighter.instagram.replace("@", "")}`} target="_blank" rel="noopener noreferrer" className="fd-ig-link">
            <Instagram size={18} className="fd-ig-link-icon" />
            <p className="fd-ig-link-handle">@{fighter.instagram.replace("@", "")}</p>
            <ExternalLink size={13} className="fd-ig-link-ext" />
          </a>
        </div>
      )}

      {passports.length > 0 && (
        <div className="cmp-compare-card fd-up" style={delay(120)}>
          <p className="fd-eyebrow px-4 pt-3.5">Verified passport / travel eligibility</p>
          <div className="fd-passport-list">
            {passports.map(p => (
              <span key={p.passport_country} className="fd-passport-tag">
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-[var(--available)]">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                {p.passport_country}
              </span>
            ))}
          </div>
        </div>
      )}

      {fighter.team_name && (
        <div className="cmp-compare-card fd-up fd-team-block" style={delay(160)}>
          <p className="fd-eyebrow">Team</p>
          <p className="fd-team-name">{fighter.team_name}</p>
        </div>
      )}
    </div>
  );
}

// ── Instagram growth chart (ported from combatlink) ───────────────────────────

type IgSnapshot = { followerCount: number; recordedAt: string };

function InstagramGrowthChart({ snapshots }: { snapshots: IgSnapshot[] }) {
  const [expanded, setExpanded] = useState(false);

  const pts = useMemo(() => {
    if (snapshots.length < 2) return null;
    const sorted = [...snapshots].sort((a, b) => new Date(a.recordedAt).getTime() - new Date(b.recordedAt).getTime());
    const min = Math.min(...sorted.map(s => s.followerCount));
    const max = Math.max(...sorted.map(s => s.followerCount));
    const span = Math.max(max - min, Math.max(max * 0.01, 1));
    const mid = (max + min) / 2;
    const vMin = mid - span / 2, vMax = mid + span / 2, range = vMax - vMin;
    const W = 320, H = 80, P = 6;
    const coords = sorted.map((s, i) => ({
      x: P + (i / (sorted.length - 1)) * (W - P * 2),
      y: H - P - ((s.followerCount - vMin) / range) * (H - P * 2),
      count: s.followerCount,
      label: new Date(s.recordedAt).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
    }));
    let line = `M${coords[0].x},${coords[0].y}`;
    for (let i = 1; i < coords.length; i++) {
      const p = coords[i - 1], c = coords[i], cpx = (p.x + c.x) / 2;
      line += ` C${cpx},${p.y} ${cpx},${c.y} ${c.x},${c.y}`;
    }
    const area = `${line} L${coords[coords.length - 1].x},${H} L${coords[0].x},${H} Z`;
    const first = sorted[0].followerCount, last = sorted[sorted.length - 1].followerCount;
    const delta = last - first;
    const pct = first > 0 ? ((delta / first) * 100) : 0;
    const deltaPct = Math.abs(pct) < 1 ? `${pct >= 0 ? "+" : ""}${pct.toFixed(1)}%` : `${pct >= 0 ? "+" : ""}${Math.round(pct)}%`;
    const days = Math.max(1, Math.round((new Date(sorted[sorted.length - 1].recordedAt).getTime() - new Date(sorted[0].recordedAt).getTime()) / 86_400_000));
    return { coords, line, area, W, H, last, delta, deltaPct, days };
  }, [snapshots]);

  if (!pts) return null;

  const lastPt = pts.coords[pts.coords.length - 1];

  return (
    <div className="cmp-visibility-growth">
      <button type="button" onClick={() => setExpanded(v => !v)} className="block w-full border-0 bg-transparent p-0 text-left cursor-pointer">
        <div className="cmp-visibility-growth-head">
          <span className="cmp-visibility-growth-eyebrow">Instagram growth</span>
          <span className="cmp-visibility-growth-hint">From tracked snapshots</span>
        </div>
        <div className="flex items-baseline justify-between gap-2">
          <span className="cmp-visibility-growth-val">{pts.last.toLocaleString()}</span>
          <span className={cn(
            "cmp-visibility-growth-delta",
            pts.delta >= 0 ? "cmp-visibility-growth-delta--up" : "cmp-visibility-growth-delta--down",
          )}>
            {pts.delta >= 0 ? "+" : ""}{pts.delta.toLocaleString()} ({pts.deltaPct})
          </span>
          <ChevronDown size={15} className={cn("shrink-0 text-white/26 transition-transform", expanded && "rotate-180")} />
        </div>
        <p className="cmp-visibility-growth-meta mt-1">
          Over {pts.days} days · {snapshots.length} snapshots
        </p>
      </button>

      {expanded && (
        <>
          <svg
            className="cmp-visibility-growth-chart mt-3"
            width="100%"
            height={pts.H}
            viewBox={`0 0 ${pts.W} ${pts.H}`}
            preserveAspectRatio="xMidYMid meet"
            aria-hidden
          >
            <defs>
              <linearGradient id="fd-ig-grad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#E8001D" stopOpacity="0.22" />
                <stop offset="100%" stopColor="#E8001D" stopOpacity="0" />
              </linearGradient>
            </defs>
            <path d={pts.area} fill="url(#fd-ig-grad)" />
            <path d={pts.line} fill="none" stroke="#E8001D" strokeWidth="2" strokeLinecap="round" opacity={0.85} />
            <circle cx={lastPt.x} cy={lastPt.y} r="4" fill="#E8001D" />
          </svg>
          <div className="cmp-visibility-growth-range">
            <span>{pts.coords[0].label} · {pts.coords[0].count.toLocaleString()}</span>
            <span>{lastPt.label} · {lastPt.count.toLocaleString()}</span>
          </div>
        </>
      )}
    </div>
  );
}

// ── Shared helpers ────────────────────────────────────────────────────────────

function TabLoader() {
  return (
    <div className="fd-loader">
      <div className="fd-loader-spinner" />
    </div>
  );
}

function TabEmpty({ label }: { label: string }) {
  return <div className="fd-empty">{label}</div>;
}
