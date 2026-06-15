import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import type { SearchFilters } from "@/lib/search-schema";

const SPORTS = [
  { slug: "mma", label: "MMA" },
  { slug: "boxing", label: "Boxing" },
  { slug: "kickboxing", label: "Kickboxing" },
] as const;

const GENDERS = [
  { value: "male" as const, label: "Male" },
  { value: "female" as const, label: "Female" },
];

export function MandatoryFilters({ filters }: { filters: SearchFilters }) {
  const navigate = useNavigate({ from: "/search" });

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

  function toggleWeightClass(id: number) {
    const current = filters.weightClasses ?? [];
    const next = current.includes(id) ? current.filter((w) => w !== id) : [...current, id];
    navigate({
      search: (prev) => ({
        ...prev,
        weightClasses: next.length ? next : undefined,
        catchweightKg: undefined,
        page: 1,
      }),
      replace: true,
    });
  }

  function clearWeightClasses() {
    navigate({
      search: (prev) => ({
        ...prev,
        weightClasses: undefined,
        catchweightKg: undefined,
        page: 1,
      }),
      replace: true,
    });
  }

  return (
    <div className="border-b border-white/[0.06] bg-sidebar/80 backdrop-blur-sm">
      <div className="mx-auto max-w-[1600px] px-4 sm:px-6">

        {/* Row 1: Sport + Gender */}
        <div className="flex flex-wrap items-center gap-2.5 py-2.5">
          <FilterSectionLabel title="Sport" done={!!filters.sport} />

          <div className="flex items-center gap-1.5">
            {SPORTS.map(({ slug, label }) => (
              <FilterPill
                key={slug}
                active={filters.sport === slug}
                onClick={() => setSport(slug)}
              >
                {label}
              </FilterPill>
            ))}
          </div>

          {filters.sport && (
            <>
              <div className="h-4 w-px bg-white/[0.08]" />
              <div className="flex items-center gap-1.5">
                {GENDERS.map(({ value, label }) => (
                  <FilterPill
                    key={value}
                    active={filters.gender === value}
                    onClick={() => setGender(value)}
                  >
                    {label}
                  </FilterPill>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Row 2: Weight classes */}
        {filters.sport && filters.gender && (
          <div className="flex flex-wrap items-center gap-2 border-t border-white/[0.04] py-2">
            <FilterSectionLabel
              title="Weight"
              done={(filters.weightClasses ?? []).length > 0}
            />
            <WeightClassChips
              sport={filters.sport}
              gender={filters.gender}
              selected={filters.weightClasses ?? []}
              onToggle={toggleWeightClass}
              onClearAll={clearWeightClasses}
            />
          </div>
        )}
      </div>
    </div>
  );
}

function FilterSectionLabel({ title, done }: { title: string; done: boolean }) {
  return (
    <div className="flex flex-shrink-0 items-center gap-1.5">
      <span
        className={cn(
          "h-1.5 w-1.5 flex-shrink-0 rounded-full transition-colors duration-300",
          done
            ? "bg-primary [box-shadow:0_0_6px_oklch(0.55_0.24_25/70%)]"
            : "bg-white/20"
        )}
      />
      <span className="hidden text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground sm:inline">
        {title}
      </span>
    </div>
  );
}

function FilterPill({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.1em] transition-all duration-200",
        active
          ? "border-primary/50 bg-primary/10 text-primary [box-shadow:0_0_14px_oklch(0.55_0.24_25/30%)]"
          : "border-white/[0.07] bg-white/[0.03] text-muted-foreground hover:border-primary/25 hover:text-foreground"
      )}
    >
      {children}
    </button>
  );
}

function WeightClassChips({
  sport,
  gender,
  selected,
  onToggle,
  onClearAll,
}: {
  sport: string;
  gender: string;
  selected: number[];
  onToggle: (id: number) => void;
  onClearAll: () => void;
}) {
  const { data: classes = [] } = useQuery({
    queryKey: ["weight-classes", sport, gender],
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

  if (classes.length === 0) return null;

  const allSelected = selected.length === 0;

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <WeightChip active={allSelected} onClick={onClearAll}>
        All
      </WeightChip>
      {classes.map((wc) => {
        const active = selected.includes(wc.id);
        return (
          <WeightChip key={wc.id} active={active} onClick={() => onToggle(wc.id)}>
            {wc.name}
            {active && <X className="h-3 w-3 opacity-70" />}
          </WeightChip>
        );
      })}
    </div>
  );
}

function WeightChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-3 py-1 text-[11px] font-medium transition-all duration-150",
        active
          ? "border-primary/60 bg-primary/15 text-primary"
          : "border-white/[0.08] bg-white/[0.04] text-muted-foreground hover:border-primary/20 hover:text-foreground"
      )}
    >
      {children}
    </button>
  );
}
