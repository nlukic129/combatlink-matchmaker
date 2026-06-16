import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { Toaster } from "sonner";

import { AuthProvider } from "@/contexts/auth-context";
import { CurrencyProvider } from "@/contexts/currency-context";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/ui/logo";
import { buildSupabasePublicEnvScript } from "@/lib/supabase-public-env";
import appCss from "../styles.css?url";

function NotFoundComponent() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center auth-gradient px-4">
      <Logo size="md" className="mb-10" />
      <p className="font-display text-8xl tracking-wide text-foreground">404</p>
      <p className="mt-3 text-lg text-muted-foreground">Page not found</p>
      <Button asChild className="mt-8">
        <Link to="/search">Back to search</Link>
      </Button>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center auth-gradient px-4">
      <Logo size="md" className="mb-10" />
      <p className="text-lg font-medium text-foreground">Something went wrong</p>
      <p className="mt-2 max-w-sm text-center text-sm text-muted-foreground">
        The page could not be loaded. Try again or return to search.
      </p>
      <div className="mt-8 flex flex-wrap justify-center gap-2">
        <Button
          onClick={() => {
            router.invalidate();
            reset();
          }}
        >
          Try again
        </Button>
        <Button variant="outline" asChild>
          <Link to="/search">Back to search</Link>
        </Button>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1.0" },
      { title: "CombatLink — Matchmaker" },
      {
        name: "description",
        content: "Search and connect with Identity Verified fighters.",
      },
      { name: "theme-color", content: "#0D0D12" },
    ],
    links: [
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Inter:wght@400;500;600;700;800&display=swap",
      },
      { rel: "stylesheet", href: appCss },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: React.ReactNode }) {
  const supabaseEnvScript = typeof window === "undefined" ? buildSupabasePublicEnvScript() : null;

  return (
    <html lang="en" className="dark">
      <head>
        <HeadContent />
        {supabaseEnvScript ? (
          <script dangerouslySetInnerHTML={{ __html: supabaseEnvScript }} />
        ) : null}
      </head>
      <body suppressHydrationWarning>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <CurrencyProvider>
          <Outlet />
          <Toaster richColors position="top-center" theme="dark" />
        </CurrencyProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}
