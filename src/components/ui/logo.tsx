import { cn } from "@/lib/utils";

type LogoProps = {
  size?: "sm" | "md" | "lg";
  variant?: "default" | "brand";
  className?: string;
  subtitle?: string;
  productLabel?: boolean;
};

const sizes = {
  sm: "text-lg",
  md: "text-2xl",
  lg: "text-3xl",
};

export function Logo({
  size = "md",
  variant = "default",
  className,
  subtitle,
  productLabel,
}: LogoProps) {
  return (
    <div className={cn("flex flex-col items-center", className)}>
      <span
        className={cn(
          "leading-none text-foreground",
          variant === "brand" ? "font-display tracking-wide" : "font-bold tracking-tight",
          sizes[size]
        )}
      >
        COMBAT<span className="text-primary">LINK</span>
      </span>
      {productLabel && (
        <span className="mt-0.5 text-[10px] font-medium uppercase tracking-[0.2em] text-muted-foreground">
          Matchmaker
        </span>
      )}
      {subtitle && (
        <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>
      )}
    </div>
  );
}
