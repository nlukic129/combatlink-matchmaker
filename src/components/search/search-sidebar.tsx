import { useRef, useState, useEffect } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Filter, X } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import type { SearchFilters } from "@/lib/search-schema";
import { LocationRegionFilters } from "@/components/search/location-region-filters";

const GEOAPIFY_KEY = import.meta.env.VITE_GEOAPIFY_KEY as string;

export function SearchSidebar({
  filters,
  disabled,
}: {
  filters: SearchFilters;
  disabled: boolean;
}) {
  if (disabled) {
    return (
      <aside className="hidden w-[300px] shrink-0 border-r border-border bg-sidebar/50 xl:flex flex-col" />
    );
  }

  return (
    <aside className="hidden w-[300px] shrink-0 flex-col overflow-y-auto border-r border-border bg-sidebar/50 scrollbar-thin xl:flex">
      <div className="sticky top-0 z-10 flex items-center gap-2 border-b border-border bg-sidebar/80 px-5 py-3.5 backdrop-blur-sm">
        <Filter className="h-4 w-4 text-primary" />
        <span className="text-sm font-semibold text-foreground">Filters</span>
      </div>

      <div className="space-y-7 p-5">
        <BookingFilters filters={filters} />
        <ExperienceFilters filters={filters} />
        <LocationFilters filters={filters} />
        <StylePhysicalFilters filters={filters} />
        <VisibilityFilters filters={filters} />
      </div>
    </aside>
  );
}

function SectionHeader({ title }: { title: string }) {
  return (
    <p className="mb-3.5 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
      {title}
    </p>
  );
}

const inputClass =
  "w-full rounded-lg border border-input bg-card px-3 py-2 text-sm text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:border-primary/40";

const selectClass =
  "w-full rounded-lg border border-input bg-card px-3 py-2 text-sm text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

const smallInputClass =
  "w-full rounded-lg border border-input bg-card px-2.5 py-2 text-sm text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

function BookingFilters({ filters }: { filters: SearchFilters }) {
  const navigate = useNavigate({ from: "/search" });

  function set<K extends keyof SearchFilters>(key: K, value: SearchFilters[K]) {
    navigate({ search: (p) => ({ ...p, [key]: value, page: 1 }), replace: true });
  }

  return (
    <section>
      <SectionHeader title="Booking" />
      <div className="space-y-4">
        {/* Ready to fight on */}
        <div>
          <label className="mb-1.5 block text-xs text-muted-foreground">Ready to fight on</label>
          <input
            type="date"
            value={filters.readyToFightOn ?? ""}
            onChange={(e) => set("readyToFightOn", e.target.value || undefined)}
            className={inputClass}
          />
        </div>

        {/* Short notice */}
        <label className="flex items-center gap-2.5 cursor-pointer">
          <input
            type="checkbox"
            checked={filters.shortNotice ?? false}
            onChange={(e) => set("shortNotice", e.target.checked || undefined)}
            className="h-4 w-4 rounded border-input accent-primary"
          />
          <span className="text-sm text-foreground">Short notice only</span>
        </label>

        {/* Promotional status */}
        <div>
          <label className="mb-1.5 block text-xs text-muted-foreground">Promotional status</label>
          <select
            value={filters.promotionalStatus ?? ""}
            onChange={(e) => set("promotionalStatus", e.target.value || undefined)}
            className={inputClass}
          >
            <option value="">Any</option>
            <option value="open">Free agent</option>
            <option value="exclusive">Exclusive</option>
          </select>
        </div>

        {/* Purse range */}
        <div>
          <label className="mb-1.5 block text-xs text-muted-foreground">
            Max budget (USD)
            {filters.purseMax && (
              <span className="ml-1 font-medium text-foreground">
                ${filters.purseMax.toLocaleString()}
              </span>
            )}
          </label>
          <input
            type="range"
            min={0}
            max={500000}
            step={5000}
            value={filters.purseMax ?? 500000}
            onChange={(e) => {
              const v = Number(e.target.value);
              set("purseMax", v < 500000 ? v : undefined);
            }}
            className="w-full accent-primary"
          />
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>$0</span>
            <span>$500k+</span>
          </div>
        </div>

        {/* Max prep weeks */}
        <div>
          <label className="mb-1.5 block text-xs text-muted-foreground">
            Max prep time
            {filters.maxPrepWeeks && (
              <span className="ml-1 font-medium text-foreground">{filters.maxPrepWeeks}w</span>
            )}
          </label>
          <input
            type="range"
            min={1}
            max={16}
            step={1}
            value={filters.maxPrepWeeks ?? 16}
            onChange={(e) => {
              const v = Number(e.target.value);
              set("maxPrepWeeks", v < 16 ? v : undefined);
            }}
            className="w-full accent-primary"
          />
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>1 week</span>
            <span>16w+</span>
          </div>
        </div>
      </div>
    </section>
  );
}

