import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { resolveLocationCountries } from "@/lib/geo/countries";
import type { SearchFilters } from "@/lib/search-schema";
import type { SearchFighter } from "@/types/database";

const LIST_PAGE_SIZE = 20;
/** Map view shows every matching fighter — no pagination. */
const MAP_PAGE_SIZE = 10_000;

type SearchResult = {
  exact: SearchFighter[];
  nearMatch: SearchFighter[];
  total: number;
  page: number;
};

/**
 * Build a stable query key that excludes UI-only fields:
 * - `fighter` — drawer open/close never affects search results
 * - `view`    — determines fetch strategy internally, not search criteria
 * - `page`    — for map queries: always page 1; list queries include it
 */
function makeQueryKey(filters: SearchFilters) {
  const { fighter: _f, view, page, ...criteria } = filters;
  if (view === "map") {
    // Map always fetches all results (page 1, MAP_PAGE_SIZE) — page is irrelevant
    return ["fighters-search", "map", criteria] as const;
  }
  // List is paginated — page is part of the cache key
  return ["fighters-search", "list", { ...criteria, page }] as const;
}

export function useFighterSearch(filters: SearchFilters) {
  return useQuery<SearchResult>({
    queryKey: makeQueryKey(filters),
    enabled: !!filters.sport && !!filters.gender,
    queryFn: () => fetchFighters(filters),
    placeholderData: (prev) => prev,
  });
}

function buildRpcArgs(filters: SearchFilters, nearMatch: boolean) {
  const isMapView = filters.view === "map";
  const locationCountries = resolveLocationCountries(filters.countries, filters.continent);

  return {
    p_sport:            filters.sport!,
    p_gender:           filters.gender!,
    p_weight_ids:       filters.weightClasses?.length ? filters.weightClasses : null,
    p_catchweight_kg:   filters.catchweightKg ?? null,
    p_ready_by_date:    filters.readyToFightOn ?? null,
    p_short_notice:     filters.shortNotice ?? null,
    p_promo_status:     filters.promotionalStatus ?? null,
    p_max_prep_weeks:   filters.maxPrepWeeks ?? null,
    p_purse_max:        filters.purseMax ?? null,
    p_level:            filters.level ?? null,
    p_min_wins:         filters.minWins ?? null,
    p_max_losses:       filters.maxLosses ?? null,
    p_max_total_fights: filters.maxTotalFights ?? null,
    p_city_lat:         filters.cityLat ?? null,
    p_city_lng:         filters.cityLng ?? null,
    p_radius_km:        filters.radiusKm ?? null,
    p_countries:        locationCountries,
    p_fight_styles:     filters.fightStyles?.length ? filters.fightStyles : null,
    p_stance:           filters.stance ?? null,
    p_height_min:       filters.heightMinCm ?? null,
    p_height_max:       filters.heightMaxCm ?? null,
    p_reach_min:        filters.reachMinCm ?? null,
    p_reach_max:        filters.reachMaxCm ?? null,
    p_min_followers:    filters.minInstagramFollowers ?? null,
    p_nationalities:    filters.nationalities?.length ? filters.nationalities : null,
    p_near_match:       nearMatch,
    p_page:             isMapView ? 1 : (filters.page ?? 1),
    p_page_size:        isMapView ? MAP_PAGE_SIZE : LIST_PAGE_SIZE,
  };
}

async function fetchFighters(filters: SearchFilters): Promise<SearchResult> {
  const isMapView = filters.view === "map";
  const page = isMapView ? 1 : (filters.page ?? 1);

  // Exact matches
  const { data: exactData, error } = await supabase.rpc(
    "search_fighters",
    buildRpcArgs(filters, false)
  );
  if (error) throw error;

  const exact = (exactData ?? []) as (SearchFighter & { total_count: number })[];
  const total = exact[0]?.total_count ?? 0;

  // Near matches — only on page 1
  let nearMatch: SearchFighter[] = [];
  const hasAnyFilter =
    filters.purseMax != null ||
    filters.readyToFightOn ||
    filters.minWins != null ||
    filters.maxLosses != null ||
    filters.maxTotalFights != null ||
    filters.heightMinCm != null ||
    filters.heightMaxCm != null ||
    filters.reachMinCm != null ||
    filters.reachMaxCm != null ||
    filters.radiusKm != null ||
    filters.countries?.length ||
    filters.continent;

  if (hasAnyFilter && (isMapView || page === 1)) {
    const exactIds = exact.map((f) => f.id);

    const { data: nearData } = await supabase.rpc(
      "search_fighters",
      buildRpcArgs(filters, true)
    );

    nearMatch = ((nearData ?? []) as (SearchFighter & { total_count: number })[]).filter(
      (f) => !exactIds.includes(f.id)
    );
  }

  return {
    exact: exact as SearchFighter[],
    nearMatch,
    total: Number(total),
    page,
  };
}
