import { useRef, useLayoutEffect, useState } from "react";
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
  const containerRef = useRef<HTMLDivElement>(null);
  const [thumb, setThumb] = useState<{ left: number; width: number } | null>(null);

  useLayoutEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const idx = options.findIndex(o => o.value === value);
    if (idx < 0) { setThumb(null); return; }
    const btn = container.querySelectorAll<HTMLButtonElement>("button")[idx];
    if (!btn) return;
    const cLeft = container.getBoundingClientRect().left;
    const bRect = btn.getBoundingClientRect();
    setThumb({ left: bRect.left - cLeft, width: bRect.width });
  }, [value, options]);

  return (
    <div
      ref={containerRef}
      role="group"
      className={cn(
        "relative inline-flex items-stretch overflow-hidden rounded-lg",
        "bg-[oklch(0.13_0.012_270)] ring-1 ring-white/[0.07]",
        className
      )}
    >
      {/* Sliding thumb — clipped by container overflow-hidden */}
      {thumb && (
        <span
          aria-hidden
          className="pointer-events-none absolute inset-y-0 rounded-lg bg-primary shadow-[0_0_12px_oklch(0.55_0.24_25/0.4)]"
          style={{
            left: thumb.left,
            width: thumb.width,
            transition: "left 200ms cubic-bezier(0.22,1,0.36,1), width 200ms cubic-bezier(0.22,1,0.36,1)",
          }}
        />
      )}

      {options.map(opt => {
        const active = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            aria-pressed={active}
            className={cn(
              "relative z-10 inline-flex items-center gap-1.5 font-medium",
              "transition-colors duration-150 select-none",
              size === "sm" ? "px-3 py-1.5 text-xs" : "px-4 py-2 text-sm",
              active ? "text-primary-foreground" : "text-muted-foreground hover:text-foreground"
            )}
          >
            {opt.icon}
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
