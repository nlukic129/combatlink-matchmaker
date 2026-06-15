import { createFileRoute } from "@tanstack/react-router";
import { SearchSetup } from "@/components/search/search-setup";
import { searchSetupSchema } from "@/lib/search-schema";

export const Route = createFileRoute("/_app/search/setup")({
  validateSearch: searchSetupSchema,
  component: SearchSetupPage,
});

function SearchSetupPage() {
  const params = Route.useSearch();
  return <SearchSetup params={params} />;
}
