import { createFileRoute, Outlet } from "@tanstack/react-router";

/** Layout shell for /search and /search/setup — no redirects here. */
export const Route = createFileRoute("/_app/search")({
  component: SearchLayout,
});

function SearchLayout() {
  return <Outlet />;
}
