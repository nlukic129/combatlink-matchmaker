import type { ViewTransitionOptions } from "@tanstack/react-router";

export type NavSection = "search" | "favourites" | "other";
export type SlideDirection = "forward" | "back";
export type SearchRouteTransition = "launch" | "return";

export function normalizePath(pathname: string) {
  return pathname === "/search/" ? "/search" : pathname;
}

export function getNavSection(pathname: string): NavSection {
  if (pathname.startsWith("/search")) return "search";
  if (pathname.startsWith("/favourites")) return "favourites";
  return "other";
}

export function getSlideDirection(from: string, to: string): SlideDirection | null {
  const fromSection = getNavSection(from);
  const toSection = getNavSection(to);
  if (fromSection === "search" && toSection === "favourites") return "forward";
  if (fromSection === "favourites" && toSection === "search") return "back";
  return null;
}

export function getSearchRouteTransition(from: string, to: string): SearchRouteTransition | null {
  const fromPath = normalizePath(from);
  const toPath = normalizePath(to);
  if (fromPath === "/search/setup" && toPath === "/search") return "launch";
  if (fromPath === "/search" && toPath === "/search/setup") return "return";
  return null;
}

export function getViewTransitionTypes(from: string, to: string): string[] | false {
  const searchTransition = getSearchRouteTransition(from, to);
  if (searchTransition) return [`search-${searchTransition}`];

  const direction = getSlideDirection(from, to);
  if (direction) return [`slide-${direction}`];

  return false;
}

/** View transition types for nav + search route changes. */
export const navViewTransition: ViewTransitionOptions = {
  types: ({ fromLocation, toLocation }) => {
    if (!fromLocation) return false;
    return getViewTransitionTypes(fromLocation.pathname, toLocation.pathname);
  },
};

export const searchLaunchViewTransition: ViewTransitionOptions = {
  types: ["search-launch"],
};

export const supportsViewTransitions =
  typeof document !== "undefined" &&
  "startViewTransition" in document &&
  typeof document.startViewTransition === "function";
