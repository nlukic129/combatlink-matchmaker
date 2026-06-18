import { useRef, useState, useEffect } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Filter, X } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { DatePicker } from "@/components/ui/date-picker";
import { LocationRegionFilters } from "@/components/search/location-region-filters";
import { COUNTRIES } from "@/lib/geo/countries";
import { getGeoapifyKey } from "@/lib/supabase-public-env";
import { useCurrency } from "@/contexts/currency-context";
import type { SearchFilters } from "@/lib/search-schema";

// ── Shared input style ────────────────────────────────────────────────────────
const inputClass =
  "w-full rounded-lg border border-white/[0.08] bg-white/[0.04] px-3 py-2 text-sm text-foreground transition-colors placeholder:text-muted-foreground/50 focus-visible:border-primary/40 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary/20";

// ── Primitive sub-components ──────────────────────────────────────────────────

function SectionHeader({
  title,
  activeCount = 0,
  onClear,
}: {
  title: string;
  activeCount?: number;
  onClear?: () => void;
}) {
  return (
    <div className="mb-4 flex items-center justify-between">
      <div className="flex items-center gap-2">
        <span
          className={cn(
            "h-1.5 w-1.5 flex-shrink-0 rounded-full transition-all duration-300",
            activeCount > 0
              ? "bg-primary [box-shadow:0_0_6px_oklch(0.55_0.24_25/70%)]"
              : "bg-white/20"
          )}
        />
        <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
          {title}
        </span>
        {activeCount > 0 && (
          <span className="flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-primary/15 px-1.5 text-[9px] font-bold tabular-nums text-primary">
            {activeCount}
          </span>
        )}
      </div>
      {activeCount > 0 && onClear && (
        <button
          type="button"
          onClick={onClear}
          className="text-[10px] text-muted-foreground/60 transition-colors hover:text-primary"
        >
          Clear
        </button>
      )}
    </div>
  );
}

function FilterLabel({
  children,
  hint,
}: {
  children: React.ReactNode;
  hint?: React.ReactNode;
}) {
  return (
    <div className="mb-2 flex items-center justify-between">
      <span className="text-[11px] text-muted-foreground">{children}</span>
      {hint !== undefined && (
        <span className="text-[11px] font-semibold tabular-nums text-foreground">{hint}</span>
      )}
    </div>
  );
}

