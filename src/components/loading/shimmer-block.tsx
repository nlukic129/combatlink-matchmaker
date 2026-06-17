import { cn } from "@/lib/utils";

type ShimmerBlockProps = {
  className?: string;
  style?: React.CSSProperties;
  "aria-hidden"?: boolean;
};

export function ShimmerBlock({ className, style, "aria-hidden": ariaHidden = true }: ShimmerBlockProps) {
  return (
    <div
      className={cn("app-loading-shimmer", className)}
      style={style}
      aria-hidden={ariaHidden}
    />
  );
}
