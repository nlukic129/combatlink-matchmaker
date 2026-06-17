import { useRef, useState, useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Bell, Calendar, ChevronDown, Clock, DollarSign, ExternalLink,
  Globe, Heart, Instagram, Lock, MapPin, Play, Shield,
  ShieldCheck, Trophy, User, Video, Zap,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/auth-context";
import { cn, formatCurrency } from "@/lib/utils";
import type { Fighter } from "@/types/database";

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
  win:  { bg: "rgba(74,222,128,0.12)",  border: "rgba(74,222,128,0.30)",  color: "#4ade80",              label: "W"  },
  loss: { bg: "rgba(248,113,113,0.12)", border: "rgba(248,113,113,0.30)", color: "#f87171",              label: "L"  },
  draw: { bg: "rgba(255,255,255,0.07)", border: "rgba(255,255,255,0.16)", color: "rgba(255,255,255,0.55)", label: "D"  },
  nc:   { bg: "rgba(255,255,255,0.04)", border: "rgba(255,255,255,0.10)", color: "rgba(255,255,255,0.30)", label: "NC" },
} as const;

const STATUS_COLOR: Record<string, string> = {
  available:   "#4ade80",
  in_camp:     "#fb923c",
  unavailable: "rgba(255,255,255,0.28)",
};
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

