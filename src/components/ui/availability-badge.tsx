import { cn } from "@/lib/utils";

type Status = string | null | undefined;

const labels: Record<string, string> = {
  available: "Available",
  in_camp: "In Camp",
  unavailable: "Unavailable",
};

export function AvailabilityBadge({ status }: { status: Status }) {
  const s = status ?? "unavailable";
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium",
        s === "available" && "bg-available/12 text-available ring-1 ring-available/20",
        s === "in_camp" && "bg-in-camp/12 text-in-camp ring-1 ring-in-camp/20",
        s === "unavailable" && "bg-muted/80 text-muted-foreground"
      )}
    >
      <span
        className={cn(
          "h-1.5 w-1.5 rounded-full",
          s === "available" && "bg-available shadow-[0_0_6px_var(--available)]",
          s === "in_camp" && "bg-in-camp",
          s === "unavailable" && "bg-muted-foreground/60"
        )}
      />
      {labels[s] ?? "Unknown"}
    </span>
  );
}
