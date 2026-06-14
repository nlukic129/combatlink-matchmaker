import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Shield, MapPin, Instagram, Calendar,
  Zap, Trophy, Video, User, Heart, Bell
} from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { formatCurrency, cn } from "@/lib/utils";
import { AvailabilityBadge } from "@/components/ui/availability-badge";
import { Avatar } from "@/components/ui/avatar";
import { useAuth } from "@/contexts/auth-context";
import type { Fighter } from "@/types/database";

type Tab = "booking" | "sports" | "fights" | "videos" | "about";

const TABS: { id: Tab; label: string; icon: React.ReactNode }[] = [
  { id: "booking", label: "Booking", icon: <Calendar className="h-3.5 w-3.5" /> },
  { id: "sports", label: "Sports", icon: <Trophy className="h-3.5 w-3.5" /> },
  { id: "fights", label: "Fights", icon: <Zap className="h-3.5 w-3.5" /> },
  { id: "videos", label: "Videos", icon: <Video className="h-3.5 w-3.5" /> },
  { id: "about", label: "About", icon: <User className="h-3.5 w-3.5" /> },
];

type Props = { fighter: Fighter };

export function FighterDrawerContent({ fighter }: Props) {
  const [tab, setTab] = useState<Tab>("booking");
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

  const { data: favourite } = useQuery({
    queryKey: ["favourite-detail", fighter.id],
    enabled: !!matchmaker && isFavourite === true,
    queryFn: async () => {
      const { data } = await supabase
        .from("matchmaker_favourites")
        .select("id, note, notify")
        .eq("fighter_id", fighter.id)
        .maybeSingle();
      return data;
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
      qc.invalidateQueries({ queryKey: ["favourite-detail", fighter.id] });
      qc.invalidateQueries({ queryKey: ["favourites"] });
    },
  });

  const toggleNotify = useMutation({
    mutationFn: async () => {
      if (!favourite) return;
      await supabase
        .from("matchmaker_favourites")
        .update({ notify: !favourite.notify })
        .eq("id", favourite.id);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["favourite-detail", fighter.id] }),
  });

  const fullName = [fighter.first_name, fighter.last_name].filter(Boolean).join(" ");

  return (
    <div className="flex flex-col">
      {/* Hero */}
      <div className="flex gap-5 border-b border-border px-6 py-6">
        <Avatar
          src={fighter.photo_url}
          alt={fullName}
          fallback={fighter.first_name?.[0] ?? "?"}
          size="xl"
          ring
        />

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div>
              <h2 className="text-xl font-semibold tracking-tight text-foreground">{fullName}</h2>
              {fighter.nickname && (
                <p className="text-sm text-muted-foreground">&ldquo;{fighter.nickname}&rdquo;</p>
              )}
            </div>
            <div className="flex shrink-0 items-center gap-1">
              {/* Notify bell (only when favourited) */}
              {isFavourite && (
                <button
                  onClick={() => toggleNotify.mutate()}
                  className={cn(
                    "flex h-8 w-8 items-center justify-center rounded-md transition-colors",
                    favourite?.notify ? "text-primary" : "text-muted-foreground hover:text-foreground"
                  )}
                  title={favourite?.notify ? "Stop notifications" : "Notify when available"}
                >
                  <Bell className="h-4 w-4" />
                </button>
              )}
              {/* Favourite */}
              <button
                onClick={() => toggleFavourite.mutate()}
                className={cn(
                  "flex h-8 w-8 items-center justify-center rounded-md transition-colors",
                  isFavourite ? "text-primary" : "text-muted-foreground hover:text-primary"
                )}
                title={isFavourite ? "Remove from favourites" : "Add to favourites"}
              >
                <Heart className={cn("h-4 w-4", isFavourite && "fill-current")} />
              </button>
            </div>
          </div>

          <div className="mt-2 flex flex-wrap items-center gap-2">
            <AvailabilityBadge status={fighter.availability_status} />
            {fighter.country && (
              <span className="text-xs text-muted-foreground flex items-center gap-1">
                <Shield className="h-3 w-3" />
                {fighter.country}
              </span>
            )}
            {fighter.current_city && (
              <span className="text-xs text-muted-foreground flex items-center gap-1">
                <MapPin className="h-3 w-3" />
                {[fighter.current_city, fighter.current_city_country].filter(Boolean).join(", ")}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-border px-4">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={cn(
              "flex items-center gap-1.5 rounded-t-lg px-4 py-3 text-xs font-medium transition-all duration-150",
              tab === t.id
                ? "border-b-2 border-primary bg-primary/5 text-foreground"
                : "border-b-2 border-transparent text-muted-foreground hover:bg-accent/50 hover:text-foreground"
            )}
          >
            {t.icon}
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="p-6">
        {tab === "booking" && <BookingTab fighter={fighter} />}
        {tab === "sports" && <SportsTab fighterId={fighter.id} />}
        {tab === "fights" && <FightsTab fighterId={fighter.id} />}
        {tab === "videos" && <VideosTab fighterId={fighter.id} matchmakerId={matchmaker?.id} />}
        {tab === "about" && <AboutTab fighter={fighter} />}
      </div>
    </div>
  );
}