function glass(extra?: React.CSSProperties): React.CSSProperties {
  return {
    background: "rgba(255,255,255,0.02)",
    border: "1px solid rgba(255,255,255,0.07)",
    borderRadius: 14,
    overflow: "hidden",
    ...extra,
  };
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

  const { data: isFavourite } = useQuery({
    queryKey: ["favourite", fighter.id],
    enabled: !!matchmaker,
    queryFn: async () => {
      const { data } = await supabase
        .from("matchmaker_favourites").select("id").eq("fighter_id", fighter.id).maybeSingle();
      return !!data;
    },
  });

  const { data: favourite } = useQuery({
    queryKey: ["favourite-detail", fighter.id],
    enabled: !!matchmaker && isFavourite === true,
    queryFn: async () => {
      const { data } = await supabase
        .from("matchmaker_favourites").select("id, note, notify").eq("fighter_id", fighter.id).maybeSingle();
      return data;
    },
  });

  const toggleFavourite = useMutation({
    mutationFn: async () => {
      if (isFavourite) {
        await supabase.from("matchmaker_favourites").delete().eq("fighter_id", fighter.id);
      } else {
        await supabase.from("matchmaker_favourites").insert({ matchmaker_id: matchmaker!.id, fighter_id: fighter.id });
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["favourite", fighter.id] });
      qc.invalidateQueries({ queryKey: ["favourite-detail", fighter.id] });
      qc.invalidateQueries({ queryKey: ["favourites"] });
    },
  });

  const toggleNotify = useMutation({
    mutationFn: async () => {
      if (!favourite) return;
      await supabase.from("matchmaker_favourites").update({ notify: !favourite.notify }).eq("id", favourite.id);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["favourite-detail", fighter.id] }),
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
        favourite={favourite ?? null}
        onToggleFav={() => toggleFavourite.mutate()}
        onToggleNotify={() => toggleNotify.mutate()}
      />

      {/* Tab bar */}
      <div className="fd-tabs">
        {TABS.map(({ id, label, Icon }) => (
          <button
            key={id}
            onClick={() => switchTab(id)}
            className={cn("fd-tab", tab === id && "fd-tab--active")}
          >
            <Icon size={13} />
            {label}
          </button>
        ))}
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

function HeroSection({ fighter, record, isFavourite, favourite, onToggleFav, onToggleNotify }: {
  fighter: Fighter;
  record: { w: number; l: number; d: number } | null;
  isFavourite?: boolean;
  favourite: { notify: boolean } | null;
  onToggleFav: () => void;
  onToggleNotify: () => void;
}) {
  const status = fighter.availability_status ?? "unavailable";
  const dotColor = STATUS_COLOR[status] ?? "rgba(255,255,255,0.28)";
  const fullName = [fighter.first_name, fighter.last_name].filter(Boolean).join(" ");
  const initials = [fighter.first_name?.[0], fighter.last_name?.[0]].filter(Boolean).join("").toUpperCase();
  const photoBorder = status === "available" ? "rgba(74,222,128,0.35)" : status === "in_camp" ? "rgba(251,146,60,0.35)" : "rgba(255,255,255,0.08)";

  const hasPills = fighter.purse_usd != null || fighter.open_to_short_notice ||
    fighter.preparation_weeks != null || !!fighter.promotional_status;

  return (
    <div className="fd-up" style={{ padding: "14px 20px 12px", borderBottom: "1px solid rgba(255,255,255,0.06)", ...delay(0) }}>
      <div style={{ display: "flex", gap: 14, alignItems: "center" }}>
        {/* Portrait photo — compact */}
        <div style={{ flexShrink: 0, width: 72, height: 90, borderRadius: 10, overflow: "hidden", background: "oklch(0.10 0.012 270)", border: `1.5px solid ${photoBorder}` }}>
          {fighter.photo_url ? (
            <img src={fighter.photo_url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "center top", display: "block" }} />
          ) : (
            <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: "linear-gradient(165deg, oklch(0.16 0.016 278) 0%, oklch(0.11 0.013 268) 100%)" }}>
              <span style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 24, color: "rgba(255,255,255,0.18)" }}>{initials || "?"}</span>
            </div>
          )}
        </div>

        {/* All meta — compact column */}
        <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 4 }}>

          {/* Row 1: Name + record + actions */}
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <h2 style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 26, fontWeight: 400, letterSpacing: "0.03em", lineHeight: 1, color: "#fff", flexShrink: 0 }}>
              {fullName}
            </h2>
            {record && (
              <span style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 15, letterSpacing: "0.04em", color: "rgba(255,255,255,0.55)", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.09)", borderRadius: 5, padding: "2px 8px", flexShrink: 0 }}>
                {record.w}–{record.l}–{record.d}
              </span>
            )}
            <div style={{ marginLeft: "auto", display: "flex", gap: 4, flexShrink: 0 }}>
              {isFavourite && (
                <ActionBtn onClick={onToggleNotify} title={favourite?.notify ? "Stop notifications" : "Notify when available"} active={!!favourite?.notify}>
                  <Bell size={14} />
                </ActionBtn>
              )}
              <ActionBtn onClick={onToggleFav} title={isFavourite ? "Remove from favourites" : "Add to favourites"} active={!!isFavourite} activeColor="#E8001D">
                <Heart size={14} fill={isFavourite ? "currentColor" : "none"} strokeWidth={1.5} />
              </ActionBtn>
            </div>
          </div>

          {/* Row 2: status · country · team · verified · nickname */}
          <div style={{ display: "flex", flexWrap: "wrap", gap: "3px 10px", alignItems: "center" }}>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 11, fontWeight: 600 }}>
              <span style={{ width: 6, height: 6, borderRadius: "50%", background: dotColor, boxShadow: status === "available" ? `0 0 7px ${dotColor}` : "none", flexShrink: 0 }} />
              <span style={{ color: dotColor }}>{STATUS_LABEL[status] ?? "Unknown"}</span>
            </span>
            {fighter.country && (
              <span style={{ fontSize: 11, color: "rgba(255,255,255,0.36)", display: "inline-flex", alignItems: "center", gap: 3 }}>
                <MapPin size={10} />{fighter.country}
              </span>
            )}
            {fighter.team_name && (
              <span style={{ fontSize: 11, color: "rgba(255,255,255,0.36)", display: "inline-flex", alignItems: "center", gap: 3 }}>
                <Shield size={10} />{fighter.team_name}
              </span>
            )}
            {fighter.nickname && (
              <span style={{ fontSize: 11, fontStyle: "italic", color: "rgba(255,255,255,0.30)" }}>
                &ldquo;{fighter.nickname}&rdquo;
              </span>
            )}
            {fighter.identity_verified && (
              <span style={{ display: "inline-flex", alignItems: "center", gap: 3, background: "rgba(74,222,128,0.10)", border: "1px solid rgba(74,222,128,0.25)", borderRadius: 4, padding: "1px 6px", fontSize: 9.5, fontWeight: 700, color: "#4ade80", letterSpacing: "0.04em" }}>
                <ShieldCheck size={9} />Identity Verified
              </span>
            )}
          </div>

          {/* Row 3: quick pills */}
          {hasPills && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginTop: 2 }}>
              {fighter.purse_usd != null && <QuickPill icon={<DollarSign size={10} />} label={formatCurrency(fighter.purse_usd)} />}
              {fighter.preparation_weeks != null && <QuickPill icon={<Clock size={10} />} label={`${fighter.preparation_weeks}w prep`} />}
              {fighter.open_to_short_notice && <QuickPill icon={<Zap size={10} />} label="Short notice OK" variant="green" />}
              {fighter.promotional_status === "open" && <QuickPill icon={<Globe size={10} />} label="Free agent" />}
              {fighter.promotional_status === "exclusive" && <QuickPill icon={<Lock size={10} />} label="Exclusive" variant="amber" />}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function ActionBtn({ onClick, title, active, activeColor = "#4ade80", children }: {
  onClick: () => void; title: string; active: boolean; activeColor?: string; children: React.ReactNode;
}) {
  return (
    <button onClick={onClick} title={title} style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 32, height: 32, borderRadius: 8, border: "none", background: "rgba(255,255,255,0.05)", cursor: "pointer", color: active ? activeColor : "rgba(255,255,255,0.32)", transition: "color 0.12s" }}>
      {children}
    </button>
  );
}

