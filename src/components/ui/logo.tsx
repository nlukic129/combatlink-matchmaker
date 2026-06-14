import { cn } from "@/lib/utils";

type LogoProps = {
  size?: "sm" | "md" | "lg";
  className?: string;
  subtitle?: string;
};

const sizes = {
  sm: "text-lg",
  md: "text-2xl",
  lg: "text-3xl",
};

export function Logo({ size = "md", className, subtitle }: LogoProps) {
  return (
    <div className={cn("flex flex-col items-center", className)}>
      <span
        className={cn(
          "font-bold tracking-tight text-foreground",
          sizes[size]
        )}
      >
        Combat<span className="text-primary">Link</span>
      </span>
      {subtitle && (
        <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>
      )}
    </div>
  );
}