// ── Booking tab ───────────────────────────────────────────────────────────────

function BookingTab({ fighter }: { fighter: Fighter }) {
  const rows: { label: string; value: React.ReactNode }[] = [
    {
      label: "Fight purse",
      value: fighter.purse_usd != null ? (
        <span>
          {formatCurrency(fighter.purse_usd)}
          {fighter.purse_negotiable && (
            <span className="ml-1.5 text-xs text-muted-foreground">(negotiable)</span>
          )}
        </span>
      ) : "—",
    },
    {
      label: "Available from",
      value: fighter.available_from
        ? new Date(fighter.available_from).toLocaleDateString("en-GB", {
            day: "numeric", month: "short", year: "numeric",
          })
        : fighter.availability_status === "available" ? "Now" : "—",
    },
    {
      label: "Preparation time",
      value: fighter.preparation_weeks ? `${fighter.preparation_weeks} weeks` : "—",
    },
    {
      label: "Short notice",
      value: fighter.open_to_short_notice ? (
        <span className="flex items-center gap-1 text-available">
          <Zap className="h-3.5 w-3.5" /> Available
        </span>
      ) : "No",
    },
    {
      label: "Promotional status",
      value: fighter.promotional_status === "exclusive" ? (
        <span className="text-amber-400">Exclusive</span>
      ) : fighter.promotional_status === "open" ? "Free agent" : "—",
    },
    {
      label: "Promoter",
      value: fighter.promoter_name ?? "—",
    },
  ];

  return (
    <div className="space-y-0">
      {rows.map(({ label, value }) => (
        <BookingRow key={label} label={label} value={value} />
      ))}
    </div>
  );
}

function BookingRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between border-b border-border py-3 last:border-0">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-sm font-medium text-foreground">{value}</span>
    </div>
  );
}

// ── Sports tab ────────────────────────────────────────────────────────────────

