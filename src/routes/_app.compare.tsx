import { createFileRoute, Link } from "@tanstack/react-router";
import { z } from "zod";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Shield, Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { coercedStringArray } from "@/lib/search-params";
import { formatCurrency } from "@/lib/utils";
import { AvailabilityBadge } from "@/components/ui/availability-badge";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { Spinner } from "@/components/ui/spinner";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type { Fighter } from "@/types/database";

const compareSchema = z.object({
  fighters: coercedStringArray,
});

export const Route = createFileRoute("/_app/compare")({
  validateSearch: compareSchema,
  component: ComparePage,
});

const SECTIONS = [
  {
    title: "Identity",
    rows: [
      { label: "Photo", key: "photo" },
      { label: "Name", key: "name" },
      { label: "Nickname", key: "nickname" },
      { label: "Nationality", key: "country" },
      { label: "Current city", key: "currentCity" },
    ],
  },
  {
    title: "Physical",
    rows: [
      { label: "Gender", key: "gender" },
      { label: "Height", key: "heightCm" },
      { label: "Reach", key: "reachCm" },
      { label: "Stance", key: "stance" },
    ],
  },
  {
    title: "Booking",
    rows: [
      { label: "Availability", key: "availability" },
      { label: "Available from", key: "availableFrom" },
      { label: "Fight purse", key: "purse" },
      { label: "Prep time", key: "prepWeeks" },
      { label: "Short notice", key: "shortNotice" },
      { label: "Promotional status", key: "promotionalStatus" },
    ],
  },
  {
    title: "Visibility",
    rows: [
      { label: "Instagram", key: "instagram" },
    ],
  },
];

function renderCell(fighter: Fighter, key: string): React.ReactNode {
  switch (key) {
    case "photo":
      return (
        <div className="flex justify-center">
          <Avatar
            src={fighter.photo_url}
            alt={fighter.first_name}
            fallback={fighter.first_name?.[0] ?? "?"}
            size="lg"
            ring
          />
        </div>
      );
    case "name":
      return (
        <span className="font-semibold">
          {fighter.first_name} {fighter.last_name}
        </span>
      );
    case "nickname":
      return fighter.nickname ? `"${fighter.nickname}"` : "—";
    case "country":
      return fighter.country ?? "—";
    case "currentCity":
      return [fighter.current_city, fighter.current_city_country].filter(Boolean).join(", ") || "—";
    case "gender":
      return fighter.gender ? fighter.gender.charAt(0).toUpperCase() + fighter.gender.slice(1) : "—";
    case "heightCm":
      return fighter.height_cm ? `${fighter.height_cm} cm` : "—";
    case "reachCm":
      return fighter.reach_cm ? `${fighter.reach_cm} cm` : "—";
    case "stance":
      return fighter.stance ?? "—";
    case "availability":
      return <AvailabilityBadge status={fighter.availability_status} />;
    case "availableFrom":
      return fighter.available_from
        ? new Date(fighter.available_from).toLocaleDateString("en-GB", {
            day: "numeric",
            month: "short",
            year: "numeric",
          })
        : "—";
    case "purse":
      return fighter.purse_usd ? formatCurrency(fighter.purse_usd) : "—";
    case "prepWeeks":
      return fighter.preparation_weeks ? `${fighter.preparation_weeks} weeks` : "—";
    case "shortNotice":
      return fighter.open_to_short_notice ? "Yes" : "No";
    case "promotionalStatus":
      return fighter.promotional_status ?? "—";
    case "instagram":
      return fighter.instagram ? `@${fighter.instagram}` : "—";
    default:
      return "—";
  }
}

function ComparePage() {
  const { fighters: ids } = Route.useSearch();

  const { data: fighters = [], isLoading } = useQuery({
    queryKey: ["fighters-compare", ids],
    enabled: ids.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("fighters")
        .select("*")
        .in("id", ids)
        .eq("identity_verified", true);

      if (error) throw error;
      return (data ?? []) as Fighter[];
    },
  });

  if (ids.length === 0) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
        <EmptyState
          icon={<Users className="h-8 w-8" />}
          title="No fighters selected"
          description="Select up to 4 fighters from search to compare side by side."
          action={
            <Button asChild>
              <Link to="/search">Back to search</Link>
            </Button>
          }
        />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      <div className="mb-6">
        <Button variant="ghost" size="sm" asChild className="mb-4 -ml-2">
          <Link to="/search">
            <ArrowLeft className="h-4 w-4" />
            Back to search
          </Link>
        </Button>
        <PageHeader
          title="Compare Fighters"
          description={`Side-by-side comparison of ${fighters.length} fighters.`}
        />
      </div>

      {isLoading ? (
        <div className="flex h-48 items-center justify-center">
          <Spinner size="lg" />
        </div>
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto scrollbar-thin">
            <table className="w-full min-w-[640px] border-separate border-spacing-0">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="w-36 py-4 pr-4 pl-6 text-left text-xs font-medium text-muted-foreground" />
                  {fighters.map((f) => (
                    <th
                      key={f.id}
                      className="px-4 py-4 text-center text-sm font-semibold text-foreground"
                    >
                      {f.first_name} {f.last_name}
                      <Shield className="ml-1 inline h-3 w-3 text-available" />
                    </th>
                  ))}
                </tr>
              </thead>

              <tbody>
                {SECTIONS.map((section) => (
                  <>
                    <tr key={section.title + "-header"}>
                      <td
                        colSpan={1 + fighters.length}
                        className="bg-muted/20 px-6 pb-2 pt-6 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground"
                      >
                        {section.title}
                      </td>
                    </tr>
                    {section.rows.map((row, rowIdx) => (
                      <tr
                        key={row.key}
                        className={rowIdx % 2 === 0 ? "bg-card" : "bg-muted/10"}
                      >
                        <td className="py-3 pr-4 pl-6 text-xs font-medium text-muted-foreground">
                          {row.label}
                        </td>
                        {fighters.map((f) => (
                          <td key={f.id} className="px-4 py-3 text-center text-sm text-foreground">
                            {renderCell(f, row.key)}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
