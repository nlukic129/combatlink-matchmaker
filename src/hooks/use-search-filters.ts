import { useNavigate } from "@tanstack/react-router";
import type { SearchFilters } from "@/routes/_app.search";

export function useSearchFilters(filters: SearchFilters) {
  const navigate = useNavigate({ from: "/search" });

  function setFilter<K extends keyof SearchFilters>(key: K, value: SearchFilters[K]) {
    navigate({
      search: (prev) => ({ ...prev, [key]: value, page: 1 }),
      replace: true,
    });
  }

  function clearFilter<K extends keyof SearchFilters>(key: K) {
    navigate({
      search: (prev) => {
        const next = { ...prev };
        delete next[key];
        next.page = 1;
        return next;
      },
      replace: true,
    });
  }

  function setSport(sport: string) {
    navigate({
      search: (prev) => ({
        ...prev,
        sport,
        weightClasses: undefined,
        catchweightKg: undefined,
        page: 1,
      }),
      replace: true,
    });
  }

  function setGender(gender: "male" | "female") {
    navigate({
      search: (prev) => ({
        ...prev,
        gender,
        weightClasses: undefined,
        catchweightKg: undefined,
        page: 1,
      }),
      replace: true,
    });
  }

  return { setFilter, clearFilter, setSport, setGender };
}
