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
import type { SearchFilters } from "@/routes/_app.search";

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
  const mapFighters = data?.exact ?? [];
  const mapNearMatch = data?.nearMatch;
  const showInitialMapLoader = view === "map" && isLoading && !data;
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
    <div className="flex h-full flex-col">
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
        <SkeletonList />
      ) : (
        <div className="relative min-h-0 flex-1">
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
            <>
              <div className="relative z-10 flex h-full flex-col bg-background">
                <div className="flex-1 space-y-2.5 overflow-y-auto p-5 scrollbar-thin">
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

                {totalPages > 1 && (
                  <div className="flex items-center justify-center gap-3 border-t border-border py-4">
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
              </div>
            </>
          ) : !mapEverOpened ? (
            <MapLoader />
          ) : null}
        </div>
      )}

      {compareIds.length > 0 && (
        <CompareBar ids={compareIds} onRemove={(id) => setCompareIds((p) => p.filter((x) => x !== id))} />
      )}
    </div>
  );
}

function NearMatchDivider({ count }: { count: number }) {
  return (
    <div className="flex items-center gap-4 py-4">
      <div className="h-px flex-1 bg-border" />
      <span className="shrink-0 rounded-full border border-border bg-muted/40 px-4 py-1.5 text-xs font-medium text-muted-foreground">
        {count} near {count === 1 ? "match" : "matches"} — slightly outside your filters
      </span>
      <div className="h-px flex-1 bg-border" />
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
    <div className="space-y-2.5 p-5">
      {Array.from({ length: 6 }).map((_, i) => (
        <div
          key={i}
          className="flex items-center gap-4 rounded-xl border border-border bg-card px-4 py-4"
        >
          <div className="h-14 w-14 shrink-0 rounded-full shimmer" />
          <div className="flex-1 space-y-2.5">
            <div className="h-4 w-36 rounded-md shimmer" />
            <div className="h-3 w-24 rounded-md shimmer" />
          </div>
          <div className="h-6 w-20 rounded-full shimmer" />
        </div>
      ))}
    </div>
  );
}
