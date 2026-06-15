import { createFileRoute, redirect } from "@tanstack/react-router";
import { SearchSidebar } from "@/components/search/search-sidebar";
import { SearchResults } from "@/components/search/search-results";
import { MandatoryFilters } from "@/components/search/mandatory-filters";
import { FighterDrawer } from "@/components/fighter-drawer/fighter-drawer";
import { searchSchema } from "@/lib/search-schema";

export type { SearchFilters } from "@/lib/search-schema";

export const Route = createFileRoute("/_app/search/")({
  validateSearch: searchSchema,
  beforeLoad: ({ search }) => {
    if (!search.sport || !search.gender) {
      throw redirect({
        to: "/search/setup",
        search: {
          sport: search.sport,
          gender: search.gender,
          weightClasses: search.weightClasses,
        },
        replace: true,
      });
    }
  },
  component: SearchPage,
});

function SearchPage() {
  const filters = Route.useSearch();

  return (
    <div className="search-content-vt flex h-[calc(100dvh-3.5rem)] flex-col">
      <MandatoryFilters filters={filters} />

      <div className="mx-auto flex w-full max-w-[1600px] flex-1 overflow-hidden">
        <SearchSidebar filters={filters} />
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <SearchResults filters={filters} />
        </div>
      </div>

      {filters.fighter && <FighterDrawer fighterId={filters.fighter} activeSport={filters.sport} />}
    </div>
  );
}