function QuickPill({ icon, label, variant }: { icon: React.ReactNode; label: string; variant?: "green" | "amber" }) {
  const color    = variant === "green" ? "#4ade80" : variant === "amber" ? "#fb923c" : "rgba(255,255,255,0.48)";
  const bg       = variant === "green" ? "rgba(74,222,128,0.08)" : variant === "amber" ? "rgba(251,146,60,0.08)" : "rgba(255,255,255,0.04)";
  const border   = variant === "green" ? "rgba(74,222,128,0.20)" : variant === "amber" ? "rgba(251,146,60,0.20)" : "rgba(255,255,255,0.08)";
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 10, fontWeight: 600, color, background: bg, border: `1px solid ${border}`, borderRadius: 6, padding: "3px 8px" }}>
      {icon}{label}
    </span>
  );
}

// ── Booking tab ───────────────────────────────────────────────────────────────

function BookingTab({ fighter }: { fighter: Fighter }) {
  const prepLabel = fighter.preparation_weeks != null
    ? fighter.preparation_weeks === 0 ? "Always ready" : `${fighter.preparation_weeks} weeks`
    : null;

  const availValue = fighter.available_from
    ? formatDate(fighter.available_from)
    : fighter.availability_status === "available" ? "Now" : "—";

  return (
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
  );
}

