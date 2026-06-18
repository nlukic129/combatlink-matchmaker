import { useState, useMemo, useEffect, useRef } from "react";
import { resolveLocationCountries, CONTINENTS } from "@/lib/geo/countries";
import { useNavigate } from "@tanstack/react-router";
import { List, Map, ChevronLeft, ChevronRight, Users, SearchX, Heart, Search, X } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import { FighterCard } from "./fighter-card";
import { CompareBar } from "./compare-bar";
import { FightersMap } from "./fighters-map";
import { useFighterSearch } from "@/hooks/use-fighter-search";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { SearchResultsSkeletonList } from "@/components/loading/search-results-skeleton";
import { Spinner } from "@/components/ui/spinner";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import type { SearchFighter } from "@/types/database";
import type { SearchFilters } from "@/lib/search-schema";
import { useFavouritesSchema } from "@/hooks/use-favourites-schema";
import { filterFightersByName } from "@/lib/fighter-name-filter";

const EMPTY_FIGHTERS: SearchFighter[] = [];

const PAGE_SIZE = 20;

export function SearchResults({ filters }: { filters: SearchFilters }) {
  const navigate = useNavigate({ from: "/search" });
  const [compareIds, setCompareIds] = useState<string[]>([]);
  const [favouritesOnly, setFavouritesOnly] = useState(false);
  const nameQueryParam = filters.q?.trim() ?? "";
  const [nameInput, setNameInput] = useState(nameQueryParam);
  const nameDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setNameInput(nameQueryParam);
  }, [nameQueryParam]);

  useEffect(() => {
    if (nameDebounceRef.current) clearTimeout(nameDebounceRef.current);
    if (nameInput === nameQueryParam) return;

    nameDebounceRef.current = setTimeout(() => {
      navigate({
        search: (prev) => ({
          ...prev,
          q: nameInput.trim() || undefined,
          page: 1,
        }),
        replace: true,
      });
    }, 250);

    return () => {
      if (nameDebounceRef.current) clearTimeout(nameDebounceRef.current);
    };
  }, [nameInput, nameQueryParam, navigate]);

  const { data, isLoading, isFetching } = useFighterSearch(filters);

  const { data: hasIsSaved } = useFavouritesSchema();

  const { data: favouriteIds } = useQuery({
    queryKey: ["favourite-fighter-ids", hasIsSaved],
    enabled: hasIsSaved !== undefined,
    queryFn: async () => {
      let q = supabase.from("matchmaker_favourites").select("fighter_id");
      if (hasIsSaved) q = q.eq("is_saved", true);
      const { data: rows, error } = await q;
      if (error) throw error;
      return new Set((rows ?? []).map((r) => r.fighter_id as string));
    },
    staleTime: 30_000,
  });

  function toggleCompare(id: string) {
    setCompareIds((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      if (prev.length >= 2) return prev;
      return [...prev, id];
    });
  }

  function setView(view: "list" | "map") {
    navigate({
      search: (p) => ({
        ...p,
        view,
        page: view === "map" ? 1 : p.page,
      }),
      replace: true,
    });
  }

  function setPage(p: number) {
    navigate({ search: (prev) => ({ ...prev, page: p }), replace: true });
  }

  const view = filters.view ?? "list";

  const exactFiltered = useMemo(
    () => favouritesOnly && favouriteIds ? (data?.exact ?? []).filter(f => favouriteIds.has(f.id)) : (data?.exact ?? EMPTY_FIGHTERS),
    [data?.exact, favouritesOnly, favouriteIds]
  );
  const nearFiltered = useMemo(
    () => favouritesOnly && favouriteIds ? (data?.nearMatch ?? []).filter(f => favouriteIds.has(f.id)) : (data?.nearMatch ?? EMPTY_FIGHTERS),
    [data?.nearMatch, favouritesOnly, favouriteIds]
  );

  const nameFilteredExact = useMemo(
    () => filterFightersByName(exactFiltered, nameQueryParam),
    [exactFiltered, nameQueryParam]
  );
  const nameFilteredNear = useMemo(
    () => filterFightersByName(nearFiltered, nameQueryParam),
    [nearFiltered, nameQueryParam]
  );

  const isNameSearchActive = nameQueryParam.length > 0;
  const listPage = filters.page ?? 1;
  const totalPages = data ? Math.ceil(data.total / PAGE_SIZE) : 1;
  const listExact = isNameSearchActive
    ? nameFilteredExact.slice((listPage - 1) * PAGE_SIZE, listPage * PAGE_SIZE)
    : exactFiltered;
  const listNear = isNameSearchActive
    ? (listPage === 1 ? nameFilteredNear : [])
    : nearFiltered;
  const resultTotal = isNameSearchActive ? nameFilteredExact.length : (data?.total ?? 0);
  const resultTotalPages = isNameSearchActive
    ? Math.max(1, Math.ceil(nameFilteredExact.length / PAGE_SIZE))
    : totalPages;
  const favouritesInResults = useMemo(
    () => favouriteIds && data ? [...(data.exact ?? []), ...(data.nearMatch ?? [])].filter(f => favouriteIds.has(f.id)).length : 0,
    [data, favouriteIds]
  );

  const mapFighters = nameFilteredExact;
  const mapNearMatch = nameFilteredNear;
  const showInitialMapLoader = view === "map" && (isLoading || isFetching) && !data;
  const highlightCountries = useMemo(
    () => resolveLocationCountries(filters.countries, filters.continent) ?? undefined,
    [filters.countries, filters.continent]
  );
  const regionLabel = useMemo(() => {
    if (filters.continent) {
      return CONTINENTS.find((c) => c.id === filters.continent)?.label ?? filters.continent;
    }
    if (filters.countries?.length) {
      if (filters.countries.length <= 3) return filters.countries.join(", ");
      return `${filters.countries.slice(0, 3).join(", ")} +${filters.countries.length - 3} more`;
    }
    return undefined;
  }, [filters.continent, filters.countries]);
  const regionFilterKey = `${filters.continent ?? ""}|${(filters.countries ?? []).join(",")}`;

  // Keep one Mapbox instance after first map open — toggling list/map must not remount the map.
  const [mapEverOpened, setMapEverOpened] = useState(() => (filters.view ?? "list") === "map");
  useEffect(() => {
    if ((filters.view ?? "list") === "map") setMapEverOpened(true);
  }, [filters.view]);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-center gap-3 border-b border-border px-5 py-3.5">
        <div className="flex min-w-0 shrink-0 items-center gap-3 text-sm text-muted-foreground">
          {isLoading ? (
            "Loading fighters…"
          ) : data ? (
            <>
              <div className="flex items-center gap-2 whitespace-nowrap">
                <Users className="h-4 w-4 shrink-0" />
                <span>
                  <span className="font-semibold text-foreground">{resultTotal.toLocaleString()}</span>
                  {" "}fighters
                  {isNameSearchActive && data.total !== resultTotal && (
                    <span className="text-muted-foreground/80"> of {data.total.toLocaleString()}</span>
                  )}
                </span>
                {isFetching && <Spinner size="sm" />}
              </div>
              {favouritesInResults > 0 && (
                <button
                  type="button"
                  onClick={() => setFavouritesOnly(v => !v)}
                  className={cn(
                    "flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-all",
                    favouritesOnly
                      ? "border-primary/30 bg-primary/10 text-primary"
                      : "border-border/60 text-muted-foreground hover:border-border hover:text-foreground"
                  )}
                  title={favouritesOnly ? "Show all search results" : "Show favourites in these results only"}
                >
                  <Heart className={cn("h-3 w-3", favouritesOnly && "fill-current")} />
                  {favouritesOnly
                    ? `${nameFilteredExact.length + nameFilteredNear.length} favourites`
                    : `${favouritesInResults} ${favouritesInResults === 1 ? "favourite" : "favourites"}`}
                </button>
              )}
            </>
          ) : null}
        </div>

        <div className="relative mx-1 min-w-0 flex-1 max-w-md">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="text"
            value={nameInput}
            onChange={(e) => setNameInput(e.target.value)}
            placeholder="Search by name or nickname…"
            aria-label="Search fighters by name or nickname"
            role="searchbox"
            className="h-8 pl-8 pr-8 text-sm"
          />
          {nameInput && (
            <button
              type="button"
              onClick={() => setNameInput("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded-sm p-0.5 text-muted-foreground transition-colors hover:text-foreground"
              aria-label="Clear name search"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        <SegmentedControl
          options={[
            { value: "list" as const, label: "List", icon: <List className="h-3.5 w-3.5" /> },
            { value: "map" as const, label: "Map", icon: <Map className="h-3.5 w-3.5" /> },
          ]}
          value={view}
          onChange={setView}
          size="sm"
        />
      </div>

      {isLoading && view !== "map" ? (
        <div className="fc-list-shell relative flex min-h-0 flex-1 flex-col">
          <SearchResultsSkeletonList />
        </div>
      ) : (
        <div className="relative flex min-h-0 flex-1 flex-col">
          {mapEverOpened && (
            <div
              className={cn(
                "absolute inset-0 min-h-0",
                view !== "map" && "pointer-events-none invisible"
              )}
              aria-hidden={view !== "map"}
            >
              {showInitialMapLoader && view === "map" && (
                <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/80">
                  <MapLoader />
                </div>
              )}
              <FightersMap
                fighters={mapFighters}
                nearMatch={mapNearMatch}
                cityLat={filters.cityLat}
                cityLng={filters.cityLng}
                radiusKm={filters.radiusKm}
                highlightCountries={highlightCountries}
                regionLabel={regionLabel}
                regionFilterKey={regionFilterKey}
                savedFighterIds={favouriteIds}
                visible={view === "map"}
              />
            </div>
          )}

          {view === "list" ? (
            <div className="fc-list-shell absolute inset-0 z-10 flex min-h-0 flex-col bg-background">
              <div className="fc-list-scroll scrollbar-thin min-h-0 flex-1 overflow-y-auto overscroll-contain">
                <div className="fc-list-inner">
                  {listExact.map((f) => (
                    <FighterCard
                      key={f.id}
                      fighter={f}
                      selected={compareIds.includes(f.id)}
                      onToggleCompare={() => toggleCompare(f.id)}
                    />
                  ))}

                  {listNear.length > 0 && (
                    <>
                      <NearMatchDivider count={listNear.length} />
                      {listNear.map((f) => (
                        <FighterCard
                          key={f.id}
                          fighter={f}
                          nearMatch
                          selected={compareIds.includes(f.id)}
                          onToggleCompare={() => toggleCompare(f.id)}
                        />
                      ))}
                    </>
                  )}

                  {listExact.length === 0 && listNear.length === 0 && (
                    favouritesOnly ? (
                      <EmptyState
                        icon={<Heart className="h-8 w-8" />}
                        title="No favourites in these results"
                        description="None of your favourites match the current search filters."
                      />
                    ) : isNameSearchActive ? (
                      <EmptyState
                        icon={<SearchX className="h-8 w-8" />}
                        title="No fighters match that name"
                        description={`No results for "${nameQueryParam}". Try a different spelling or clear the search.`}
                      />
                    ) : (
                      <EmptyResults />
                    )
                  )}
                </div>
              </div>

              {resultTotalPages > 1 && !favouritesOnly && (
                <div className="fc-list-pagination">
                  <Button
                    variant="outline"
                    size="icon-sm"
                    onClick={() => setPage(listPage - 1)}
                    disabled={listPage <= 1}
                    aria-label="Previous page"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <span className="text-sm text-muted-foreground">
                    Page <span className="font-medium text-foreground">{listPage}</span> of {resultTotalPages}
                  </span>
                  <Button
                    variant="outline"
                    size="icon-sm"
                    onClick={() => setPage(listPage + 1)}
                    disabled={listPage >= resultTotalPages}
                    aria-label="Next page"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              )}

              {compareIds.length > 0 && (
                <CompareBar
                  ids={compareIds}
                  sport={filters.sport}
                  gender={filters.gender}
                  onRemove={(id) => setCompareIds((p) => p.filter((x) => x !== id))}
                />
              )}
            </div>
          ) : !mapEverOpened ? (
            <MapLoader />
          ) : null}
        </div>
      )}

    </div>
  );
}

function NearMatchDivider({ count }: { count: number }) {
  return (
    <div className="fc-divider">
      <span className="fc-divider-label">
        {count} near {count === 1 ? "match" : "matches"}
      </span>
    </div>
  );
}

function EmptyResults() {
  return (
    <EmptyState
      icon={<SearchX className="h-8 w-8" />}
      title="No fighters found"
      description="Try adjusting your filters or removing some criteria."
    />
  );
}

function MapLoader() {
  return (
    <div className="flex h-full items-center justify-center">
      <Spinner size="lg" />
    </div>
  );
}
