import { useMemo, useRef, useState, useEffect } from "react";
import { useNavigate } from "@tanstack/react-router";
import { ChevronDown, Globe, X } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  COUNTRIES,
  CONTINENTS,
  type ContinentId,
  resolveLocationCountries,
} from "@/lib/geo/countries";
import type { SearchFilters } from "@/lib/search-schema";

export function LocationRegionFilters({ filters }: { filters: SearchFilters }) {
  const navigate = useNavigate({ from: "/search" });
  const [countryQuery, setCountryQuery] = useState("");
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  const activeCountries = resolveLocationCountries(filters.countries, filters.continent);
  const selectedSet = useMemo(
    () => new Set(filters.countries ?? []),
    [filters.countries]
  );

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const filteredCountries = useMemo(() => {
    const q = countryQuery.trim().toLowerCase();
    if (!q) return COUNTRIES.slice(0, 40);
    return COUNTRIES.filter((c) => c.toLowerCase().includes(q)).slice(0, 40);
  }, [countryQuery]);

  function patchLocation(
    patch: Partial<Pick<SearchFilters, "countries" | "continent">>
  ) {
    navigate({
      search: (p) => {
        const next = { ...p, page: 1 };
        if ("continent" in patch) {
          if (patch.continent) next.continent = patch.continent;
          else delete next.continent;
        }
        if ("countries" in patch) {
          if (patch.countries?.length) next.countries = patch.countries;
          else delete next.countries;
        }
        return next;
      },
      replace: true,
    });
  }

  function selectContinent(id: ContinentId) {
    if (filters.continent === id) {
      patchLocation({ continent: undefined });
      return;
    }
    patchLocation({ continent: id, countries: undefined });
    setOpen(false);
  }

  function toggleCountry(country: string) {
    const current = filters.countries ?? [];
    const next = current.includes(country)
      ? current.filter((c) => c !== country)
      : [...current, country];
    patchLocation({
      continent: undefined,
      countries: next.length ? next : undefined,
    });
  }

  function clearRegions() {
    patchLocation({ continent: undefined, countries: undefined });
    setCountryQuery("");
    setOpen(false);
  }

  const summary = filters.continent
    ? CONTINENTS.find((c) => c.id === filters.continent)?.label
    : activeCountries?.length
      ? `${activeCountries.length} ${activeCountries.length === 1 ? "country" : "countries"}`
      : null;

  return (
    <div className="space-y-3">
      <div>
        <label className="mb-1.5 flex items-center gap-1.5 text-xs text-muted-foreground">
          <Globe className="h-3 w-3" />
          Region
        </label>
        <div className="flex flex-wrap gap-1.5">
          {CONTINENTS.map((continent) => {
            const active = filters.continent === continent.id;
            return (
              <button
                key={continent.id}
                type="button"
                onClick={() => selectContinent(continent.id)}
                className={cn(
                  "rounded-full border px-2.5 py-1 text-[11px] font-medium transition-all duration-150",
                  active
                    ? "border-primary/60 bg-primary/15 text-primary"
                    : "border-white/[0.08] bg-white/[0.04] text-muted-foreground hover:border-primary/20 hover:text-foreground"
                )}
              >
                {continent.label}
              </button>
            );
          })}
        </div>
      </div>

      <div ref={wrapperRef} className="relative">
        <label className="mb-1.5 block text-xs text-muted-foreground">Countries</label>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className={cn(
            "flex w-full items-center justify-between rounded-lg border border-white/[0.08] bg-white/[0.04] px-3 py-2 text-left text-sm transition-colors",
            "focus-visible:border-primary/40 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary/20",
            summary ? "text-foreground" : "text-muted-foreground/60"
          )}
        >
          <span className="truncate">{summary ?? "Select countries…"}</span>
          <ChevronDown className={cn("h-4 w-4 shrink-0 opacity-60 transition-transform", open && "rotate-180")} />
        </button>

        {open && (
          <div className="absolute z-50 mt-1.5 w-full overflow-hidden rounded-lg border border-white/[0.08] bg-sidebar/95 shadow-[var(--shadow-elevated)] backdrop-blur-sm">
            <div className="border-b border-white/[0.06] p-2">
              <input
                type="text"
                value={countryQuery}
                onChange={(e) => setCountryQuery(e.target.value)}
                placeholder="Search countries…"
                autoComplete="off"
                className="w-full rounded-md border border-white/[0.08] bg-white/[0.04] px-2.5 py-1.5 text-sm text-foreground placeholder:text-muted-foreground/50 focus-visible:border-primary/40 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary/20"
              />
            </div>
            <ul className="max-h-52 overflow-y-auto scrollbar-thin py-1">
              {filteredCountries.length === 0 ? (
                <li className="px-3 py-2 text-sm text-muted-foreground">No matches</li>
              ) : (
                filteredCountries.map((country) => {
                  const checked = selectedSet.has(country);
                  return (
                    <li key={country}>
                      <button
                        type="button"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => toggleCountry(country)}
                        className={cn(
                          "flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm transition-colors hover:bg-white/[0.04]",
                          checked && "bg-primary/5 text-foreground"
                        )}
                      >
                        <span
                          className={cn(
                            "flex h-4 w-4 shrink-0 items-center justify-center rounded border",
                            checked
                              ? "border-primary bg-primary text-primary-foreground"
                              : "border-input bg-background"
                          )}
                        >
                          {checked && (
                            <svg viewBox="0 0 12 12" className="h-2.5 w-2.5" fill="none">
                              <path
                                d="M2 6l2.5 2.5L10 3"
                                stroke="currentColor"
                                strokeWidth="1.75"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              />
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
      </div>

      {filters.countries && filters.countries.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {filters.countries.map((country) => (
            <span
              key={country}
              className="inline-flex items-center gap-1 rounded-full border border-primary/60 bg-primary/15 px-2.5 py-1 text-[11px] font-medium text-primary"
            >
              {country}
              <button
                type="button"
                onClick={() => toggleCountry(country)}
                className="rounded-full p-0.5 opacity-70 hover:opacity-100 transition-opacity"
                aria-label={`Remove ${country}`}
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
