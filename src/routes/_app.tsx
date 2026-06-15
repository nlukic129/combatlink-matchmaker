import { createFileRoute } from "@tanstack/react-router";
import { isAppAccessReady, useRequireMatchmaker } from "@/hooks/use-auth-redirects";
import { AppHeader } from "@/components/layout/app-header";
import { AppPageTransition } from "@/components/layout/app-page-transition";
import { RouterPending } from "@/components/router-fallbacks";

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
    <div className="flex min-h-dvh flex-col bg-background">
      <AppHeader />

      <main className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <AppPageTransition />
      </main>
    </div>
  );
}
