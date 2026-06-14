import type { ErrorComponentProps } from "@tanstack/react-router";
import { Link, useRouter } from "@tanstack/react-router";
import { AlertCircle } from "lucide-react";
import { Spinner } from "@/components/ui/spinner";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/ui/logo";

export function RouterPending() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-background">
      <Logo size="sm" />
      <Spinner size="lg" />
    </div>
  );
}

export function RouterError({ error, reset }: ErrorComponentProps) {
  const router = useRouter();
  const message =
    error instanceof Error ? error.message : "The page could not be loaded.";

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-background px-4 text-center">
      <Logo size="sm" className="mb-2" />
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
