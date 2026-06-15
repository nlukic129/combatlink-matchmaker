import { useState, useMemo, useEffect } from "react";
import { resolveLocationCountries, CONTINENTS } from "@/lib/geo/countries";
import { useNavigate } from "@tanstack/react-router";
import { List, Map, ChevronLeft, ChevronRight, Users, SearchX } from "lucide-react";
import { cn } from "@/lib/utils";
import { FighterCard } from "./fighter-card";
import { CompareBar } from "./compare-bar";
import { FightersMap } from "./fighters-map";
import { useFighterSearch } from "@/hooks/use-fighter-search";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { Spinner } from "@/components/ui/spinner";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import type { SearchFighter } from "@/types/database";
import type { SearchFilters } from "@/lib/search-schema";

const EMPTY_FIGHTERS: SearchFighter[] = [];

const PAGE_SIZE = 20;

export function SearchResults({ filters }: { filters: SearchFilters }) {
  const navigate = useNavigate({ from: "/search" });
  const [compareIds, setCompareIds] = useState<string[]>([]);

  const { data, isLoading, isFetching } = useFighterSearch(filters);

  const page = filters.page ?? 1;
  const totalPages = data ? Math.ceil(data.total / PAGE_SIZE) : 1;

  function toggleCompare(id: string) {
    setCompareIds((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      if (prev.length >= 4) return prev;
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
  const mapFighters = data?.exact ?? EMPTY_FIGHTERS;
  const mapNearMatch = data?.nearMatch ?? EMPTY_FIGHTERS;
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
      <div className="flex items-center justify-between border-b border-border px-5 py-3.5">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          {isLoading ? (
            "Loading fighters…"
          ) : data ? (
            <>
              <Users className="h-4 w-4" />
              <span>
                <span className="font-semibold text-foreground">{data.total.toLocaleString()}</span>
                {" "}fighters found
              </span>
              {isFetching && <Spinner size="sm" />}
            </>
          ) : null}
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
          <SkeletonList />
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
                visible={view === "map"}
              />
            </div>
          )}

          {view === "list" ? (
            <div className="fc-list-shell absolute inset-0 z-10 flex min-h-0 flex-col bg-background">
              <div className="fc-list-scroll scrollbar-thin min-h-0 flex-1 overflow-y-auto overscroll-contain">
                <div className="fc-list-inner">
                  {data?.exact.map((f) => (
                    <FighterCard
                      key={f.id}
                      fighter={f}
                      selected={compareIds.includes(f.id)}
                      onToggleCompare={() => toggleCompare(f.id)}
                    />
                  ))}

                  {data?.nearMatch && data.nearMatch.length > 0 && (
                    <>
                      <NearMatchDivider count={data.nearMatch.length} />
                      {data.nearMatch.map((f) => (
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

                  {data?.exact.length === 0 && !data?.nearMatch.length && <EmptyResults />}
                </div>
              </div>

              {totalPages > 1 && (
                <div className="fc-list-pagination">
                  <Button
                    variant="outline"
                    size="icon-sm"
                    onClick={() => setPage(page - 1)}
                    disabled={page <= 1}
                    aria-label="Previous page"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <span className="text-sm text-muted-foreground">
                    Page <span className="font-medium text-foreground">{page}</span> of {totalPages}
                  </span>
                  <Button
                    variant="outline"
                    size="icon-sm"
                    onClick={() => setPage(page + 1)}
                    disabled={page >= totalPages}
                    aria-label="Next page"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              )}

              {compareIds.length > 0 && (
                <CompareBar
                  ids={compareIds}
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

function SkeletonList() {
  return (
    <div className="fc-list-scroll scrollbar-thin min-h-0 flex-1 overflow-y-auto">
      <div className="fc-list-inner">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="fc-skeleton">
            <div className="fc-skeleton-photo shimmer" />
            <div className="fc-skeleton-main">
              <div className="h-5 w-44 rounded-md shimmer" />
              <div className="flex gap-2">
                <div className="h-3 w-16 rounded-full shimmer" />
                <div className="h-3 w-20 rounded-md shimmer" />
              </div>
            </div>
            <div className="fc-skeleton-stats">
              <div className="h-5 w-20 rounded-md shimmer" />
              <div className="h-2.5 w-12 rounded-md shimmer" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
