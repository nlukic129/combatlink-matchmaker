import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { X, Dumbbell } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { SegmentedControl } from "@/components/ui/segmented-control";
import type { SearchFilters } from "@/routes/_app.search";

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
    <div className="border-b border-border bg-sidebar/80">
      <div className="mx-auto flex max-w-[1600px] flex-wrap items-center gap-3 px-4 py-3 sm:px-6">
        <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
          <Dumbbell className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Sport</span>
        </div>

        <SegmentedControl
          options={SPORTS.map((s) => ({ value: s.slug, label: s.label }))}
          value={filters.sport ?? ""}
          onChange={(v) => setSport(v)}
          size="sm"
        />

        {filters.sport && (
          <>
            <div className="hidden h-5 w-px bg-border sm:block" />
            <SegmentedControl
              options={GENDERS.map((g) => ({ value: g.value, label: g.label }))}
              value={filters.gender ?? ""}
              onChange={(v) => setGender(v as "male" | "female")}
              size="sm"
            />
          </>
        )}

        {filters.sport && filters.gender && (
          <>
            <div className="hidden h-5 w-px bg-border sm:block" />
            <WeightClassChips
              sport={filters.sport}
              gender={filters.gender}
              selected={filters.weightClasses ?? []}
              onToggle={toggleWeightClass}
              onClearAll={clearWeightClasses}
            />
          </>
        )}
      </div>
    </div>
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
      <Chip active={allSelected} onClick={onClearAll}>
        All
      </Chip>
      {classes.map((wc) => {
        const active = selected.includes(wc.id);
        return (
          <Chip key={wc.id} active={active} onClick={() => onToggle(wc.id)}>
            {wc.name}
            {active && <X className="h-3 w-3 opacity-70" />}
          </Chip>
        );
      })}
    </div>
  );
}

function Chip({
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
        "inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-medium transition-all duration-150",
        active
          ? "bg-primary/15 text-primary ring-1 ring-primary/40"
          : "bg-muted/60 text-muted-foreground hover:bg-accent hover:text-foreground"
      )}
    >
      {children}
    </button>
  );
}
