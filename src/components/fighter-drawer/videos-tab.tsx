import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ExternalLink, Lock, Play, Video } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import {
  getVideoPlayback,
  getVideoThumbnailUrl,
  providerLabel,
  type VideoPlayback,
  type VideoProvider,
} from "@/lib/video-link";
import type { Video as VideoRecord } from "@/types/database";

type VideoRow = Pick<
  VideoRecord,
  "id" | "title" | "visibility" | "source" | "storage_path" | "external_url" | "thumbnail_path"
>;

type AccessStatus = "pending" | "approved" | "rejected" | null;

function delay(ms: number) {
  return { animationDelay: `${ms}ms` };
}

function videosInsight(publicCount: number, privateCount: number): string {
  if (publicCount > 0 && privateCount > 0) {
    return `${publicCount} public video${publicCount === 1 ? "" : "s"} · ${privateCount} private — request access to unlock locked footage.`;
  }
  if (publicCount > 0) {
    return `${publicCount} public video${publicCount === 1 ? "" : "s"} ready to scout inline.`;
  }
  return `${privateCount} private video${privateCount === 1 ? "" : "s"} on file — request access to view.`;
}

async function signedStorageUrl(path: string): Promise<string | null> {
  const { data, error } = await supabase.storage.from("fighter-videos").createSignedUrl(path, 3600);
  if (error || !data) return null;
  return data.signedUrl;
}

function TabLoader() {
  return (
    <div className="fd-tab-loader">
      <div className="fd-tab-loader-bar" />
    </div>
  );
}

function TabEmpty({ label }: { label: string }) {
  return (
    <div className="fd-tab-empty">
      <Video size={20} />
      <p>{label}</p>
    </div>
  );
}

function VideoPlayer({ playback, signedUrl, title }: { playback: VideoPlayback; signedUrl?: string | null; title: string }) {
  if (playback.kind === "embed") {
    return (
      <iframe
        src={`${playback.embedUrl}?autoplay=1&rel=0`}
        title={title}
        className="fd-video-player-embed"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
        allowFullScreen
      />
    );
  }

  const src = playback.kind === "direct" ? playback.url : signedUrl;
  if (!src) {
    return (
      <div className="fd-video-player-fallback">
        <p>Could not load this video. Try again in a moment.</p>
      </div>
    );
  }

  return (
    <video src={src} controls autoPlay playsInline className="fd-video-player-native" />
  );
}

function VideoCard({
  video,
  locked,
  defaultExpanded = false,
  style,
}: {
  video: VideoRow;
  locked?: boolean;
  defaultExpanded?: boolean;
  style?: React.CSSProperties;
}) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const [signedUrl, setSignedUrl] = useState<string | null>(null);
  const [thumbUrl, setThumbUrl] = useState<string | null>(() =>
    video.source === "link" ? getVideoThumbnailUrl(video.external_url) : null,
  );
  const [loadingPlayback, setLoadingPlayback] = useState(false);

  const playback = locked ? null : getVideoPlayback(video);
  const provider: VideoProvider | "upload" =
    playback?.kind === "embed" ? playback.provider : video.source === "link" ? "direct" : "upload";

  useEffect(() => {
    if (video.source !== "link" || !video.thumbnail_path) return;
    let cancelled = false;
    signedStorageUrl(video.thumbnail_path).then((url) => {
      if (!cancelled && url) setThumbUrl(url);
    });
    return () => {
      cancelled = true;
    };
  }, [video.source, video.thumbnail_path]);

  const handleToggle = async () => {
    if (locked || !playback) return;

    if (!expanded && playback.kind === "storage" && !signedUrl) {
      setLoadingPlayback(true);
      const url = await signedStorageUrl(playback.storagePath);
      setSignedUrl(url);
      setLoadingPlayback(false);
      if (!url) return;
    }

    setExpanded((open) => !open);
  };

  const watchUrl =
    video.source === "link" && video.external_url
      ? video.external_url
      : signedUrl;

  return (
    <article className={cn("fd-video-card fd-up", expanded && "fd-video-card--open", locked && "fd-video-card--locked")} style={style}>
      <button
        type="button"
        className="fd-video-card-trigger"
        onClick={() => void handleToggle()}
        disabled={locked || !playback || loadingPlayback}
        aria-expanded={expanded}
      >
        <div className="fd-video-card-thumb">
          {thumbUrl ? (
            <img src={thumbUrl} alt="" className="fd-video-card-thumb-img" />
          ) : (
            <div className="fd-video-card-thumb-fallback">
              {locked ? <Lock size={16} /> : <Play size={16} />}
            </div>
          )}
          {!locked && playback && (
            <span className="fd-video-card-play" aria-hidden>
              <Play size={14} />
            </span>
          )}
        </div>

        <div className="fd-video-card-copy">
          <p className="fd-video-card-title">{video.title}</p>
          <p className="fd-video-card-meta">
            {locked
              ? "Private · approval required"
              : provider === "upload"
                ? "Uploaded footage"
                : providerLabel(provider as VideoProvider)}
          </p>
        </div>

        {!locked && watchUrl && (
          <a
            href={watchUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="fd-video-card-external"
            onClick={(e) => e.stopPropagation()}
          >
            <ExternalLink size={11} />
            Open
          </a>
        )}
      </button>

      {expanded && playback && (
        <div className="fd-video-card-player">
          <VideoPlayer playback={playback} signedUrl={signedUrl} title={video.title} />
        </div>
      )}
    </article>
  );
}

