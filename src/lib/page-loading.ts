export type PageLoaderKey =
  | "search-setup"
  | "search"
  | "favourites"
  | "compare"
  | "notifications"
  | "settings"
  | "default";

export function resolvePageLoaderKey(pathname: string): PageLoaderKey {
  if (pathname.startsWith("/search/setup")) return "search-setup";
  if (pathname.startsWith("/search")) return "search";
  if (pathname.startsWith("/favourites")) return "favourites";
  if (pathname.startsWith("/compare")) return "compare";
  if (pathname.startsWith("/notifications")) return "notifications";
  if (pathname.startsWith("/settings")) return "settings";
  return "default";
}