function FilterToggle({
  options,
  value,
  onChange,
}: {
  options: Array<{ value: string; label: string }>;
  value: string | undefined;
  onChange: (v: string | undefined) => void;
}) {
  const current = value ?? "";
  return (
    <div className="flex gap-0.5 rounded-lg border border-white/[0.06] bg-white/[0.03] p-0.5">
      {options.map((opt) => {
        const active = current === opt.value;
        return (
          <button
            key={opt.value || "__any__"}
            type="button"
            onClick={() => onChange(opt.value || undefined)}
            className={cn(
              "flex-1 rounded-[5px] py-1.5 text-[10px] font-semibold uppercase tracking-[0.06em] transition-all duration-150",
              active
                ? "text-primary [box-shadow:inset_0_0_0_1px_oklch(0.55_0.24_25/40%),_0_0_8px_oklch(0.55_0.24_25/15%)] bg-primary/10"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

function NumInput({
  value,
  onChange,
  placeholder = "—",
  min = 0,
}: {
  value?: number;
  onChange: (v: number | undefined) => void;
  placeholder?: string;
  min?: number;
}) {
  const [local, setLocal] = useState(value !== undefined ? String(value) : "");

  useEffect(() => {
    setLocal(value !== undefined ? String(value) : "");
  }, [value]);

  return (
    <input
      type="number"
      inputMode="numeric"
      min={min}
      value={local}
      onChange={(e) => setLocal(e.target.value)}
      onBlur={() => onChange(local !== "" ? Number(local) : undefined)}
      placeholder={placeholder}
      className="w-full rounded-lg border border-white/[0.08] bg-white/[0.04] px-3 py-2 text-center text-sm text-foreground transition-colors placeholder:text-muted-foreground/40 focus-visible:border-primary/40 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary/20 [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
    />
  );
}

// ── Section: Booking ──────────────────────────────────────────────────────────

function BookingFilters({ filters }: { filters: SearchFilters }) {
  const navigate = useNavigate({ from: "/search" });

  function set<K extends keyof SearchFilters>(key: K, value: SearchFilters[K]) {
    navigate({ search: (p) => ({ ...p, [key]: value, page: 1 }), replace: true });
  }

  const activeCount = [
    !!filters.readyToFightOn,
    !!filters.shortNotice,
    !!filters.promotionalStatus,
    filters.purseMax !== undefined,
    filters.maxPrepWeeks !== undefined,
  ].filter(Boolean).length;

  function clearSection() {
    navigate({
      search: (p) => ({
        ...p,
        readyToFightOn: undefined,
        shortNotice: undefined,
        promotionalStatus: undefined,
        purseMax: undefined,
        maxPrepWeeks: undefined,
        page: 1,
      }),
      replace: true,
    });
  }

  const { currency, setCurrency, toDisplay, toUsd } = useCurrency();
  const [localPrep, setLocalPrep] = useState(filters.maxPrepWeeks ?? 16);
  const [purseInput, setPurseInput] = useState(() =>
    filters.purseMax != null ? String(Math.round(toDisplay(filters.purseMax))) : ""
  );
  const [sliderVal, setSliderVal] = useState(() => {
    const max = Math.round(toDisplay(100_000));
    return filters.purseMax != null ? Math.min(Math.round(toDisplay(filters.purseMax)), max) : max;
  });

  useEffect(() => { setLocalPrep(filters.maxPrepWeeks ?? 16); }, [filters.maxPrepWeeks]);

  useEffect(() => {
    const max = Math.round(toDisplay(100_000));
    const display = filters.purseMax != null ? Math.round(toDisplay(filters.purseMax)) : null;
    setPurseInput(display != null ? String(display) : "");
    setSliderVal(display != null ? Math.min(display, max) : max);
  }, [filters.purseMax, currency]);

  function commitPurse(raw: string) {
    const max = Math.round(toDisplay(100_000));
    const num = parseFloat(raw.replace(/[^0-9.]/g, ""));
    if (!raw.trim() || isNaN(num)) {
      set("purseMax", undefined);
      setSliderVal(max);
    } else {
      set("purseMax", Math.round(toUsd(num)));
      setSliderVal(Math.min(Math.round(num), max));
    }
  }

  return (
    <section>
      <SectionHeader title="Booking" activeCount={activeCount} onClear={clearSection} />
      <div className="space-y-4">

        <div>
          <FilterLabel>Ready to fight on</FilterLabel>
          <DatePicker
            value={filters.readyToFightOn}
            onChange={(v) => set("readyToFightOn", v)}
            minDate={new Date()}
          />
        </div>

        <div className="flex items-center justify-between py-0.5">
          <span className="text-[11px] text-muted-foreground">Short notice only</span>
          <Switch
            checked={filters.shortNotice ?? false}
            onCheckedChange={(v) => set("shortNotice", v || undefined)}
          />
        </div>

        <div>
          <FilterLabel>Promotional status</FilterLabel>
          <FilterToggle
            options={[
              { value: "", label: "Any" },
              { value: "open", label: "Free agent" },
              { value: "exclusive", label: "Exclusive" },
            ]}
            value={filters.promotionalStatus}
            onChange={(v) => set("promotionalStatus", v)}
          />
        </div>

        <div>
          <div className="mb-1.5 flex items-center justify-between">
            <FilterLabel>Max budget</FilterLabel>
            <div className="flex items-center rounded-md border border-white/[0.08] bg-white/[0.04] p-0.5">
              {(["USD", "EUR"] as const).map(c => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setCurrency(c)}
                  className={cn(
                    "rounded px-1.5 py-0.5 text-[10px] font-semibold transition-all",
                    currency === c
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  {c}
                </button>
              ))}
            </div>
          </div>
          <div className="relative">
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground/60">
              {currency === "EUR" ? "€" : "$"}
            </span>
            <input
              type="number"
              inputMode="numeric"
              min={0}
              placeholder="No limit"
              value={purseInput}
              onChange={e => {
                setPurseInput(e.target.value);
                const num = parseFloat(e.target.value.replace(/[^0-9.]/g, ""));
                const max = Math.round(toDisplay(100_000));
                if (!isNaN(num)) setSliderVal(Math.min(Math.round(num), max));
              }}
              onBlur={e => commitPurse(e.target.value)}
              onKeyDown={e => e.key === "Enter" && commitPurse(purseInput)}
              className={cn(inputClass, "pl-7 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none")}
            />
          </div>
          <div className="mt-3">
            <Slider
              min={0}
              max={Math.round(toDisplay(100_000))}
              step={500}
              value={[sliderVal]}
              onValueChange={([v]) => {
                const max = Math.round(toDisplay(100_000));
                setSliderVal(v);
                setPurseInput(v >= max ? "" : String(v));
              }}
              onValueCommit={([v]) => {
                const max = Math.round(toDisplay(100_000));
                if (v >= max) {
                  set("purseMax", undefined);
                } else {
                  set("purseMax", Math.round(toUsd(v)));
                }
              }}
            />
            <div className="mt-1 flex justify-between text-[10px] text-muted-foreground/50">
              <span>{currency === "EUR" ? "€0" : "$0"}</span>
              <span>No limit</span>
            </div>
          </div>
        </div>

        <div>
          <FilterLabel hint={localPrep < 16 ? `${localPrep}w` : undefined}>
            Max prep time
          </FilterLabel>
          <Slider
            min={1}
            max={16}
            step={1}
            value={[localPrep]}
            onValueChange={([v]) => setLocalPrep(v)}
            onValueCommit={([v]) => set("maxPrepWeeks", v < 16 ? v : undefined)}
          />
          <div className="mt-1 flex justify-between text-[10px] text-muted-foreground/50">
            <span>1 week</span>
            <span>16w+</span>
          </div>
        </div>

      </div>
    </section>
  );
}

// ── Section: Experience ───────────────────────────────────────────────────────

function ExperienceFilters({ filters }: { filters: SearchFilters }) {
  const navigate = useNavigate({ from: "/search" });

  function set<K extends keyof SearchFilters>(key: K, value: SearchFilters[K]) {
    navigate({ search: (p) => ({ ...p, [key]: value, page: 1 }), replace: true });
  }

  const activeCount = [
    !!filters.level,
    filters.minWins !== undefined,
    filters.maxLosses !== undefined,
    filters.maxTotalFights !== undefined,
  ].filter(Boolean).length;

  function clearSection() {
    navigate({
      search: (p) => ({
        ...p,
        level: undefined,
        minWins: undefined,
        maxLosses: undefined,
        maxTotalFights: undefined,
        page: 1,
      }),
      replace: true,
    });
  }

  return (
    <section>
      <SectionHeader title="Experience" activeCount={activeCount} onClear={clearSection} />
      <div className="space-y-4">

        <div>
          <FilterLabel>Level</FilterLabel>
          <FilterToggle
            options={[
              { value: "", label: "Any" },
              { value: "amateur", label: "Amateur" },
              { value: "pro", label: "Pro" },
            ]}
            value={filters.level}
            onChange={(v) => set("level", v as "amateur" | "pro" | undefined)}
          />
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div>
            <FilterLabel>Min wins</FilterLabel>
            <NumInput value={filters.minWins} onChange={(v) => set("minWins", v)} />
          </div>
          <div>
            <FilterLabel>Max losses</FilterLabel>
            <NumInput value={filters.maxLosses} onChange={(v) => set("maxLosses", v)} />
          </div>
        </div>

        <div>
          <FilterLabel>Max total fights</FilterLabel>
          <NumInput
            value={filters.maxTotalFights}
            onChange={(v) => set("maxTotalFights", v)}
            min={1}
          />
        </div>

      </div>
    </section>
  );
}

// ── Section: Location ─────────────────────────────────────────────────────────

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

  useEffect(() => {
    setQuery(filters.cityName ?? "");
  }, [filters.cityName]);

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
    const geoapifyKey = getGeoapifyKey();
    if (!value.trim() || !geoapifyKey) {
      setSuggestions([]);
      setOpen(false);
      if (!value.trim()) clearCity();
      return;
    }
    debounceRef.current = setTimeout(async () => {
      const url =
        `https://api.geoapify.com/v1/geocode/autocomplete` +
        `?text=${encodeURIComponent(value)}&type=city&limit=6&apiKey=${geoapifyKey}`;
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

  function clearSection() {
    setQuery("");
    setSuggestions([]);
    setOpen(false);
    setOriginQuery("");
    navigate({
      search: (p) => {
        const next = { ...p };
        delete next.cityName;
        delete next.cityLat;
        delete next.cityLng;
        delete next.radiusKm;
        delete next.countries;
        delete next.continent;
        delete next.originCountries;
        return { ...next, page: 1 };
      },
      replace: true,
    });
  }

  const activeCount = [
    !!filters.cityName,
    !!filters.continent,
    (filters.countries ?? []).length > 0,
    (filters.originCountries ?? []).length > 0,
  ].filter(Boolean).length;

  const [originQuery, setOriginQuery] = useState("");
  const [originOpen, setOriginOpen] = useState(false);
  const originWrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (originWrapperRef.current && !originWrapperRef.current.contains(e.target as Node)) {
        setOriginOpen(false);
      }
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const filteredOriginCountries = COUNTRIES.filter((c) => {
    const q = originQuery.trim().toLowerCase();
    return !q || c.toLowerCase().includes(q);
  }).slice(0, 40);

  const originSelectedSet = new Set(filters.originCountries ?? []);

  function toggleOriginCountry(country: string) {
    const current = filters.originCountries ?? [];
    const next = current.includes(country)
      ? current.filter((c) => c !== country)
      : [...current, country];
    navigate({
      search: (p) => ({
        ...p,
        originCountries: next.length ? next : undefined,
        page: 1,
      }),
      replace: true,
    });
  }

  const [localRadius, setLocalRadius] = useState(filters.radiusKm ?? 500);
  useEffect(() => { setLocalRadius(filters.radiusKm ?? 500); }, [filters.radiusKm]);

  return (
    <section>
      <SectionHeader title="Location" activeCount={activeCount} onClear={clearSection} />
      <div className="space-y-4">

        <LocationRegionFilters filters={filters} />

        <div ref={wrapperRef} className="relative">
          <FilterLabel>City</FilterLabel>
          <div className="relative">
            <input
              type="text"
              value={query}
              onChange={(e) => onInputChange(e.target.value)}
              onFocus={() => suggestions.length > 0 && setOpen(true)}
              placeholder="Search city…"
              autoComplete="off"
              className={cn(inputClass, "pr-8")}
            />
            {query && (
              <button
                onClick={clearCity}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground/60 transition-colors hover:text-foreground"
                aria-label="Clear city"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {open && (
            <ul className="absolute z-50 mt-1.5 w-full overflow-hidden rounded-lg border border-white/[0.08] bg-sidebar/95 shadow-[var(--shadow-elevated)] backdrop-blur-sm">
              {suggestions.map((s) => (
                <li key={s.place_id}>
                  <button
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => selectSuggestion(s)}
                    className="w-full px-3 py-2 text-left text-sm text-foreground transition-colors hover:bg-white/[0.04]"
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
            <FilterLabel hint={`${localRadius} km`}>Radius</FilterLabel>
            <Slider
              min={50}
              max={5000}
              step={50}
              value={[localRadius]}
              onValueChange={([v]) => setLocalRadius(v)}
              onValueCommit={([v]) => set("radiusKm", v)}
            />
            <div className="mt-1 flex justify-between text-[10px] text-muted-foreground/50">
              <span>50 km</span>
              <span>5,000 km</span>
            </div>
          </div>
        )}

        {/* Country of origin */}
        <div ref={originWrapperRef} className="relative">
          <FilterLabel>Country of origin</FilterLabel>
          <button
            type="button"
            onClick={() => setOriginOpen((v) => !v)}
            className={cn(
              "flex w-full items-center justify-between rounded-lg border border-white/[0.08] bg-white/[0.04] px-3 py-2 text-left text-sm transition-colors",
              "focus-visible:border-primary/40 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary/20",
              (filters.originCountries?.length ?? 0) > 0 ? "text-foreground" : "text-muted-foreground/60"
            )}
          >
            <span className="truncate">
              {(filters.originCountries?.length ?? 0) > 0
                ? `${filters.originCountries!.length} ${filters.originCountries!.length === 1 ? "country" : "countries"}`
                : "Select countries…"}
            </span>
            <X
              className={cn(
                "h-3.5 w-3.5 shrink-0 opacity-50 transition-opacity",
                (filters.originCountries?.length ?? 0) === 0 && "invisible"
              )}
              onClick={(e) => {
                e.stopPropagation();
                navigate({ search: (p) => ({ ...p, originCountries: undefined, page: 1 }), replace: true });
              }}
            />
          </button>

          {originOpen && (
            <div className="absolute z-50 mt-1.5 w-full overflow-hidden rounded-lg border border-white/[0.08] bg-sidebar/95 shadow-[var(--shadow-elevated)] backdrop-blur-sm">
              <div className="border-b border-white/[0.06] p-2">
                <input
                  type="text"
                  value={originQuery}
                  onChange={(e) => setOriginQuery(e.target.value)}
                  placeholder="Search countries…"
                  autoComplete="off"
                  className="w-full rounded-md border border-white/[0.08] bg-white/[0.04] px-2.5 py-1.5 text-sm text-foreground placeholder:text-muted-foreground/50 focus-visible:border-primary/40 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary/20"
                />
              </div>
              <ul className="max-h-52 overflow-y-auto scrollbar-thin py-1">
                {filteredOriginCountries.length === 0 ? (
                  <li className="px-3 py-2 text-sm text-muted-foreground">No matches</li>
                ) : (
                  filteredOriginCountries.map((country) => {
                    const checked = originSelectedSet.has(country);
                    return (
                      <li key={country}>
                        <button
                          type="button"
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => toggleOriginCountry(country)}
                          className={cn(
                            "flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm transition-colors hover:bg-white/[0.04]",
                            checked && "bg-primary/5 text-foreground"
                          )}
                        >
                          <span
                            className={cn(
                              "flex h-4 w-4 shrink-0 items-center justify-center rounded border",
                              checked ? "border-primary bg-primary text-primary-foreground" : "border-input bg-background"
                            )}
                          >
                            {checked && (
                              <svg viewBox="0 0 12 12" className="h-2.5 w-2.5" fill="none">
                                <path d="M2 6l2.5 2.5L10 3" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
                              </svg>
                            )}
                          </span>
                          <span>{country}</span>
                        </button>
                      </li>
                    );
                  })
                )}
              </ul>
            </div>
          )}

          {(filters.originCountries?.length ?? 0) > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {filters.originCountries!.map((country) => (
                <span
                  key={country}
                  className="inline-flex items-center gap-1 rounded-full border border-primary/60 bg-primary/15 px-2.5 py-1 text-[11px] font-medium text-primary"
                >
                  {country}
                  <button
                    type="button"
                    onClick={() => toggleOriginCountry(country)}
                    className="rounded-full p-0.5 opacity-70 hover:opacity-100 transition-opacity"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>

      </div>
    </section>
  );
}

// ── Section: Style & Physical ─────────────────────────────────────────────────

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
        .select("fight_styles(id, label, slug)")
        .eq("sport_slug", filters.sport!);
      return (data ?? [])
        .map((r: any) => r.fight_styles)
        .filter(Boolean)
        .sort((a: any, b: any) => a.label.localeCompare(b.label));
    },
  });

  function toggleStyle(slug: string) {
    const current = filters.fightStyles ?? [];
    const next = current.includes(slug)
      ? current.filter((s) => s !== slug)
      : [...current, slug];
    set("fightStyles", next.length ? next : undefined);
  }

  const activeCount = [
    (filters.fightStyles ?? []).length > 0,
    !!filters.stance,
    filters.heightMinCm !== undefined || filters.heightMaxCm !== undefined,
    filters.reachMinCm !== undefined || filters.reachMaxCm !== undefined,
  ].filter(Boolean).length;

  function clearSection() {
    navigate({
      search: (p) => ({
        ...p,
        fightStyles: undefined,
        stance: undefined,
        heightMinCm: undefined,
        heightMaxCm: undefined,
        reachMinCm: undefined,
        reachMaxCm: undefined,
        page: 1,
      }),
      replace: true,
    });
  }

  return (
    <section>
      <SectionHeader title="Style & Physical" activeCount={activeCount} onClear={clearSection} />
      <div className="space-y-4">

        {fightStyles.length > 0 && (
          <div>
            <FilterLabel>Fight styles</FilterLabel>
            <div className="flex flex-wrap gap-1.5">
              {fightStyles.map((fs: any) => {
                const active = filters.fightStyles?.includes(fs.slug);
                return (
                  <button
                    key={fs.slug}
                    type="button"
                    onClick={() => toggleStyle(fs.slug)}
                    className={cn(
                      "rounded-full border px-3 py-1 text-[11px] font-medium transition-all duration-150",
                      active
                        ? "border-primary/60 bg-primary/15 text-primary"
                        : "border-white/[0.08] bg-white/[0.04] text-muted-foreground hover:border-primary/20 hover:text-foreground"
                    )}
                  >
                    {fs.label}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        <div>
          <FilterLabel>Stance</FilterLabel>
          <FilterToggle
            options={[
              { value: "", label: "Any" },
              { value: "orthodox", label: "Orthodox" },
              { value: "southpaw", label: "Southpaw" },
            ]}
            value={filters.stance}
            onChange={(v) => set("stance", v)}
          />
        </div>

        <div>
          <FilterLabel>Height (cm)</FilterLabel>
          <div className="grid grid-cols-2 gap-2">
            <NumInput
              value={filters.heightMinCm}
              onChange={(v) => set("heightMinCm", v)}
              placeholder="Min"
            />
            <NumInput
              value={filters.heightMaxCm}
              onChange={(v) => set("heightMaxCm", v)}
              placeholder="Max"
            />
          </div>
        </div>

        <div>
          <FilterLabel>Reach (cm)</FilterLabel>
          <div className="grid grid-cols-2 gap-2">
            <NumInput
              value={filters.reachMinCm}
              onChange={(v) => set("reachMinCm", v)}
              placeholder="Min"
            />
            <NumInput
              value={filters.reachMaxCm}
              onChange={(v) => set("reachMaxCm", v)}
              placeholder="Max"
            />
          </div>
        </div>

      </div>
    </section>
  );
}

// ── Section: Visibility ───────────────────────────────────────────────────────

function VisibilityFilters({ filters }: { filters: SearchFilters }) {
  const navigate = useNavigate({ from: "/search" });

  function set<K extends keyof SearchFilters>(key: K, value: SearchFilters[K]) {
    navigate({ search: (p) => ({ ...p, [key]: value, page: 1 }), replace: true });
  }

  const [localIg, setLocalIg] = useState(filters.minInstagramFollowers ?? 0);
  useEffect(() => { setLocalIg(filters.minInstagramFollowers ?? 0); }, [filters.minInstagramFollowers]);

  const activeCount = [localIg > 0].filter(Boolean).length;

  function clearSection() {
    setLocalIg(0);
    navigate({
      search: (p) => ({
        ...p,
        minInstagramFollowers: undefined,
        page: 1,
      }),
      replace: true,
    });
  }

  return (
    <section>
      <SectionHeader title="Visibility" activeCount={activeCount} onClear={clearSection} />
      <div>
        <FilterLabel hint={localIg > 0 ? `${localIg.toLocaleString()}+` : undefined}>
          Min Instagram followers
        </FilterLabel>
        <Slider
          min={0}
          max={1000000}
          step={10000}
          value={[localIg]}
          onValueChange={([v]) => setLocalIg(v)}
          onValueCommit={([v]) => set("minInstagramFollowers", v > 0 ? v : undefined)}
        />
        <div className="mt-1 flex justify-between text-[10px] text-muted-foreground/50">
          <span>Any</span>
          <span>1M+</span>
        </div>
      </div>
    </section>
  );
}

// ── Main export ───────────────────────────────────────────────────────────────

export function SearchSidebar({
  filters,
  disabled = false,
}: {
  filters: SearchFilters;
  disabled?: boolean;
}) {
  const navigate = useNavigate({ from: "/search" });

  const totalActive = [
    !!filters.readyToFightOn,
    !!filters.shortNotice,
    !!filters.promotionalStatus,
    filters.purseMax !== undefined,
    filters.maxPrepWeeks !== undefined,
    !!filters.level,
    filters.minWins !== undefined,
    filters.maxLosses !== undefined,
    filters.maxTotalFights !== undefined,
    !!filters.cityName,
    !!filters.continent,
    (filters.countries ?? []).length > 0,
    (filters.fightStyles ?? []).length > 0,
    !!filters.stance,
    filters.heightMinCm !== undefined,
    filters.heightMaxCm !== undefined,
    filters.reachMinCm !== undefined,
    filters.reachMaxCm !== undefined,
    (filters.minInstagramFollowers ?? 0) > 0,
    (filters.originCountries ?? []).length > 0,
  ].filter(Boolean).length;

  function clearAll() {
    navigate({
      search: (p) => ({
        sport: p.sport,
        gender: p.gender,
        weightClasses: p.weightClasses,
        page: 1,
        view: p.view ?? "list",
      }),
      replace: true,
    });
  }

  if (disabled) {
    return (
      <aside className="hidden w-[300px] shrink-0 border-r border-white/[0.06] bg-sidebar/40 lg:flex flex-col" />
    );
  }

  return (
    <aside className="hidden w-[300px] shrink-0 flex-col overflow-y-auto border-r border-white/[0.06] bg-sidebar/40 scrollbar-thin lg:flex">

      {/* Header */}
      <div className="sticky top-0 z-10 flex items-center justify-between border-b border-white/[0.06] bg-sidebar/90 px-5 py-3.5 backdrop-blur-sm">
        <div className="flex items-center gap-2.5">
          <Filter className="h-3.5 w-3.5 text-primary" />
          <span className="text-sm font-semibold text-foreground">Filters</span>
          {totalActive > 0 && (
            <span className="flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-primary/15 px-1.5 text-[9px] font-bold tabular-nums text-primary">
              {totalActive}
            </span>
          )}
        </div>
        {totalActive > 0 && (
          <button
            type="button"
            onClick={clearAll}
            className="text-[10px] font-medium text-muted-foreground/60 transition-colors hover:text-primary"
          >
            Clear all
          </button>
        )}
      </div>

      {/* Filter sections */}
      <div className="flex-1 p-5">
        <div className="space-y-6">
          <BookingFilters filters={filters} />
          <div className="border-t border-white/[0.05]" />
          <ExperienceFilters filters={filters} />
          <div className="border-t border-white/[0.05]" />
          <LocationFilters filters={filters} />
          <div className="border-t border-white/[0.05]" />
          <StylePhysicalFilters filters={filters} />
          <div className="border-t border-white/[0.05]" />
          <VisibilityFilters filters={filters} />
        </div>
      </div>

    </aside>
  );
}
