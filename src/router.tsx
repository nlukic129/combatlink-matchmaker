import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { RouterError, RouterPending } from "@/components/router-fallbacks";
import { navViewTransition } from "@/lib/nav-transitions";
import { routeTree } from "./routeTree.gen";

export const getRouter = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 60_000,
        retry: 1,
      },
    },
  });

  const router = createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    defaultPreloadStaleTime: 0,
    defaultPendingMs: 120,
    defaultPendingMinMs: 280,
    defaultPendingComponent: () => <RouterPending variant="route" />,
    defaultErrorComponent: RouterError,
    defaultViewTransition: navViewTransition,
  });

  return router;
};

declare module "@tanstack/react-router" {
  interface Register {
    router: Awaited<ReturnType<typeof getRouter>>;
  }
}