function PrivateAccessPanel({
  count,
  accessStatus,
  onRequest,
  requesting,
}: {
  count: number;
  accessStatus: AccessStatus;
  onRequest: () => void;
  requesting: boolean;
}) {
  return (
    <div className="cmp-compare-card fd-private-videos fd-up">
      <div className="fd-private-videos-head">
        <div className="fd-private-videos-info">
          <div className="fd-private-videos-lock">
            <Lock size={14} />
          </div>
          <div>
            <p className="fd-private-videos-title">
              {count} private video{count > 1 ? "s" : ""}
            </p>
                <p className="fd-private-videos-sub">
              {accessStatus === "approved"
                ? "Access granted — all private videos unlocked"
                : accessStatus === "pending"
                  ? "Waiting for fighter approval on your full private library"
                  : accessStatus === "rejected"
                    ? "Request was declined — you can ask again"
                    : "Unlocks all private videos after fighter approval"}
            </p>
          </div>
        </div>

            {!accessStatus && (
              <button type="button" className="fd-private-videos-btn" onClick={onRequest} disabled={requesting}>
                Request all private
              </button>
            )}
        {accessStatus === "pending" && <span className="fd-private-videos-status--pending">Pending approval</span>}
        {accessStatus === "rejected" && (
          <button type="button" className="fd-private-videos-btn" onClick={onRequest} disabled={requesting}>
            Request again
          </button>
        )}
        {accessStatus === "approved" && <span className="fd-private-videos-status--approved">Access granted</span>}
      </div>
    </div>
  );
}

export function VideosTab({ fighterId, matchmakerId }: { fighterId: string; matchmakerId: string | undefined }) {
  const qc = useQueryClient();

  const { data: videos = [], isLoading } = useQuery({
    queryKey: ["fighter-videos", fighterId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("videos")
        .select("id, title, visibility, source, storage_path, external_url, thumbnail_path")
        .eq("user_id", fighterId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as VideoRow[];
    },
  });

  const { data: accessRequest } = useQuery({
    queryKey: ["video-access", fighterId, matchmakerId],
    enabled: !!matchmakerId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("video_access_requests")
        .select("id, status")
        .eq("fighter_id", fighterId)
        .eq("matchmaker_id", matchmakerId!)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const requestAccess = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("video_access_requests").upsert(
        { fighter_id: fighterId, matchmaker_id: matchmakerId!, status: "pending" },
        { onConflict: "fighter_id,matchmaker_id" },
      );
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["video-access", fighterId, matchmakerId] }),
  });

  if (isLoading) return <TabLoader />;

  const publicVideos = videos.filter((v) => v.visibility === "public");
  const privateVideos = videos.filter((v) => v.visibility !== "public");
  const accessStatus = (accessRequest?.status as AccessStatus) ?? null;
  const canViewPrivate = accessStatus === "approved";

  if (!videos.length) return <TabEmpty label="No videos uploaded" />;

  return (
    <div className="fd-dossier">
      <div className="cmp-history-insight">
        <span className="cmp-history-insight-dot" aria-hidden />
        <p className="cmp-history-insight-text">{videosInsight(publicVideos.length, privateVideos.length)}</p>
      </div>

      {publicVideos.length > 0 && (
        <section className="fd-video-section fd-up" style={delay(0)}>
          <header className="fd-video-section-head">
            <p className="cmp-eyebrow">Public footage</p>
            <span className="fd-video-section-count">{publicVideos.length}</span>
          </header>
          <div className="fd-video-grid">
            {publicVideos.map((video, i) => (
              <VideoCard key={video.id} video={video} style={delay(i * 30)} />
            ))}
          </div>
        </section>
      )}

      {privateVideos.length > 0 && (
        <section className="fd-video-section fd-up" style={delay(40)}>
          <header className="fd-video-section-head">
            <p className="cmp-eyebrow">Private library</p>
            <span className="fd-video-section-count">{privateVideos.length}</span>
          </header>

          <PrivateAccessPanel
            count={privateVideos.length}
            accessStatus={accessStatus}
            onRequest={() => requestAccess.mutate()}
            requesting={requestAccess.isPending}
          />

          <div className="fd-video-grid">
            {privateVideos.map((video, i) => (
              <VideoCard
                key={video.id}
                video={video}
                locked={!canViewPrivate}
                style={delay(60 + i * 30)}
              />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