function SportsTab({ fighterId }: { fighterId: string }) {
  const { data: sports = [], isLoading } = useQuery({
    queryKey: ["fighter-sports", fighterId],
    queryFn: async () => {
      const { data } = await supabase
        .from("fighter_sports")
        .select(`
          id, sport, level, pro_w, pro_l, pro_d, amateur_w, amateur_l, amateur_d,
          is_active,
          fighter_sport_weight_classes (
            weight_classes ( id, name, limit_kg, gender )
          ),
          fighter_sport_fight_styles (
            fight_styles ( id, name, slug )
          )
        `)
        .eq("user_id", fighterId)
        .order("sport");
      return data ?? [];
    },
  });

  if (isLoading) return <TabLoader />;
  if (sports.length === 0) return <TabEmpty label="No sports on record" />;

  return (
    <div className="space-y-6">
      {sports.map((s) => (
        <SportCard key={s.id} sport={s} />
      ))}
    </div>
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function SportCard({ sport }: { sport: any }) {
  const label = sport.sport.charAt(0).toUpperCase() + sport.sport.slice(1);

  const proTotal = sport.pro_w + sport.pro_l + sport.pro_d;
  const amateurTotal = sport.amateur_w + sport.amateur_l + sport.amateur_d;

  const weightClasses = (sport.fighter_sport_weight_classes ?? [])
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .map((fswc: any) => fswc.weight_classes)
    .filter(Boolean);

  const fightStyles = (sport.fighter_sport_fight_styles ?? [])
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .map((fsfs: any) => fsfs.fight_styles)
    .filter(Boolean);

  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="mb-3 flex items-center gap-2">
        <span className="font-semibold text-foreground">{label}</span>
        <span className="rounded-full bg-primary/15 px-2 py-0.5 text-xs font-medium text-primary">
          {sport.level}
        </span>
        {sport.is_active === false && (
          <span className="text-xs text-muted-foreground">(historical)</span>
        )}
      </div>

      {/* Record */}
      {proTotal > 0 && (
        <div className="mb-2 flex items-center gap-3">
          <span className="text-xs text-muted-foreground w-14">Pro</span>
          <RecordBadge w={sport.pro_w} l={sport.pro_l} d={sport.pro_d} />
        </div>
      )}
      {amateurTotal > 0 && (
        <div className="mb-2 flex items-center gap-3">
          <span className="text-xs text-muted-foreground w-14">Amateur</span>
          <RecordBadge w={sport.amateur_w} l={sport.amateur_l} d={sport.amateur_d} />
        </div>
      )}

      {/* Weight classes */}
      {weightClasses.length > 0 && (
        <div className="mt-3">
          <p className="mb-1.5 text-xs text-muted-foreground">Weight classes</p>
          <div className="flex flex-wrap gap-1">
            {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
            {weightClasses.map((wc: any) => (
              <span
                key={wc.id}
                className="rounded-full border border-border bg-surface px-2.5 py-0.5 text-xs text-foreground"
              >
                {wc.name} · {wc.limit_kg} kg
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Fight styles */}
      {fightStyles.length > 0 && (
        <div className="mt-3">
          <p className="mb-1.5 text-xs text-muted-foreground">Fight styles</p>
          <div className="flex flex-wrap gap-1">
            {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
            {fightStyles.map((fs: any) => (
              <span
                key={fs.id}
                className="rounded-full bg-accent px-2.5 py-0.5 text-xs text-foreground"
              >
                {fs.name}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function RecordBadge({ w, l, d }: { w: number; l: number; d: number }) {
  return (
    <div className="flex items-center gap-2 font-display text-lg tracking-wide">
      <span className="text-available">{w}W</span>
      <span className="text-muted-foreground text-sm">·</span>
      <span className="text-red-400">{l}L</span>
      {d > 0 && (
        <>
          <span className="text-muted-foreground text-sm">·</span>
          <span className="text-muted-foreground">{d}D</span>
        </>
      )}
    </div>
  );
}

// ── Fights tab ────────────────────────────────────────────────────────────────

const RESULT_STYLE: Record<string, { color: string; label: string }> = {
  win:  { color: "text-available",       label: "W" },
  loss: { color: "text-red-400",         label: "L" },
  draw: { color: "text-muted-foreground",label: "D" },
  nc:   { color: "text-muted-foreground",label: "NC" },
};

function FightsTab({ fighterId }: { fighterId: string }) {
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

  if (isLoading) return <TabLoader />;
  if (fights.length === 0) return <TabEmpty label="No fight history" />;

  return (
    <div className="space-y-2">
      {fights.map((fight) => {
        const res = RESULT_STYLE[fight.result ?? ""] ?? RESULT_STYLE.nc;
        return (
          <div
            key={fight.id}
            className="flex items-center gap-3 rounded-lg border border-border bg-card px-4 py-3"
          >
            <span className={cn("w-7 shrink-0 text-center font-display text-lg font-bold", res.color)}>
              {res.label}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-foreground">
                vs. {fight.opponent_name ?? "Unknown"}
              </p>
              <p className="text-xs text-muted-foreground">
                {[fight.method, fight.event_name, fight.event_date].filter(Boolean).join(" · ")}
              </p>
            </div>
            {fight.weight_class && (
              <span className="shrink-0 text-xs text-muted-foreground">{fight.weight_class}</span>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── Videos tab ────────────────────────────────────────────────────────────────

function VideosTab({
  fighterId,
  matchmakerId,
}: {
  fighterId: string;
  matchmakerId: string | undefined;
}) {
  const { data: videos = [], isLoading } = useQuery({
    queryKey: ["fighter-videos", fighterId],
    queryFn: async () => {
      const { data } = await supabase
        .from("videos")
        .select("*")
        .eq("user_id", fighterId)
        .order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  const { data: accessRequests = [] } = useQuery({
    queryKey: ["video-access", fighterId, matchmakerId],
    enabled: !!matchmakerId,
    queryFn: async () => {
      const { data } = await supabase
        .from("video_access_requests")
        .select("id, status")
        .eq("fighter_id", fighterId)
        .eq("matchmaker_id", matchmakerId!);
      return data ?? [];
    },
  });

  const qc = useQueryClient();

  const requestAccess = useMutation({
    mutationFn: async () => {
      await supabase.from("video_access_requests").insert({
        fighter_id: fighterId,
        matchmaker_id: matchmakerId!,
        status: "pending",
      });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["video-access", fighterId, matchmakerId] }),
  });

  if (isLoading) return <TabLoader />;

  const publicVideos = videos.filter((v) => v.visibility === "public");
  const privateVideos = videos.filter((v) => v.visibility !== "public");
  const accessStatus = accessRequests[0]?.status;

  return (
    <div className="space-y-4">
      {publicVideos.length === 0 && privateVideos.length === 0 && (
        <TabEmpty label="No videos uploaded" />
      )}

      {publicVideos.map((v) => (
        <VideoCard key={v.id} video={v} />
      ))}

      {privateVideos.length > 0 && (
        <div className="rounded-lg border border-border bg-card p-4">
          <p className="mb-2 text-sm font-medium text-foreground">
            {privateVideos.length} private {privateVideos.length === 1 ? "video" : "videos"}
          </p>
          {!accessStatus && (
            <button
              onClick={() => requestAccess.mutate()}
              className="rounded-lg bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
            >
              Request access
            </button>
          )}
          {accessStatus === "pending" && (
            <span className="text-xs text-muted-foreground">Access requested — waiting for approval</span>
          )}
          {accessStatus === "approved" && (
            <div className="space-y-2 mt-2">
              {privateVideos.map((v) => (
                <VideoCard key={v.id} video={v} />
              ))}
            </div>
          )}
          {accessStatus === "rejected" && (
            <span className="text-xs text-destructive">Access denied</span>
          )}
        </div>
      )}
    </div>
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function VideoCard({ video }: { video: any }) {
  const isYoutube = video.url?.includes("youtube") || video.url?.includes("youtu.be");
  const isVimeo = video.url?.includes("vimeo");

  return (
    <a
      href={video.url}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center gap-3 rounded-lg border border-border bg-card px-4 py-3 hover:bg-accent transition-colors"
    >
      <Video className="h-4 w-4 shrink-0 text-muted-foreground" />
      <span className="flex-1 truncate text-sm text-foreground">
        {video.title ?? (isYoutube ? "YouTube video" : isVimeo ? "Vimeo video" : "Video")}
      </span>
      <span className="shrink-0 text-xs text-muted-foreground">
        {new Date(video.created_at).toLocaleDateString("en-GB", { month: "short", year: "numeric" })}
      </span>
    </a>
  );
}

// ── About tab ─────────────────────────────────────────────────────────────────

function AboutTab({ fighter }: { fighter: Fighter }) {
  const { data: latestSnap } = useQuery({
    queryKey: ["fighter-social", fighter.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("fighter_social_snapshots")
        .select("follower_count, recorded_at")
        .eq("fighter_id", fighter.id)
        .order("recorded_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      return data;
    },
  });

  const { data: passports = [] } = useQuery({
    queryKey: ["fighter-passports", fighter.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("passports")
        .select("passport_country, verification_status, expiry_date")
        .eq("fighter_id", fighter.id)
        .eq("verification_status", "verified")
        .gt("expiry_date", new Date().toISOString().split("T")[0]);
      return data ?? [];
    },
  });

  const rows: { label: string; value: React.ReactNode }[] = [
    { label: "Height", value: fighter.height_cm ? `${fighter.height_cm} cm` : "—" },
    { label: "Reach", value: fighter.reach_cm ? `${fighter.reach_cm} cm` : "—" },
    { label: "Stance", value: fighter.stance ?? "—" },
    { label: "Date of birth", value: fighter.dob ?? "—" },
    { label: "Team", value: fighter.team_name ?? "—" },
    {
      label: "Instagram",
      value: fighter.instagram ? (
        <a
          href={`https://instagram.com/${fighter.instagram}`}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1.5 text-primary hover:underline"
        >
          <Instagram className="h-3.5 w-3.5" />
          @{fighter.instagram}
        </a>
      ) : "—",
    },
    {
      label: "Instagram followers",
      value: latestSnap
        ? latestSnap.follower_count.toLocaleString()
        : "—",
    },
    {
      label: "Valid passports",
      value: passports.length > 0
        ? passports.map((p) => p.passport_country).join(", ")
        : "—",
    },
  ];

  return (
    <div className="space-y-0">
      {rows.map(({ label, value }) => (
        <div key={label} className="flex items-center justify-between border-b border-border py-3 last:border-0">
          <span className="text-sm text-muted-foreground">{label}</span>
          <span className="text-sm font-medium text-foreground">{value}</span>
        </div>
      ))}
    </div>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function TabLoader() {
  return (
    <div className="flex h-32 items-center justify-center">
      <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
    </div>
  );
}

function TabEmpty({ label }: { label: string }) {
  return (
    <div className="flex h-32 items-center justify-center">
      <p className="text-sm text-muted-foreground">{label}</p>
    </div>
  );
}
