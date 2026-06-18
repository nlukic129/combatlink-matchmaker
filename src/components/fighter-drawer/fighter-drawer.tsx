import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { X } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { FighterDrawerContent } from "./fighter-drawer-content";
import type { Fighter } from "@/types/database";

const CLOSE_MS = 260;

type Props = {
  fighterId: string;
  activeSport?: string | null;
  onClose?: () => void;
};

export function FighterDrawer({ fighterId, activeSport, onClose: onCloseProp }: Props) {
  const navigate = useNavigate({ from: "/search" });
  const [isClosing, setIsClosing] = useState(false);

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
    if (isClosing) return;
    setIsClosing(true);
    setTimeout(() => {
      if (onCloseProp) {
        onCloseProp();
      } else {
        navigate({
          search: (p) => {
            const next = { ...p };
            delete next.fighter;
            return next;
          },
          replace: true,
        });
      }
    }, CLOSE_MS);
  }

  useEffect(() => {
    const handler = (e: KeyboardEvent) => e.key === "Escape" && close();
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  // Log profile view event
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      const matchmakerId = data.session?.user?.id;
      if (!matchmakerId) return;
      void supabase.from("matchmaking_logs").insert({
        matchmaker_id: matchmakerId,
        fighter_id: fighterId,
        event_type: "fighter_details_viewed",
      });
    });
  }, [fighterId]);

  return (
    <>
      {/* Backdrop */}
      <div
        className={cn(
          "fixed inset-0 z-40 bg-black/70 backdrop-blur-sm",
          isClosing
            ? "animate-out fade-out"
            : "animate-in fade-in duration-200"
        )}
        style={isClosing ? { animationDuration: `${CLOSE_MS}ms`, animationFillMode: "both" } : undefined}
        onClick={close}
        aria-hidden
      />

      {/* Drawer panel */}
      <aside
        className={cn(
          "fixed right-0 top-0 z-50 flex h-dvh w-[70vw] flex-col",
          "border-l border-white/8 bg-sidebar shadow-[var(--shadow-elevated)]",
          isClosing
            ? "animate-out slide-out-to-right"
            : "animate-in slide-in-from-right duration-300"
        )}
        style={isClosing ? { animationDuration: `${CLOSE_MS}ms`, animationFillMode: "both" } : undefined}
        aria-label="Fighter detail"
      >
        <div className="flex items-center justify-between border-b border-white/6 bg-[oklch(0.10_0.012_270)] px-5 py-3.5">
          <span className="cmp-eyebrow mb-0">Fighter profile</span>
          <Button variant="ghost" size="icon-sm" onClick={close} aria-label="Close">
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="fd-drawer-scroll flex-1 overflow-y-auto scrollbar-thin">
          {isLoading ? (
            <DrawerSkeleton />
          ) : fighter ? (
            <FighterDrawerContent fighter={fighter} activeSport={activeSport} />
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
