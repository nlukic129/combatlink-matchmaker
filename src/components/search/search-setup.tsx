import { useState, useEffect } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, Check, Loader2, Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import type { SearchSetupParams } from "@/lib/search-schema";

const SPORTS = [
  { slug: "mma", label: "MMA", mark: "MMA" },
  { slug: "boxing", label: "Boxing", mark: "BOX" },
  { slug: "kickboxing", label: "Kickboxing", mark: "KICK" },
] as const;

const GENDERS = [
  { value: "male" as const, label: "Male" },
  { value: "female" as const, label: "Female" },
];

export function SearchSetup({ params }: { params: SearchSetupParams }) {
  const navigate = useNavigate({ from: "/search/setup" });

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
    });
  }

  return (
    <div className="search-setup relative flex h-full min-h-0 flex-1 flex-col overflow-y-auto">
      <div className="search-setup-glow pointer-events-none absolute inset-0" aria-hidden />

      <div className="relative z-10 mx-auto flex w-full max-w-xl flex-col justify-center px-4 py-6 sm:px-6 sm:py-8">
        <header className="mb-5 text-center">
          <h1 className="font-display text-3xl tracking-wide text-foreground sm:text-4xl">
            FIND YOUR FIGHTER
          </h1>
          <p className="mx-auto mt-1.5 max-w-sm text-xs text-muted-foreground sm:text-sm">
            Pick sport and gender. Weight class is optional.
          </p>
        </header>

        <div className="search-setup-card rounded-xl border border-border bg-card/80 p-4 shadow-[var(--shadow-elevated)] backdrop-blur-sm sm:p-5">
          <section className="space-y-2">
            <SectionLabel title="Sport" done={!!sport} />
            <div className="grid grid-cols-3 gap-2">
              {SPORTS.map(({ slug, label, mark }) => {
                const active = sport === slug;
                return (
                  <button
                    key={slug}
                    type="button"
                    onClick={() => selectSport(slug)}
                    className={cn(
                      "search-setup-option relative flex flex-col items-center gap-1 rounded-lg border px-2 py-2.5 transition-all duration-150",
                      active
                        ? "border-primary/50 bg-primary/10 ring-1 ring-primary/25"
                        : "border-border bg-surface/40 hover:border-primary/25 hover:bg-surface"
                    )}
                  >
                    <span
                      className={cn(
                        "font-display text-2xl leading-none tracking-wide",
                        active ? "text-primary" : "text-foreground/80"
                      )}
                    >
                      {mark}
                    </span>
                    <span
                      className={cn(
                        "text-[11px] font-medium",
                        active ? "text-foreground" : "text-muted-foreground"
                      )}
                    >
                      {label}
                    </span>
                    {active && (
                      <span className="absolute right-1.5 top-1.5 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-primary text-primary-foreground">
                        <Check className="h-2 w-2" strokeWidth={3} />
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </section>

          <section
            className={cn(
              "overflow-hidden transition-all duration-250 ease-out",
              sport ? "mt-4 max-h-28 opacity-100" : "max-h-0 opacity-0"
            )}
          >
            <SectionLabel title="Gender" done={!!gender} />
            <div className="mt-2 grid grid-cols-2 gap-2">
              {GENDERS.map(({ value, label }) => {
                const active = gender === value;
                return (
                  <button
                    key={value}
                    type="button"
                    onClick={() => selectGender(value)}
                    className={cn(
                      "search-setup-option rounded-lg border py-2 text-sm font-medium transition-all duration-150",
                      active
                        ? "border-primary/50 bg-primary/10 text-foreground ring-1 ring-primary/25"
                        : "border-border bg-surface/40 text-muted-foreground hover:border-primary/25 hover:text-foreground"
                    )}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </section>

          <section
            className={cn(
              "overflow-hidden transition-all duration-250 ease-out",
              readyForWeights ? "mt-4 max-h-64 opacity-100" : "max-h-0 opacity-0"
            )}
          >
            <SectionLabel title="Weight class" subtitle="Optional" done={weightClasses.length > 0} />

            {weightsLoading ? (
              <div className="flex items-center justify-center gap-2 py-4 text-xs text-muted-foreground">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Loading…
              </div>
            ) : classes.length === 0 ? (
              <p className="py-3 text-center text-xs text-muted-foreground">
                No weight classes for this selection.
              </p>
            ) : (
              <div className="mt-2 flex max-h-32 flex-wrap gap-1.5 overflow-y-auto scrollbar-thin pr-0.5">
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

          <div
            className={cn(
              "overflow-hidden transition-all duration-250 ease-out",
              canSearch ? "mt-4 max-h-20 opacity-100" : "max-h-0 opacity-0"
            )}
          >
            <Button className="search-setup-cta h-10 w-full" onClick={startSearch}>
              <Search className="h-3.5 w-3.5" />
              Search fighters
              <ArrowRight className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </div>
    </div>
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
      <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {title}
      </h2>
      {subtitle && (
        <span className="text-[10px] text-muted-foreground/70">{subtitle}</span>
      )}
      {done && <Check className="h-3 w-3 text-primary" strokeWidth={2.5} />}
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
        "rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors duration-150",
        active
          ? "border-primary bg-primary/15 text-primary"
          : "border-border bg-surface/30 text-muted-foreground hover:border-primary/20 hover:text-foreground"
      )}
    >
      {label}
    </button>
  );
}
