import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { Search as SearchIcon } from "lucide-react";
import {
  coercedOptionalBoolean,
  coercedOptionalNumber,
  coercedOptionalNumberArray,
  coercedOptionalStringArray,
  coercedPage,
} from "@/lib/search-params";
import { SearchSidebar } from "@/components/search/search-sidebar";
import { SearchResults } from "@/components/search/search-results";
import { MandatoryFilters } from "@/components/search/mandatory-filters";
import { FighterDrawer } from "@/components/fighter-drawer/fighter-drawer";
import { EmptyState } from "@/components/ui/empty-state";

const searchSchema = z.object({
  sport: z.string().optional(),
  gender: z.enum(["male", "female"]).optional(),
  weightClasses: coercedOptionalNumberArray,
  catchweightKg: coercedOptionalNumber,
  fighter: z.string().uuid().optional(),
  readyToFightOn: z.string().optional(),
  purseMin: coercedOptionalNumber,
  purseMax: coercedOptionalNumber,
  shortNotice: coercedOptionalBoolean,
  promotionalStatus: z.string().optional(),
  maxPrepWeeks: coercedOptionalNumber,
  level: z.enum(["amateur", "pro"]).optional(),
  minWins: coercedOptionalNumber,
  maxLosses: coercedOptionalNumber,
  maxTotalFights: coercedOptionalNumber,
  cityLat: coercedOptionalNumber,
  cityLng: coercedOptionalNumber,
  cityName: z.string().optional(),
  radiusKm: coercedOptionalNumber,
  countries: coercedOptionalStringArray,
  continent: z
    .enum(["africa", "asia", "europe", "north-america", "south-america", "oceania"])
    .optional(),
  fightStyles: coercedOptionalStringArray,
  stance: z.string().optional(),
  heightMinCm: coercedOptionalNumber,
  heightMaxCm: coercedOptionalNumber,
  reachMinCm: coercedOptionalNumber,
  reachMaxCm: coercedOptionalNumber,
  minInstagramFollowers: coercedOptionalNumber,
  nationalities: coercedOptionalStringArray,
  view: z.enum(["list", "map"]).optional().default("list"),
  page: coercedPage,
});

export type SearchFilters = z.infer<typeof searchSchema>;

export const Route = createFileRoute("/_app/search")({
  validateSearch: searchSchema,
  component: SearchPage,
});

function SearchPage() {
  const filters = Route.useSearch();
  const mandatorySet = !!filters.sport && !!filters.gender;

  return (
    <div className="flex h-[calc(100dvh-3.5rem)] flex-col">
      <MandatoryFilters filters={filters} />

      <div className="mx-auto flex w-full max-w-[1600px] flex-1 overflow-hidden">
        <SearchSidebar filters={filters} disabled={!mandatorySet} />
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          {mandatorySet ? (
            <SearchResults filters={filters} />
          ) : (
            <EmptyMandatoryState />
          )}
        </div>
      </div>

      {filters.fighter && <FighterDrawer fighterId={filters.fighter} />}
    </div>
  );
}

function EmptyMandatoryState() {
  return (
    <EmptyState
      icon={<SearchIcon className="h-8 w-8" />}
      title="Start your search"
      description="Select a sport, gender, and weight class above to browse Identity Verified fighters."
      className="h-full"
    />
  );
}
