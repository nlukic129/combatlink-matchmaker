import { Link } from "@tanstack/react-router";
import { X, ArrowLeftRight } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Avatar } from "@/components/ui/avatar";

type Props = {
  ids: string[];
  onRemove: (id: string) => void;
};

export function CompareBar({ ids, onRemove }: Props) {
  const { data: fighters = [] } = useQuery({
    queryKey: ["fighters-compare-bar", ids],
    queryFn: async () => {
      const { data } = await supabase
        .from("fighters")
        .select("id, first_name, last_name, photo_url")
        .in("id", ids);
      return data ?? [];
    },
  });

  return (
    <div className="sticky bottom-0 z-40 flex items-center gap-4 border-t border-border glass-panel px-5 py-3.5 shadow-[var(--shadow-elevated)]">
      <span className="shrink-0 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        Compare ({ids.length}/4)
      </span>

      <div className="flex flex-1 items-center gap-2 overflow-x-auto">
        {fighters.map((f) => (
          <div
            key={f.id}
            className="flex shrink-0 items-center gap-2 rounded-full border border-border bg-card py-1 pl-1 pr-2.5 shadow-sm"
          >
            <Avatar
              src={f.photo_url}
              alt={f.first_name}
              fallback={f.first_name?.[0] ?? "?"}
              size="sm"
              className="h-6 w-6 text-[10px]"
            />
            <span className="text-xs font-medium text-foreground">
              {f.first_name} {f.last_name}
            </span>
            <button
              onClick={() => onRemove(f.id)}
              className="ml-0.5 rounded-full p-0.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              aria-label={`Remove ${f.first_name} from comparison`}
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        ))}
      </div>

      <Button
        asChild
        size="sm"
        disabled={ids.length < 2}
      >
        <Link to="/compare" search={{ fighters: ids }}>
          <ArrowLeftRight className="h-4 w-4" />
          Compare
        </Link>
      </Button>
    </div>
  );
}