function BookingCard({ icon, label, value, detail, highlight, delayMs }: {
  icon: React.ReactNode; label: string; value: string; detail?: string; highlight?: boolean; delayMs: number;
}) {
  const accentColor = highlight ? "#4ade80" : "rgba(255,255,255,0.60)";
  return (
    <div className="fd-up" style={{ ...glass({ padding: "14px 14px" }), ...delay(delayMs) }}>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
        <div style={{ width: 34, height: 34, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(255,255,255,0.05)", color: highlight ? "#4ade80" : "rgba(255,255,255,0.40)", flexShrink: 0 }}>
          {icon}
        </div>
        <div style={{ minWidth: 0 }}>
          <p style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase" as const, color: "rgba(255,255,255,0.28)", marginBottom: 4 }}>{label}</p>
          <p style={{ fontSize: 14, fontWeight: 600, color: accentColor, lineHeight: 1.3 }}>{value}</p>
          {detail && <p style={{ marginTop: 4, fontSize: 11, color: "rgba(255,255,255,0.35)" }}>{detail}</p>}
        </div>
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
    <>
      {featured && <SportCardFeatured sport={featured} delayMs={0} />}

      {featured && rest.length > 0 && (
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ flex: 1, height: 1, background: "rgba(255,255,255,0.07)" }} />
          <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase" as const, color: "rgba(255,255,255,0.28)", whiteSpace: "nowrap" }}>
            Also competes in
          </span>
          <div style={{ flex: 1, height: 1, background: "rgba(255,255,255,0.07)" }} />
        </div>
      )}

      {rest.length > 0 && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          {rest.map((s, i) => (
            <SportCardMini key={s.id} sport={s} delayMs={(featured ? 1 : i) * 60 + 60} />
          ))}
        </div>
      )}
    </>
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function RecordBlocks({ levels, size = "normal" }: { levels: { key: string; label: string; w: number; l: number; d: number }[]; size?: "normal" | "hero" }) {
  const numSize = size === "hero" ? 36 : 28;
  const blockPad = size === "hero" ? "12px 6px" : "9px 6px";
  return (
    <>
      {levels.map(lvl => (
        <div key={lvl.key}>
          {levels.length > 1 && (
            <p style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase" as const, color: "rgba(255,255,255,0.28)", marginBottom: 7 }}>{lvl.label}</p>
          )}
          <div style={{ display: "flex", gap: 6 }}>
            <div style={{ flex: 1, padding: blockPad, borderRadius: 10, textAlign: "center" as const, background: "rgba(74,222,128,0.08)", border: "1px solid rgba(74,222,128,0.18)" }}>
              <p style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: numSize, lineHeight: 1, color: "#4ade80" }}>{lvl.w}</p>
              <p style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.12em", color: "rgba(74,222,128,0.55)", marginTop: 4 }}>W</p>
            </div>
            <div style={{ flex: 1, padding: blockPad, borderRadius: 10, textAlign: "center" as const, background: "rgba(248,113,113,0.08)", border: "1px solid rgba(248,113,113,0.18)" }}>
              <p style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: numSize, lineHeight: 1, color: "#f87171" }}>{lvl.l}</p>
              <p style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.12em", color: "rgba(248,113,113,0.55)", marginTop: 4 }}>L</p>
            </div>
            {lvl.d > 0 && (
              <div style={{ flex: 1, padding: blockPad, borderRadius: 10, textAlign: "center" as const, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.10)" }}>
                <p style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: numSize, lineHeight: 1, color: "rgba(255,255,255,0.50)" }}>{lvl.d}</p>
                <p style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.12em", color: "rgba(255,255,255,0.28)", marginTop: 4 }}>D</p>
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
    <div className="fd-up" style={{ borderRadius: 16, overflow: "hidden", border: "1px solid rgba(232,0,29,0.28)", boxShadow: "0 0 28px rgba(232,0,29,0.08)", ...delay(delayMs) }}>
      {/* Hero header with gradient */}
      <div style={{ background: "linear-gradient(135deg, rgba(232,0,29,0.14) 0%, rgba(232,0,29,0.04) 60%, rgba(255,255,255,0.02) 100%)", padding: "18px 20px 16px", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
          <div>
            <p style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 32, letterSpacing: "0.04em", color: "#fff", lineHeight: 1 }}>{name}</p>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 6 }}>
              {sport.level && (
                <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.10em", textTransform: "uppercase" as const, color: "rgba(255,255,255,0.45)" }}>
                  {sport.level === "pro" ? "Professional" : "Amateur"}
                </span>
              )}
            </div>
          </div>
          {sport.is_active ? (
            <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 10, fontWeight: 700, color: "#4ade80", background: "rgba(74,222,128,0.10)", border: "1px solid rgba(74,222,128,0.22)", borderRadius: 999, padding: "4px 11px", flexShrink: 0 }}>
              <span style={{ width: 5, height: 5, borderRadius: "50%", background: "#4ade80", boxShadow: "0 0 7px #4ade80", flexShrink: 0 }} />
              Open to compete
            </span>
          ) : (
            <span style={{ fontSize: 10, fontWeight: 700, color: "rgba(255,255,255,0.28)", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 999, padding: "4px 11px", flexShrink: 0 }}>Historical</span>
          )}
        </div>
      </div>

      {/* Body */}
      <div style={{ padding: "16px 20px 18px", background: "rgba(255,255,255,0.015)", display: "flex", flexDirection: "column", gap: 14 }}>
        <RecordBlocks levels={levels} size="hero" />

        {weightClasses.length > 0 && (
          <div>
            <p style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase" as const, color: "rgba(255,255,255,0.28)", marginBottom: 8 }}>Weight classes</p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
              {weightClasses.map((wc: any) => (
                <span key={wc.id} style={{ fontSize: 11, fontWeight: 500, color: "rgba(255,255,255,0.65)", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.10)", borderRadius: 7, padding: "4px 10px" }}>
                  {wc.name}<span style={{ color: "rgba(255,255,255,0.25)", margin: "0 5px" }}>·</span><span style={{ color: "rgba(255,255,255,0.38)" }}>{wc.limit_kg} kg</span>
                </span>
              ))}
            </div>
          </div>
        )}

        {fightStyles.length > 0 && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
            {fightStyles.map((fs: any) => (
              <span key={fs.id} style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.09em", textTransform: "uppercase" as const, color: "rgba(255,255,255,0.50)", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.09)", borderRadius: 5, padding: "4px 9px" }}>
                {fs.label}
              </span>
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
    <div className="fd-up" style={{ ...glass({ padding: 0 }), ...delay(delayMs), overflow: "hidden", opacity: 0.6 }}>
      <div style={{ padding: "12px 14px 14px", display: "flex", flexDirection: "column", gap: 10 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 17, letterSpacing: "0.04em", color: "rgba(255,255,255,0.75)", lineHeight: 1 }}>{name}</span>
          {sport.level && (
            <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.10em", textTransform: "uppercase" as const, color: "rgba(255,255,255,0.30)", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 4, padding: "2px 6px" }}>
              {sport.level}
            </span>
          )}
        </div>
        <RecordBlocks levels={levels} size="normal" />
      </div>
    </div>
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function SportCard({ sport, delayMs, dimmed }: { sport: any; delayMs: number; dimmed?: boolean }) {
  if (dimmed) return <SportCardMini sport={sport} delayMs={delayMs} />;
  return <SportCardFeatured sport={sport} delayMs={delayMs} />;
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
    <div className="fd-fights-layout">
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
          <div className="fd-fight-list fd-up" style={delay(60)}>
            {filtered.length === 0 ? (
              <div style={{ padding: "24px 16px", textAlign: "center", fontSize: 13, color: "rgba(255,255,255,0.28)" }}>
                No fights match current filters
              </div>
            ) : (
              filtered.map((f: any, i: number) => (
                <FightRow key={f.id} fight={f} isLast={i === filtered.length - 1} />
              ))
            )}
            <div style={{ height: 28 }} aria-hidden />
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
    <button
      type="button"
      onClick={onClick}
      style={{
        flexShrink: 0,
        borderRadius: 999,
        padding: "5px 12px",
        fontSize: 11,
        fontWeight: 700,
        letterSpacing: "0.03em",
        border: active ? "1px solid rgba(232,0,29,0.45)" : "1px solid rgba(255,255,255,0.10)",
        background: active ? "rgba(232,0,29,0.12)" : "rgba(255,255,255,0.04)",
        color: active ? "#E8001D" : "rgba(255,255,255,0.50)",
        cursor: "pointer",
        transition: "color 0.12s, background 0.12s, border-color 0.12s",
      }}
    >
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
    <div style={{ marginTop: 6, display: "flex", flexWrap: "wrap", gap: 4 }}>
      {hl.map((h, i) => {
        const s = HIGHLIGHT_STYLES[h.kind];
        return (
          <span key={i} title={h.title} style={{
            display: "inline-flex", alignItems: "center",
            padding: "2px 6px", borderRadius: 4,
            fontSize: 9, fontWeight: 700, letterSpacing: "0.06em",
            textTransform: "uppercase" as const,
            color: s.color, background: s.bg, border: `1px solid ${s.border}`, lineHeight: 1.3,
          }}>{h.label}</span>
        );
      })}
    </div>
  );
}

// ── Fight stats utilities (inlined) ──────────────────────────────────────────

type FightOutcome = "W" | "L" | "D" | "NC";
type FinishBucket = "ko" | "sub" | "dec" | "dq" | "other";
type FinishBreakdown = Record<FinishBucket, number>;

const OUTCOME_STYLE: Record<FightOutcome, { bg: string; border: string; color: string; label: string }> = {
  W:  { bg: "rgba(74,222,128,0.14)",  border: "rgba(74,222,128,0.35)",  color: "#4ade80",               label: "W" },
  L:  { bg: "rgba(248,113,113,0.14)", border: "rgba(248,113,113,0.35)", color: "#f87171",               label: "L" },
  D:  { bg: "rgba(255,255,255,0.08)", border: "rgba(255,255,255,0.18)", color: "rgba(255,255,255,0.55)", label: "D" },
  NC: { bg: "rgba(255,255,255,0.04)", border: "rgba(255,255,255,0.10)", color: "rgba(255,255,255,0.35)", label: "–" },
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
    <div className="fd-scale-in" style={{
      animationDelay: `${delayMs}ms`,
      flex: 1, minWidth: 80, padding: "10px 12px", borderRadius: 10,
      textAlign: "center" as const, background: tint, border: `1px solid ${accent}33`,
    }}>
      <p style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 22, letterSpacing: "0.03em", lineHeight: 1, color: accent }}>{value}</p>
      <p style={{ marginTop: 5, fontSize: 9, fontWeight: 700, letterSpacing: "0.10em", textTransform: "uppercase" as const, color: "rgba(255,255,255,0.48)" }}>{label}</p>
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
      <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase" as const, color: "rgba(255,255,255,0.32)", marginBottom: 10 }}>Career highlights</p>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
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
    <div className="fd-up" style={{ ...glass({ padding: "16px 18px" }), ...delay(0) }}>
      {/* Header: last fought · sport · level + total count */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8, marginBottom: 16 }}>
        {hasNote ? (
          <p style={{ fontSize: 11, fontWeight: 600, color: "rgba(255,255,255,0.60)", lineHeight: 1.4 }}>
            {lastFought}
            {lastFought && (sportLabel || levelNote) && <span style={{ color: "rgba(255,255,255,0.30)" }}> · </span>}
            {sportLabel && <span style={{ color: "rgba(255,255,255,0.35)" }}>{sportLabel}</span>}
            {sportLabel && levelNote && <span style={{ color: "rgba(255,255,255,0.30)" }}> · </span>}
            {levelNote && <span style={{ color: "rgba(255,255,255,0.35)" }}>{levelNote} only</span>}
          </p>
        ) : <span />}
        <span style={{ fontSize: 10, color: "rgba(255,255,255,0.30)", flexShrink: 0 }}>{total} fights</span>
      </div>

      {/* Recent form squares */}
      {form.length > 0 && (
        <div style={{ marginBottom: 18 }}>
          <p className="fd-eyebrow">Recent form</p>
          <div style={{ display: "flex", gap: 6 }}>
            {form.map((o, i) => {
              const s = OUTCOME_STYLE[o];
              return (
                <div key={i} className="fd-scale-in" style={{
                  animationDelay: `${i * 40}ms`, flex: 1, minWidth: 0, aspectRatio: "1", maxWidth: 36,
                  borderRadius: 7, display: "flex", alignItems: "center", justifyContent: "center",
                  background: s.bg, border: `1px solid ${s.border}`,
                  fontFamily: "'Bebas Neue', sans-serif", fontSize: 16, color: s.color,
                }}>{s.label}</div>
              );
            })}
          </div>
          <p style={{ marginTop: 5, fontSize: 10, color: "rgba(255,255,255,0.25)" }}>Most recent ← left</p>
        </div>
      )}

      {/* Career highlights: title fights, belts, bonuses */}
      {hasHighlights && (
        <div style={{ marginBottom: 18 }}>
          <CareerHighlightsStrip {...careerHL} />
        </div>
      )}

      {/* Win rate */}
      <div style={{ marginBottom: 18 }}>
        <p className="fd-eyebrow">Win rate</p>
        <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
          <span style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 36, lineHeight: 1, color: winRate >= 50 ? "#4ade80" : "#f87171" }}>{winRate}%</span>
          <span style={{ fontSize: 11, color: "rgba(255,255,255,0.32)" }}>{wins}W · {losses}L</span>
        </div>
      </div>

      {/* Donut charts */}
      {(winTotal > 0 || lossTotal > 0) && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px 20px", marginBottom: 18 }}>
          {winTotal > 0  && <FinishDonut breakdown={winBreakdown}  title="How wins ended"   centerLabel="wins"   />}
          {lossTotal > 0 && <FinishDonut breakdown={lossBreakdown} title="How losses ended" centerLabel="losses" />}
        </div>
      )}

      {/* Activity bars */}
      {years.length > 0 && <ActivityBars years={years} />}
      <div style={{ height: 28 }} aria-hidden />
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
    <div className="fd-fight-row" style={isLast ? { borderBottom: "none" } : {}}>
      {/* Colored result column */}
      <div style={{ width: 52, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", background: meta.bg, borderRight: `1px solid ${meta.border}` }}>
        <span style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 22, letterSpacing: "0.04em", color: meta.color }}>
          {meta.label}
        </span>
      </div>

      {/* Content */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "stretch" }}>
          <button
            type="button"
            onClick={() => hasDetails && setExpanded(v => !v)}
            disabled={!hasDetails}
            style={{ flex: 1, minWidth: 0, display: "flex", background: expanded ? "rgba(255,255,255,0.03)" : "transparent", border: "none", padding: 0, margin: 0, textAlign: "left" as const, cursor: hasDetails ? "pointer" : "default" }}
          >
            <div style={{ flex: 1, minWidth: 0, padding: "12px 14px" }}>
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8 }}>
                <div style={{ minWidth: 0 }}>
                  <p style={{ fontSize: 14, fontWeight: 600, color: "#fff", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" as const }}>
                    vs. {fight.name ?? "Unknown"}
                  </p>
                  <div style={{ marginTop: 4, display: "flex", flexWrap: "wrap", gap: "3px 10px" }}>
                    {method && <span style={{ fontSize: 11, fontWeight: 600, color: meta.color }}>{method}</span>}
                    {fight.organization && <span style={{ fontSize: 11, color: "rgba(255,255,255,0.38)" }}>{fight.organization}</span>}
                    {fight.event_date && <span style={{ fontSize: 11, color: "rgba(255,255,255,0.26)" }}>{formatDate(fight.event_date)}</span>}
                  </div>
                  <FightHighlightBadges titleBout={fight.title_bout} titleStatus={fight.title_status} bonuses={fight.bonuses} />
                </div>
                {hasDetails && (
                  <ChevronDown size={14} style={{ flexShrink: 0, marginTop: 3, color: "rgba(255,255,255,0.28)", transform: expanded ? "rotate(180deg)" : "none", transition: "transform 200ms ease" }} />
                )}
              </div>
            </div>
          </button>
          {fight.link && (
            <a href={fight.link} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()}
              aria-label="View fight record"
              style={{ display: "flex", alignItems: "center", padding: "0 12px", color: "rgba(255,255,255,0.32)", flexShrink: 0, textDecoration: "none" }}>
              <ExternalLink size={13} />
            </a>
          )}
        </div>

        {/* Expanded detail grid */}
        {expanded && hasDetails && (
          <div style={{ padding: "4px 14px 16px", display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(130px, 1fr))", gap: "12px 16px", background: "rgba(255,255,255,0.02)", borderTop: "1px solid rgba(255,255,255,0.05)" }}>
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
    <div>
      <p style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: "0.10em", textTransform: "uppercase" as const, color: "rgba(255,255,255,0.26)", marginBottom: 3 }}>{label}</p>
      <p style={{ fontSize: 13, fontWeight: 600, color: "#fff" }}>{value}</p>
    </div>
  );
}

