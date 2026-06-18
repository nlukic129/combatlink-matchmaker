import { useState, useEffect } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, Check, Loader2, Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { searchLaunchViewTransition } from "@/lib/nav-transitions";
import { sportMark } from "@/lib/sport-display";
import { useSportsCatalog } from "@/hooks/use-sports-catalog";
import { Button } from "@/components/ui/button";
import { WireframeGlobe } from "@/components/search/wireframe-globe";
import type { SearchSetupParams } from "@/lib/search-schema";

const GENDERS = [
  { value: "male" as const, label: "Male" },
  { value: "female" as const, label: "Female" },
];

const PRIMARY_SPORT_SLUGS = new Set(["mma", "boxing", "kickboxing"]);

export function SearchSetup({ params }: { params: SearchSetupParams }) {
  const navigate = useNavigate({ from: "/search/setup" });
  const { data: sports = [], isLoading: sportsLoading } = useSportsCatalog();

  const [sport, setSport] = useState(params.sport ?? "");
  const [gender, setGender] = useState<"male" | "female" | "">(params.gender ?? "");
  const [weightClasses, setWeightClasses] = useState<number[]>(params.weightClasses ?? []);

  useEffect(() => {
    setSport(params.sport ?? "");
    setGender(params.gender ?? "");
    setWeightClasses(params.weightClasses ?? []);
  }, [params.sport, params.gender, params.weightClasses]);

  const readyForWeights = !!sport && !!gender;
  const canSearch = readyForWeights;

  const primarySports = sports.filter((s) => PRIMARY_SPORT_SLUGS.has(s.slug));
  const otherSports = sports.filter((s) => !PRIMARY_SPORT_SLUGS.has(s.slug));

  const { data: classes = [], isLoading: weightsLoading } = useQuery({
    queryKey: ["weight-classes", sport, gender],
    enabled: readyForWeights,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data } = await supabase
        .from("weight_classes")
        .select("id, name, limit_kg")
        .eq("sport_slug", sport)
        .eq("gender", gender)
        .eq("active", true)
        .order("sort_order");
      return data ?? [];
    },
  });

  function selectSport(slug: string) {
    setSport(slug);
    setGender("");
    setWeightClasses([]);
  }

  function selectGender(value: "male" | "female") {
    setGender(value);
    setWeightClasses([]);
  }

  function toggleWeightClass(id: number) {
    setWeightClasses((prev) =>
      prev.includes(id) ? prev.filter((w) => w !== id) : [...prev, id]
    );
  }

  function startSearch() {
    if (!canSearch) return;
    navigate({
      to: "/search",
      search: {
        sport,
        gender,
        weightClasses: weightClasses.length ? weightClasses : undefined,
        page: 1,
        view: "list",
      },
      viewTransition: searchLaunchViewTransition,
    });
  }

  return (
    <div className="search-setup search-content-vt relative flex h-[calc(100dvh-3.5rem)] min-h-0 flex-1 overflow-hidden">

      {/*
        Stage: mx-auto + max-w centers the form+globe unit horizontally.
        flex-col + justify-center + min-h-full centers content vertically.
        overflow-visible at lg lets the absolute globe bleed beyond stage edges.
        Globe inside stage so right:-30px follows stage right edge (not viewport).
      */}
      <div className="search-setup-stage relative z-10 mx-auto flex min-h-full w-full max-w-full flex-col justify-center overflow-y-auto overscroll-contain px-6 py-10 sm:px-10 sm:py-12 lg:max-w-[1020px] lg:overflow-visible lg:px-0 lg:py-0 xl:max-w-[1160px]">

        {/* Globe — absolute within stage */}
        <div className="search-setup-globe-accent pointer-events-none absolute z-0" aria-hidden>
          <WireframeGlobe />
        </div>

        {/* Form content */}
        <div className="relative z-10 w-full lg:w-[460px] lg:pl-10 xl:w-[500px] xl:pl-12">

          <header className="search-setup-header mb-8 lg:mb-10">
            <p className="search-setup-eyebrow">Global Matchmaking</p>
            <h1 className="search-setup-title mt-3">
              FIND YOUR<br />
              <span className="text-primary">FIGHTER</span>
            </h1>
          </header>

          <div className="search-setup-form space-y-6">

            {/* Step 1: Sport */}
            <section>
              <SectionLabel title="Sport" done={!!sport} />
              <div className="mt-3 space-y-3">
                {sportsLoading ? (
                  <p className="text-xs text-muted-foreground">Loading sports…</p>
                ) : (
                  <>
                    <div className="grid grid-cols-3 gap-3">
                      {primarySports.map(({ slug, label }) => (
                        <SportOption
                          key={slug}
                          slug={slug}
                          label={label}
                          active={sport === slug}
                          onSelect={() => selectSport(slug)}
                        />
                      ))}
                    </div>
                    {otherSports.length > 0 && (
                      <div className="grid grid-cols-1 gap-3">
                        {otherSports.map(({ slug, label }) => (
                          <SportOption
                            key={slug}
                            slug={slug}
                            label={label}
                            active={sport === slug}
                            onSelect={() => selectSport(slug)}
                            wide
                          />
                        ))}
                      </div>
                    )}
                  </>
                )}
              </div>
            </section>

            {/* Step 2: Gender */}
            <section
              className={cn(
                "overflow-hidden transition-all duration-300 ease-out",
                sport ? "max-h-32 opacity-100" : "max-h-0 opacity-0"
              )}
            >
              <SectionLabel title="Gender" done={!!gender} />
              <div className="mt-3 grid grid-cols-2 gap-2.5">
                {GENDERS.map(({ value, label }) => {
                  const active = gender === value;
                  return (
                    <button
                      key={value}
                      type="button"
                      onClick={() => selectGender(value)}
                      className={cn(
                        "search-setup-option rounded-xl border py-3 text-sm font-semibold uppercase tracking-[0.1em] transition-all duration-200",
                        active
                          ? "border-primary/50 bg-primary/10 text-foreground ring-1 ring-primary/25 [box-shadow:0_0_32px_oklch(0.55_0.24_25/18%)]"
                          : "border-white/[0.07] bg-white/[0.04] text-muted-foreground hover:border-primary/25 hover:text-foreground"
                      )}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            </section>

            {/* Step 3: Weight class */}
            <section
              className={cn(
                "overflow-hidden transition-all duration-300 ease-out",
                readyForWeights ? "max-h-64 opacity-100" : "max-h-0 opacity-0"
              )}
            >
              <SectionLabel title="Weight class" subtitle="Optional" done={weightClasses.length > 0} />
              {weightsLoading ? (
                <div className="mt-3 flex items-center gap-2 py-2 text-xs text-muted-foreground">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Loading…
                </div>
              ) : classes.length === 0 ? (
                <p className="mt-3 text-xs text-muted-foreground">
                  No weight classes for this selection.
                </p>
              ) : (
                <div className="mt-3 flex max-h-36 flex-wrap gap-1.5 overflow-y-auto scrollbar-thin pr-0.5">
                  <WeightChip
                    active={weightClasses.length === 0}
                    onClick={() => setWeightClasses([])}
                    label="All"
                  />
                  {classes.map((wc) => (
                    <WeightChip
                      key={wc.id}
                      active={weightClasses.includes(wc.id)}
                      onClick={() => toggleWeightClass(wc.id)}
                      label={wc.name}
                    />
                  ))}
                </div>
              )}
            </section>

            {/* Search CTA */}
            <div
              className={cn(
                "overflow-hidden transition-all duration-300 ease-out",
                canSearch ? "max-h-20 opacity-100" : "max-h-0 opacity-0"
              )}
            >
              <Button
                className="search-setup-cta h-12 w-full text-xs font-semibold uppercase tracking-widest"
                onClick={startSearch}
              >
                <Search className="h-4 w-4" />
                Search Fighters
                <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Globe caption — bottom right, desktop only */}
      <p className="search-setup-globe-label hidden lg:block" aria-hidden>
        Global fighter network
      </p>
    </div>
  );
}

function SportOption({
  slug,
  label,
  active,
  onSelect,
  wide = false,
}: {
  slug: string;
  label: string;
  active: boolean;
  onSelect: () => void;
  wide?: boolean;
}) {
  const mark = sportMark(slug, label);

  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "search-setup-option relative flex flex-col items-center gap-2.5 rounded-xl border transition-all duration-200",
        wide ? "px-6 py-5" : "px-3 py-5",
        active
          ? "border-primary/50 bg-primary/10 ring-1 ring-primary/25 [box-shadow:0_0_32px_oklch(0.55_0.24_25/20%),inset_0_0_0_1px_oklch(0.55_0.24_25/12%)]"
          : "border-white/[0.07] bg-white/[0.04] hover:border-primary/25 hover:bg-primary/[0.07]"
      )}
    >
      <span
        className={cn(
          "font-display text-3xl leading-none tracking-widest",
          active ? "text-primary" : "text-foreground/60"
        )}
      >
        {mark}
      </span>
      <span
        className={cn(
          "text-center text-[10px] font-semibold uppercase tracking-[0.12em]",
          wide && "text-[11px] tracking-[0.1em]",
          active ? "text-foreground" : "text-muted-foreground"
        )}
      >
        {label}
      </span>
      {active && (
        <span className="absolute right-2.5 top-2.5 flex h-4 w-4 items-center justify-center rounded-full bg-primary [box-shadow:0_0_10px_oklch(0.55_0.24_25/55%)]">
          <Check className="h-2.5 w-2.5 text-primary-foreground" strokeWidth={3} />
        </span>
      )}
    </button>
  );
}

function SectionLabel({
  title,
  subtitle,
  done,
}: {
  title: string;
  subtitle?: string;
  done?: boolean;
}) {
  return (
    <div className="flex items-center gap-2">
      <span
        className={cn(
          "h-1.5 w-1.5 flex-shrink-0 rounded-full transition-colors duration-300",
          done
            ? "bg-primary [box-shadow:0_0_6px_oklch(0.55_0.24_25/70%)]"
            : "bg-white/20"
        )}
      />
      <h2 className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
        {title}
      </h2>
      {subtitle && (
        <span className="text-[9px] uppercase tracking-wider text-muted-foreground/50">
          {subtitle}
        </span>
      )}
    </div>
  );
}

function WeightChip({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-full border px-3 py-1 text-[11px] font-medium transition-colors duration-150",
        active
          ? "border-primary/60 bg-primary/15 text-primary"
          : "border-white/[0.08] bg-white/[0.04] text-muted-foreground hover:border-primary/20 hover:text-foreground"
      )}
    >
      {label}
    </button>
  );
}
