import { useRef } from "react";
import { createFileRoute, Outlet, useRouterState } from "@tanstack/react-router";
import { cn } from "@/lib/utils";
import { getSearchRouteTransition, supportsViewTransitions } from "@/lib/nav-transitions";

/** Layout shell for /search and /search/setup — no redirects here. */
export const Route = createFileRoute("/_app/search")({
  component: SearchLayout,
});

function SearchLayout() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const prevPathRef = useRef(pathname);
  const fallbackRef = useRef<ReturnType<typeof getSearchRouteTransition>>(null);

  if (prevPathRef.current !== pathname) {
    fallbackRef.current = supportsViewTransitions
      ? null
      : getSearchRouteTransition(prevPathRef.current, pathname);
    prevPathRef.current = pathname;
  } else {
    fallbackRef.current = null;
  }

  const fallback = fallbackRef.current;

  return (
    <div
      className={cn(
        "search-route-shell flex min-h-0 flex-1 flex-col overflow-hidden",
        fallback === "launch" && "search-fallback-launch",
        fallback === "return" && "search-fallback-return"
      )}
    >
      <Outlet />
    </div>
  );
}