// ── Videos tab ────────────────────────────────────────────────────────────────

function VideosTab({ fighterId, matchmakerId }: { fighterId: string; matchmakerId: string | undefined }) {
  const qc = useQueryClient();

  const { data: videos = [], isLoading } = useQuery({
    queryKey: ["fighter-videos", fighterId],
    queryFn: async () => {
      const { data } = await supabase.from("videos").select("*").eq("user_id", fighterId).order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  const { data: accessRequests = [] } = useQuery({
    queryKey: ["video-access", fighterId, matchmakerId],
    enabled: !!matchmakerId,
    queryFn: async () => {
      const { data } = await supabase.from("video_access_requests").select("id, status").eq("fighter_id", fighterId).eq("matchmaker_id", matchmakerId!);
      return data ?? [];
    },
  });

  const requestAccess = useMutation({
    mutationFn: async () => {
      await supabase.from("video_access_requests").insert({ fighter_id: fighterId, matchmaker_id: matchmakerId!, status: "pending" });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["video-access", fighterId, matchmakerId] }),
  });

  if (isLoading) return <TabLoader />;

  const publicVideos  = videos.filter(v => v.visibility === "public");
  const privateVideos = videos.filter(v => v.visibility !== "public");
  const accessStatus  = accessRequests[0]?.status;

  if (!videos.length) return <TabEmpty label="No videos uploaded" />;

  return (
    <>
      {publicVideos.length > 0 && (
        <div className="fd-up fd-fight-list" style={delay(0)}>
          {publicVideos.map((v, i) => <VideoRow key={v.id} video={v} isLast={i === publicVideos.length - 1 && !privateVideos.length} />)}
        </div>
      )}

      {privateVideos.length > 0 && (
        <div className="fd-up" style={{ ...glass({ padding: "14px 16px" }), ...delay(40) }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{ width: 34, height: 34, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(255,255,255,0.04)" }}>
                <Lock size={14} style={{ color: "rgba(255,255,255,0.40)" }} />
              </div>
              <div>
                <p style={{ fontSize: 13, fontWeight: 600, color: "#fff" }}>{privateVideos.length} private video{privateVideos.length > 1 ? "s" : ""}</p>
                <p style={{ marginTop: 2, fontSize: 11, color: "rgba(255,255,255,0.35)" }}>Requires fighter approval</p>
              </div>
            </div>
            {!accessStatus && (
              <button onClick={() => requestAccess.mutate()} style={{ fontSize: 11, fontWeight: 700, color: "#fff", border: "1px solid rgba(255,255,255,0.14)", borderRadius: 8, padding: "8px 14px", background: "transparent", cursor: "pointer" }}>
                Request access
              </button>
            )}
            {accessStatus === "pending"  && <span style={{ fontSize: 11, fontWeight: 700, color: "#fbbf24" }}>Pending approval</span>}
            {accessStatus === "rejected" && <span style={{ fontSize: 11, fontWeight: 700, color: "#f87171"  }}>Access denied</span>}
          </div>
          {accessStatus === "approved" && (
            <div style={{ marginTop: 12, borderTop: "1px solid rgba(255,255,255,0.06)", paddingTop: 12 }}>
              {privateVideos.map((v, i) => <VideoRow key={v.id} video={v} isLast={i === privateVideos.length - 1} />)}
            </div>
          )}
        </div>
      )}
    </>
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function VideoRow({ video, isLast }: { video: any; isLast: boolean }) {
  const isYT = video.url?.includes("youtube") || video.url?.includes("youtu.be");
  const isVimeo = video.url?.includes("vimeo");
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 16px", borderBottom: isLast ? "none" : "1px solid rgba(255,255,255,0.05)" }}>
      <div style={{ width: 34, height: 34, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(255,255,255,0.04)", flexShrink: 0 }}>
        <Play size={14} style={{ color: "#E8001D" }} />
      </div>
      <span style={{ flex: 1, minWidth: 0, fontSize: 13, fontWeight: 600, color: "#fff", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" as const }}>
        {video.title ?? (isYT ? "YouTube" : isVimeo ? "Vimeo" : "Video")}
      </span>
      {video.url && (
        <a href={video.url} target="_blank" rel="noopener noreferrer" style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 11, fontWeight: 700, color: "rgba(255,255,255,0.55)", border: "1px solid rgba(255,255,255,0.10)", borderRadius: 6, padding: "5px 10px", flexShrink: 0 }}>
          <ExternalLink size={11} />Watch
        </a>
      )}
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
    <>
      {/* Physical stat tiles */}
      {statTiles.length > 0 && (
        <div className="fd-stat-grid fd-up" style={delay(0)}>
          {statTiles.map(t => (
            <div key={t.label} className="fd-stat-tile">
              <p style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase" as const, color: "rgba(255,255,255,0.28)", marginBottom: 6 }}>{t.label}</p>
              <p style={{ fontSize: 14, fontWeight: 600, color: "#fff" }}>{t.value}</p>
            </div>
          ))}
        </div>
      )}

      {/* Instagram growth chart */}
      {igSnapshots.length >= 2 && (
        <div className="fd-up" style={delay(60)}>
          <InstagramGrowthChart snapshots={igSnapshots} />
        </div>
      )}

      {/* Instagram follower count (when only 1 snapshot) */}
      {igSnapshots.length === 1 && latestFollowers != null && fighter.instagram && (
        <div className="fd-up" style={{ ...glass({ padding: "14px 16px" }), ...delay(60) }}>
          <a href={`https://instagram.com/${fighter.instagram.replace("@", "")}`} target="_blank" rel="noopener noreferrer" style={{ display: "flex", alignItems: "center", gap: 12, textDecoration: "none" }}>
            <Instagram size={18} style={{ color: "#E8001D", flexShrink: 0 }} />
            <div>
              <p style={{ fontSize: 15, fontWeight: 600, color: "#fff" }}>@{fighter.instagram.replace("@", "")}</p>
              <p style={{ marginTop: 2, fontSize: 11, color: "rgba(255,255,255,0.36)" }}>{latestFollowers.toLocaleString()} followers</p>
            </div>
            <ExternalLink size={13} style={{ marginLeft: "auto", color: "rgba(255,255,255,0.28)" }} />
          </a>
        </div>
      )}

      {/* Instagram link (no snapshot at all) */}
      {igSnapshots.length === 0 && fighter.instagram && (
        <div className="fd-up" style={{ ...glass({ padding: "14px 16px" }), ...delay(60) }}>
          <a href={`https://instagram.com/${fighter.instagram.replace("@", "")}`} target="_blank" rel="noopener noreferrer" style={{ display: "flex", alignItems: "center", gap: 12, textDecoration: "none" }}>
            <Instagram size={18} style={{ color: "#E8001D", flexShrink: 0 }} />
            <p style={{ fontSize: 14, fontWeight: 600, color: "#fff" }}>@{fighter.instagram.replace("@", "")}</p>
            <ExternalLink size={13} style={{ marginLeft: "auto", color: "rgba(255,255,255,0.28)" }} />
          </a>
        </div>
      )}

      {/* Verified passports */}
      {passports.length > 0 && (
        <div className="fd-up" style={{ ...glass({ padding: "14px 16px" }), ...delay(120) }}>
          <p className="fd-eyebrow">Verified passport / travel eligibility</p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {passports.map(p => (
              <span key={p.passport_country} style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 12, border: "1px solid rgba(74,222,128,0.25)", borderRadius: 6, padding: "4px 10px", color: "rgba(255,255,255,0.82)" }}>
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#4ade80" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                {p.passport_country}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Team */}
      {fighter.team_name && (
        <div className="fd-up" style={{ ...glass({ padding: "14px 16px" }), ...delay(160) }}>
          <p className="fd-eyebrow">Team</p>
          <p style={{ fontSize: 14, fontWeight: 600, color: "#fff" }}>{fighter.team_name}</p>
        </div>
      )}
    </>
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
  const deltaColor = pts.delta >= 0 ? "#4ade80" : "#f87171";

  return (
    <div style={{ ...glass({ padding: "14px 16px" }) }}>
      <button type="button" onClick={() => setExpanded(v => !v)} style={{ display: "block", width: "100%", padding: 0, border: "none", background: "transparent", cursor: "pointer", textAlign: "left" as const }}>
        <div style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p className="fd-eyebrow" style={{ marginBottom: 10 }}>Instagram growth</p>
            <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 8 }}>
              <span style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 26, lineHeight: 1, color: "#fff" }}>{pts.last.toLocaleString()}</span>
              <span style={{ fontSize: 12, fontWeight: 600, color: deltaColor }}>
                {pts.delta >= 0 ? "+" : ""}{pts.delta.toLocaleString()} ({pts.deltaPct})
              </span>
            </div>
            <p style={{ marginTop: 4, fontSize: 10, color: "rgba(255,255,255,0.26)" }}>Over {pts.days} days · {snapshots.length} snapshots</p>
          </div>
          <ChevronDown size={15} style={{ flexShrink: 0, marginTop: 2, color: "rgba(255,255,255,0.26)", transform: expanded ? "rotate(180deg)" : "none", transition: "transform 160ms ease" }} />
        </div>
      </button>

      {expanded && (
        <div>
          <svg width="100%" height={pts.H} viewBox={`0 0 ${pts.W} ${pts.H}`} preserveAspectRatio="xMidYMid meet" style={{ display: "block", marginTop: 12 }} aria-hidden>
            <defs>
              <linearGradient id="fd-ig-grad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%"   stopColor="#E8001D" stopOpacity="0.22" />
                <stop offset="100%" stopColor="#E8001D" stopOpacity="0"    />
              </linearGradient>
            </defs>
            <path d={pts.area} fill="url(#fd-ig-grad)" />
            <path d={pts.line} fill="none" stroke="#E8001D" strokeWidth="2" strokeLinecap="round" opacity={0.85} />
            <circle cx={lastPt.x} cy={lastPt.y} r="4" fill="#E8001D" />
          </svg>
          <div style={{ marginTop: 6, display: "flex", justifyContent: "space-between", fontSize: 9, color: "rgba(255,255,255,0.26)" }}>
            <span>{pts.coords[0].label} · {pts.coords[0].count.toLocaleString()}</span>
            <span>{lastPt.label} · {lastPt.count.toLocaleString()}</span>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Shared helpers ────────────────────────────────────────────────────────────

function TabLoader() {
  return (
    <div style={{ display: "flex", height: 120, alignItems: "center", justifyContent: "center" }}>
      <div style={{ width: 20, height: 20, borderRadius: "50%", border: "2px solid rgba(255,255,255,0.10)", borderTopColor: "#E8001D", animation: "spin 0.7s linear infinite" }} />
    </div>
  );
}

function TabEmpty({ label }: { label: string }) {
  return (
    <div style={{ ...glass({ padding: "32px 20px" }), textAlign: "center" as const, fontSize: 13, color: "rgba(255,255,255,0.28)" }}>
      {label}
    </div>
  );
}
