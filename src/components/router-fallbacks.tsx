import { useRouterState } from "@tanstack/react-router";
import type { ErrorComponentProps } from "@tanstack/react-router";
import { Link, useRouter } from "@tanstack/react-router";
import { AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/ui/logo";
import {
  AppLoadingHeader,
  AuthGateLoader,
  PageLoaderContent,
} from "@/components/loading/page-loaders";
import { resolvePageLoaderKey } from "@/lib/page-loading";

type RouterPendingProps = {
  /** Full-screen auth gate (login / change-password). */
  variant?: "full" | "bootstrap" | "route";
};

export function RouterPending({ variant = "bootstrap" }: RouterPendingProps) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const page = resolvePageLoaderKey(pathname);

  if (variant === "full") {
    return <AuthGateLoader />;
  }

  const content = <PageLoaderContent page={page} />;

  if (variant === "route") {
    return (
      <div className="app-loading-route" aria-busy="true" aria-label="Loading page">
        {content}
      </div>
    );
  }

  return (
    <div className="app-loading app-loading--shell">
      <AppLoadingHeader />
      <main className="app-loading-main">{content}</main>
    </div>
  );
}

export function RouterError({ error, reset }: ErrorComponentProps) {
  const router = useRouter();
  const message =
    error instanceof Error ? error.message : "The page could not be loaded.";

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-4 auth-gradient px-4 text-center">
      <Logo size="sm" variant="brand" productLabel className="mb-2" />
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10 text-destructive">
        <AlertCircle className="h-6 w-6" />
      </div>
      <div className="max-w-md space-y-2">
        <h1 className="text-lg font-semibold text-foreground">Something went wrong</h1>
        <p className="text-sm text-muted-foreground">{message}</p>
      </div>
      <div className="flex flex-wrap items-center justify-center gap-2">
        <Button
          onClick={() => {
            reset();
            void router.invalidate();
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
