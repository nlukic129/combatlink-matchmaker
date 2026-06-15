const STORAGE_KEY = "combatlink:last-search-location";

export type LastSearchLocation = {
  to: "/search" | "/search/setup";
  search: Record<string, unknown>;
};

function isSearchPath(pathname: string) {
  return pathname === "/search" || pathname === "/search/" || pathname.startsWith("/search/");
}

function toSearchRoute(pathname: string): "/search" | "/search/setup" {
  if (pathname === "/search" || pathname === "/search/") return "/search";
  return "/search/setup";
}

export function saveLastSearchLocation(pathname: string, search: Record<string, unknown>) {
  if (!isSearchPath(pathname)) return;
  const entry: LastSearchLocation = { to: toSearchRoute(pathname), search };
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify(entry));
}

export function readLastSearchLocation(): LastSearchLocation {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return { to: "/search/setup", search: {} };
    const parsed = JSON.parse(raw) as LastSearchLocation;
    if (parsed.to !== "/search" && parsed.to !== "/search/setup") {
      return { to: "/search/setup", search: {} };
    }
    return { to: parsed.to, search: parsed.search ?? {} };
  } catch {
    return { to: "/search/setup", search: {} };
  }
}
