import { useEffect } from "react";
import { useNavigate } from "@tanstack/react-router";
import { X } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { FighterDrawerContent } from "./fighter-drawer-content";
import type { Fighter } from "@/types/database";

type Props = {
  fighterId: string;
};

export function FighterDrawer({ fighterId }: Props) {
  const navigate = useNavigate({ from: "/search" });

  const { data: fighter, isLoading } = useQuery<Fighter | null>({
    queryKey: ["fighter-detail", fighterId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("fighters")
        .select("*")
        .eq("id", fighterId)
        .eq("identity_verified", true)
        .single();
      if (error) return null;
      return data as Fighter;
    },
  });

  function close() {
    navigate({
      search: (p) => {
        const next = { ...p };
        delete next.fighter;
        return next;
      },
      replace: true,
    });
  }

  useEffect(() => {
    const handler = (e: KeyboardEvent) => e.key === "Escape" && close();
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  return (
    <>
      <div
        className="fixed inset-0 z-40 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200"
        onClick={close}
        aria-hidden
      />

      <aside
        className={cn(
          "fixed right-0 top-0 z-50 flex h-dvh w-full max-w-3xl flex-col",
          "border-l border-border bg-sidebar shadow-[var(--shadow-elevated)]",
          "animate-in slide-in-from-right duration-300"
        )}
        aria-label="Fighter detail"
      >
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            Fighter Profile
          </span>
          <Button variant="ghost" size="icon-sm" onClick={close} aria-label="Close">
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto scrollbar-thin">
          {isLoading ? (
            <DrawerSkeleton />
          ) : fighter ? (
            <FighterDrawerContent fighter={fighter} />
          ) : (
            <div className="flex h-full items-center justify-center">
              <p className="text-sm text-muted-foreground">Fighter not found</p>
            </div>
          )}
        </div>
      </aside>
    </>
  );
}

function DrawerSkeleton() {
  return (
    <div className="space-y-6 p-6">
      <div className="flex gap-5">
        <div className="h-20 w-20 shrink-0 rounded-full shimmer" />
        <div className="flex-1 space-y-3 py-1">
          <div className="h-5 w-48 rounded-md shimmer" />
          <div className="h-4 w-28 rounded-md shimmer" />
          <div className="h-6 w-24 rounded-full shimmer" />
        </div>
      </div>
      <div className="h-px bg-border" />
      <div className="space-y-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-12 rounded-lg shimmer" />
        ))}
      </div>
    </div>
  );
}
