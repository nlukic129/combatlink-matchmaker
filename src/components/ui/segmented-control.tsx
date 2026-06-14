import { cn } from "@/lib/utils";

type Option<T extends string> = {
  value: T;
  label: string;
  icon?: React.ReactNode;
};

type SegmentedControlProps<T extends string> = {
  options: Option<T>[];
  value: T | "";
  onChange: (value: T) => void;
  size?: "sm" | "md";
  className?: string;
};

export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  size = "md",
  className,
}: SegmentedControlProps<T>) {
  return (
    <div
      className={cn(
        "inline-flex items-center gap-0.5 rounded-lg bg-muted/60 p-1",
        className
      )}
      role="group"
    >
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-md font-medium transition-all duration-150",
              size === "sm" ? "px-2.5 py-1 text-xs" : "px-3.5 py-1.5 text-sm",
              active
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground hover:bg-accent/60"
            )}
            aria-pressed={active}
          >
            {opt.icon}
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
