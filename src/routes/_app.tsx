import { createFileRoute, Outlet } from "@tanstack/react-router";
import { isAppAccessReady, useRequireMatchmaker } from "@/hooks/use-auth-redirects";
import { AppHeader } from "@/components/layout/app-header";
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

      <main className="flex-1">
        <Outlet />
      </main>
    </div>
  );
}
