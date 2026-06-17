export type VideoProvider = "youtube" | "vimeo" | "direct";

export type ParsedVideoLink = {
  provider: VideoProvider;
  watchUrl: string;
  playbackUrl: string;
};

export function normalizeVideoUrl(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return "";
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

export function parseVideoLink(raw: string): ParsedVideoLink | null {
  const normalized = normalizeVideoUrl(raw);
  if (!normalized) return null;

  let url: URL;
  try {
    url = new URL(normalized);
  } catch {
    return null;
  }

  const host = url.hostname.replace(/^www\./, "").toLowerCase();

  if (host === "youtu.be") {
    const id = url.pathname.slice(1).split("/")[0];
    if (!id) return null;
    return youtubeParsed(id);
  }

  if (host === "youtube.com" || host === "m.youtube.com" || host === "music.youtube.com") {
    if (url.pathname.startsWith("/embed/")) {
      const id = url.pathname.split("/")[2];
      if (id) return youtubeParsed(id);
    }
    if (url.pathname.startsWith("/shorts/")) {
      const id = url.pathname.split("/")[2];
      if (id) return youtubeParsed(id);
    }
    const v = url.searchParams.get("v");
    if (v) return youtubeParsed(v);
    return null;
  }

  if (host === "vimeo.com" || host === "player.vimeo.com") {
    const parts = url.pathname.split("/").filter(Boolean);
    const id = host === "player.vimeo.com" ? parts[0] : parts[parts.length - 1];
    if (!id || !/^\d+$/.test(id)) return null;
    return {
      provider: "vimeo",
      watchUrl: `https://vimeo.com/${id}`,
      playbackUrl: `https://player.vimeo.com/video/${id}`,
    };
  }

  if (/\.(mp4|webm|ogg|mov)(\?|$)/i.test(url.pathname)) {
    return {
      provider: "direct",
      watchUrl: normalized,
      playbackUrl: normalized,
    };
  }

  return null;
}

function youtubeParsed(id: string): ParsedVideoLink {
  return {
    provider: "youtube",
    watchUrl: `https://www.youtube.com/watch?v=${id}`,
    playbackUrl: `https://www.youtube-nocookie.com/embed/${id}`,
  };
}

export function providerLabel(provider: VideoProvider): string {
  if (provider === "youtube") return "YouTube";
  if (provider === "vimeo") return "Vimeo";
  return "Video file";
}

function youtubeVideoId(parsed: ParsedVideoLink): string | null {
  if (parsed.provider !== "youtube") return null;
  try {
    const url = new URL(parsed.watchUrl);
    const fromQuery = url.searchParams.get("v");
    if (fromQuery) return fromQuery;
    if (url.hostname.replace(/^www\./, "") === "youtu.be") {
      return url.pathname.slice(1).split("/")[0] || null;
    }
  } catch {
    return null;
  }
  return null;
}

export function getVideoThumbnailUrl(externalUrl: string | null): string | null {
  if (!externalUrl) return null;
  const parsed = parseVideoLink(externalUrl);
  if (!parsed) return null;
  const id = youtubeVideoId(parsed);
  if (!id) return null;
  return `https://img.youtube.com/vi/${id}/mqdefault.jpg`;
}

export type VideoPlayback =
  | { kind: "embed"; embedUrl: string; provider: VideoProvider }
  | { kind: "direct"; url: string }
  | { kind: "storage"; storagePath: string };

export function getVideoPlayback(row: {
  source?: string | null;
  storage_path: string | null;
  external_url: string | null;
}): VideoPlayback | null {
  if (row.source === "link" && row.external_url) {
    const parsed = parseVideoLink(row.external_url);
    if (parsed) {
      if (parsed.provider === "direct") {
        return { kind: "direct", url: parsed.playbackUrl };
      }
      return { kind: "embed", embedUrl: parsed.playbackUrl, provider: parsed.provider };
    }
    return { kind: "direct", url: normalizeVideoUrl(row.external_url) };
  }
  if (row.storage_path) {
    return { kind: "storage", storagePath: row.storage_path };
  }
  return null;
}
