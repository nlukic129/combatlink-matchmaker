import { createFileRoute } from "@tanstack/react-router";
import { Monitor } from "lucide-react";
import { isAppAccessReady, useRequireMatchmaker } from "@/hooks/use-auth-redirects";
import { AppHeader } from "@/components/layout/app-header";
import { AppPageTransition } from "@/components/layout/app-page-transition";
import { RouterPending } from "@/components/router-fallbacks";
import { Logo } from "@/components/ui/logo";

export const Route = createFileRoute("/_app")({
  component: AppLayout,
});

function AppLayout() {
  const auth = useRequireMatchmaker();

  if (!isAppAccessReady(auth)) {
    return <RouterPending />;
  }

  return <AppShell />;
}

function AppShell() {
  return (
    <>
      {/* Mobile gate — shown only on screens narrower than 1024px */}
      <div className="flex min-h-dvh flex-col items-center justify-center gap-8 bg-background px-8 text-center lg:hidden">
        <Logo size="lg" variant="brand" />
        <div className="space-y-3">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-border/60 bg-card">
            <Monitor className="h-7 w-7 text-muted-foreground" />
          </div>
          <h1 className="text-xl font-semibold text-foreground">Desktop only</h1>
          <p className="text-sm leading-relaxed text-muted-foreground">
            The CombatLink Matchmaker portal is designed for desktop use. Open it on a laptop or desktop for the full experience.
          </p>
        </div>
      </div>

      {/* Full app — desktop (1024px+) */}
      <div className="hidden min-h-dvh flex-col bg-background lg:flex">
        <AppHeader />
        <main className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <AppPageTransition />
        </main>
      </div>
    </>
  );
}
