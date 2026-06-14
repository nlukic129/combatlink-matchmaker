import { cn } from "@/lib/utils";

type AvatarProps = {
  src?: string | null;
  alt: string;
  fallback: string;
  size?: "sm" | "md" | "lg" | "xl";
  className?: string;
  ring?: boolean;
};

const sizes = {
  sm: "h-9 w-9 text-xs",
  md: "h-11 w-11 text-sm",
  lg: "h-14 w-14 text-lg",
  xl: "h-20 w-20 text-2xl",
};

export function Avatar({ src, alt, fallback, size = "md", className, ring }: AvatarProps) {
  return (
    <div
      className={cn(
        "relative shrink-0 overflow-hidden rounded-full bg-surface",
        sizes[size],
        ring && "ring-2 ring-border ring-offset-2 ring-offset-card",
        className
      )}
    >
      {src ? (
        <img src={src} alt={alt} className="h-full w-full object-cover" />
      ) : (
        <div className="flex h-full w-full items-center justify-center font-semibold text-muted-foreground">
          {fallback}
        </div>
      )}
    </div>
  );
}
