import { useRef } from "react";
import { Outlet, useRouterState } from "@tanstack/react-router";
import { cn } from "@/lib/utils";
import {
  getNavSection,
  getSlideDirection,
  supportsViewTransitions,
} from "@/lib/nav-transitions";

export function AppPageTransition() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const section = getNavSection(pathname);

  const prevPathRef = useRef(pathname);
  const fallbackRef = useRef<"forward" | "back" | null>(null);

  if (prevPathRef.current !== pathname) {
    fallbackRef.current = supportsViewTransitions
      ? null
      : getSlideDirection(prevPathRef.current, pathname);
    prevPathRef.current = pathname;
  } else {
    fallbackRef.current = null;
  }

  const fallback = fallbackRef.current;

  return (
    <div
      className={cn(
        "app-page flex min-h-0 flex-1 flex-col overflow-hidden",
        section !== "search" && "overflow-y-auto",
        !supportsViewTransitions &&
          fallback === "forward" &&
          "app-page-fallback-forward",
        !supportsViewTransitions && fallback === "back" && "app-page-fallback-back"
      )}
    >
      <Outlet />
    </div>
  );
}