function ExperienceFilters({ filters }: { filters: SearchFilters }) {
  const navigate = useNavigate({ from: "/search" });

  function set<K extends keyof SearchFilters>(key: K, value: SearchFilters[K]) {
    navigate({ search: (p) => ({ ...p, [key]: value, page: 1 }), replace: true });
  }

  return (
    <section>
      <SectionHeader title="Experience" />
      <div className="space-y-3">
        <div>
          <label className="mb-1.5 block text-xs text-muted-foreground">Level</label>
          <div className="flex gap-1 rounded-lg bg-card p-0.5">
            {(["", "amateur", "pro"] as const).map((v) => (
              <button
                key={v}
                onClick={() => set("level", v || undefined)}
                className={cn(
                  "flex-1 rounded-md py-1 text-xs font-medium transition-colors",
                  (filters.level ?? "") === v
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {v === "" ? "Any" : v.charAt(0).toUpperCase() + v.slice(1)}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="mb-1 block text-xs text-muted-foreground">Min wins</label>
            <input
              type="number"
              min={0}
              value={filters.minWins ?? ""}
              onChange={(e) => set("minWins", e.target.value ? Number(e.target.value) : undefined)}
              placeholder="0"
              className={smallInputClass}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-muted-foreground">Max losses</label>
            <input
              type="number"
              min={0}
              value={filters.maxLosses ?? ""}
              onChange={(e) => set("maxLosses", e.target.value ? Number(e.target.value) : undefined)}
              placeholder="—"
              className={smallInputClass}
            />
          </div>
        </div>

        <div>
          <label className="mb-1 block text-xs text-muted-foreground">Max total fights</label>
          <input
            type="number"
            min={1}
            value={filters.maxTotalFights ?? ""}
            onChange={(e) =>
              set("maxTotalFights", e.target.value ? Number(e.target.value) : undefined)
            }
            placeholder="Any"
            className={smallInputClass}
          />
        </div>
      </div>
    </section>
  );
}

type GeoapifySuggestion = {
  place_id: string;
  formatted: string;
  lat: number;
  lon: number;
};

function LocationFilters({ filters }: { filters: SearchFilters }) {
  const navigate = useNavigate({ from: "/search" });
  const [query, setQuery] = useState(filters.cityName ?? "");
  const [suggestions, setSuggestions] = useState<GeoapifySuggestion[]>([]);
  const [open, setOpen] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);

  // Keep input in sync when filter is cleared externally
  useEffect(() => {
    setQuery(filters.cityName ?? "");
  }, [filters.cityName]);

  // Close dropdown on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  function set<K extends keyof SearchFilters>(key: K, value: SearchFilters[K]) {
    navigate({ search: (p) => ({ ...p, [key]: value, page: 1 }), replace: true });
  }

  function onInputChange(value: string) {
    setQuery(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!value.trim() || !GEOAPIFY_KEY) {
      setSuggestions([]);
      setOpen(false);
      // Clear city from filters when input is emptied
      if (!value.trim()) {
        navigate({
          search: (p) => {
            const next = { ...p };
            delete next.cityName;
            delete next.cityLat;
            delete next.cityLng;
            delete next.radiusKm;
            return { ...next, page: 1 };
          },
          replace: true,
        });
      }
      return;
    }
    debounceRef.current = setTimeout(async () => {
      const url =
        `https://api.geoapify.com/v1/geocode/autocomplete` +
        `?text=${encodeURIComponent(value)}` +
        `&type=city` +
        `&limit=6` +
        `&apiKey=${GEOAPIFY_KEY}`;
      const res = await fetch(url);
      const json = await res.json();
      const results: GeoapifySuggestion[] = (json.features ?? []).map((f: any) => ({
        place_id: f.properties.place_id,
        formatted: f.properties.formatted,
        lat: f.properties.lat,
        lon: f.properties.lon,
      }));
      setSuggestions(results);
      setOpen(results.length > 0);
    }, 300);
  }

  function selectSuggestion(s: GeoapifySuggestion) {
    setQuery(s.formatted);
    setSuggestions([]);
    setOpen(false);
    navigate({
      search: (p) => ({
        ...p,
        cityName: s.formatted,
        cityLat: s.lat,
        cityLng: s.lon,
        radiusKm: p.radiusKm ?? 500,
        page: 1,
      }),
      replace: true,
    });
  }

  function clearCity() {
    setQuery("");
    setSuggestions([]);
    setOpen(false);
    navigate({
      search: (p) => {
        const next = { ...p };
        delete next.cityName;
        delete next.cityLat;
        delete next.cityLng;
        delete next.radiusKm;
        return { ...next, page: 1 };
      },
      replace: true,
    });
  }

  return (
    <section>
      <SectionHeader title="Location" />
      <div className="space-y-3">
        <LocationRegionFilters filters={filters} />

        <div ref={wrapperRef} className="relative">
          <label className="mb-1.5 block text-xs text-muted-foreground">City</label>
          <div className="relative">
            <input
              type="text"
              value={query}
              onChange={(e) => onInputChange(e.target.value)}
              onFocus={() => suggestions.length > 0 && setOpen(true)}
              placeholder="Search city…"
              autoComplete="off"
              className={cn(inputClass, "pr-8 placeholder:text-muted-foreground")}
            />
            {query && (
              <button
                onClick={clearCity}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                aria-label="Clear city"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {open && (
            <ul className="absolute z-50 mt-1.5 w-full overflow-hidden rounded-lg border border-border bg-card shadow-[var(--shadow-elevated)]">
              {suggestions.map((s) => (
                <li key={s.place_id}>
                  <button
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => selectSuggestion(s)}
                    className="w-full px-3 py-2 text-left text-sm text-foreground hover:bg-accent transition-colors"
                  >
                    {s.formatted}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {filters.cityLat && (
          <div>
            <label className="mb-1.5 block text-xs text-muted-foreground">
              Radius
              {filters.radiusKm && (
                <span className="ml-1 font-medium text-foreground">{filters.radiusKm} km</span>
              )}
            </label>
            <input
              type="range"
              min={50}
              max={5000}
              step={50}
              value={filters.radiusKm ?? 500}
              onChange={(e) => set("radiusKm", Number(e.target.value))}
              className="w-full accent-primary"
            />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>50 km</span>
              <span>5000 km</span>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

function StylePhysicalFilters({ filters }: { filters: SearchFilters }) {
  const navigate = useNavigate({ from: "/search" });

  function set<K extends keyof SearchFilters>(key: K, value: SearchFilters[K]) {
    navigate({ search: (p) => ({ ...p, [key]: value, page: 1 }), replace: true });
  }

  const { data: fightStyles = [] } = useQuery({
    queryKey: ["fight-styles", filters.sport],
    enabled: !!filters.sport,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data } = await supabase
        .from("fight_style_sports")
        .select("fight_styles(id, name, slug)")
        .eq("sport_slug", filters.sport!);
      return (data ?? [])
        .map((r: any) => r.fight_styles)
        .filter(Boolean)
        .sort((a: any, b: any) => a.name.localeCompare(b.name));
    },
  });

  function toggleStyle(slug: string) {
    const current = filters.fightStyles ?? [];
    const next = current.includes(slug)
      ? current.filter((s) => s !== slug)
      : [...current, slug];
    set("fightStyles", next.length ? next : undefined);
  }

  return (
    <section>
      <SectionHeader title="Style & Physical" />
      <div className="space-y-3">
        {fightStyles.length > 0 && (
          <div>
            <label className="mb-1.5 block text-xs text-muted-foreground">Fight styles</label>
            <div className="flex flex-wrap gap-1.5">
              {fightStyles.map((fs: any) => {
                const active = filters.fightStyles?.includes(fs.slug);
                return (
                  <button
                    key={fs.slug}
                    onClick={() => toggleStyle(fs.slug)}
                    className={cn(
                      "rounded-full border px-2.5 py-0.5 text-xs transition-colors",
                      active
                        ? "border-primary bg-primary/15 text-primary"
                        : "border-border bg-card text-muted-foreground hover:border-primary/50 hover:text-foreground"
                    )}
                  >
                    {fs.name}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        <div>
          <label className="mb-1.5 block text-xs text-muted-foreground">Stance</label>
          <select
            value={filters.stance ?? ""}
            onChange={(e) => set("stance", e.target.value || undefined)}
            className={inputClass}
          >
            <option value="">Any</option>
            <option value="orthodox">Orthodox</option>
            <option value="southpaw">Southpaw</option>
          </select>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="mb-1 block text-xs text-muted-foreground">Min height (cm)</label>
            <input
              type="number"
              value={filters.heightMinCm ?? ""}
              onChange={(e) =>
                set("heightMinCm", e.target.value ? Number(e.target.value) : undefined)
              }
              placeholder="—"
              className={smallInputClass}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-muted-foreground">Max height (cm)</label>
            <input
              type="number"
              value={filters.heightMaxCm ?? ""}
              onChange={(e) =>
                set("heightMaxCm", e.target.value ? Number(e.target.value) : undefined)
              }
              placeholder="—"
              className={smallInputClass}
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="mb-1 block text-xs text-muted-foreground">Min reach (cm)</label>
            <input
              type="number"
              value={filters.reachMinCm ?? ""}
              onChange={(e) =>
                set("reachMinCm", e.target.value ? Number(e.target.value) : undefined)
              }
              placeholder="—"
              className={smallInputClass}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-muted-foreground">Max reach (cm)</label>
            <input
              type="number"
              value={filters.reachMaxCm ?? ""}
              onChange={(e) =>
                set("reachMaxCm", e.target.value ? Number(e.target.value) : undefined)
              }
              placeholder="—"
              className={smallInputClass}
            />
          </div>
        </div>
      </div>
    </section>
  );
}

function VisibilityFilters({ filters }: { filters: SearchFilters }) {
  const navigate = useNavigate({ from: "/search" });

  function set<K extends keyof SearchFilters>(key: K, value: SearchFilters[K]) {
    navigate({ search: (p) => ({ ...p, [key]: value, page: 1 }), replace: true });
  }

  return (
    <section>
      <SectionHeader title="Visibility" />
      <div>
        <label className="mb-1.5 block text-xs text-muted-foreground">
          Min Instagram followers
          {filters.minInstagramFollowers && (
            <span className="ml-1 font-medium text-foreground">
              {filters.minInstagramFollowers.toLocaleString()}+
            </span>
          )}
        </label>
        <input
          type="range"
          min={0}
          max={1000000}
          step={10000}
          value={filters.minInstagramFollowers ?? 0}
          onChange={(e) => {
            const v = Number(e.target.value);
            set("minInstagramFollowers", v > 0 ? v : undefined);
          }}
          className="w-full accent-primary"
        />
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>Any</span>
          <span>1M+</span>
        </div>
      </div>
    </section>
  );
}
