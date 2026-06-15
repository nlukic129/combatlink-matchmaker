import { useEffect, useState } from "react";
import { useRouterState } from "@tanstack/react-router";
import {
  readLastSearchLocation,
  saveLastSearchLocation,
  type LastSearchLocation,
} from "@/lib/last-search-location";
import { getNavSection } from "@/lib/nav-transitions";

export function useLastSearchLocation(): LastSearchLocation {
  const location = useRouterState({ select: (s) => s.location });
  const [target, setTarget] = useState<LastSearchLocation>(readLastSearchLocation);

  useEffect(() => {
    if (getNavSection(location.pathname) !== "search") return;
    const entry: LastSearchLocation = {
      to: location.pathname === "/search" || location.pathname === "/search/" ? "/search" : "/search/setup",
      search: location.search as Record<string, unknown>,
    };
    saveLastSearchLocation(location.pathname, entry.search);
    setTarget(entry);
  }, [location.pathname, location.search]);

  return target;
}
