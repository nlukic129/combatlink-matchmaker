import { useState, useEffect } from "react";
import * as Popover from "@radix-ui/react-popover";
import {
  format,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  startOfWeek,
  endOfWeek,
  addMonths,
  subMonths,
  isSameMonth,
  isSameDay,
  isToday,
  isBefore,
  startOfDay,
  parse,
  isValid,
} from "date-fns";
import { CalendarDays, ChevronLeft, ChevronRight, X } from "lucide-react";
import { cn } from "@/lib/utils";

type Props = {
  value?: string; // YYYY-MM-DD
  onChange: (value: string | undefined) => void;
  placeholder?: string;
  minDate?: Date;
  className?: string;
};

const WEEKDAYS = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];

export function DatePicker({
  value,
  onChange,
  placeholder = "Pick a date…",
  minDate,
  className,
}: Props) {
  const floor = startOfDay(minDate ?? new Date());

  const parsed = value ? parse(value, "yyyy-MM-dd", new Date()) : null;
  const selected = parsed && isValid(parsed) ? startOfDay(parsed) : null;

  const [month, setMonth] = useState<Date>(selected ?? floor);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (selected) setMonth(startOfMonth(selected));
  }, [value]); // eslint-disable-line react-hooks/exhaustive-deps

  const days = eachDayOfInterval({
    start: startOfWeek(startOfMonth(month), { weekStartsOn: 1 }),
    end: endOfWeek(endOfMonth(month), { weekStartsOn: 1 }),
  });

  function select(day: Date) {
    if (isBefore(day, floor) && !isSameDay(day, floor)) return;
    onChange(format(day, "yyyy-MM-dd"));
    setOpen(false);
  }

  function clear(e: React.MouseEvent) {
    e.stopPropagation();
    onChange(undefined);
  }

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <button
          type="button"
          className={cn(
            "group flex w-full items-center gap-2 rounded-lg border border-white/[0.08] bg-white/[0.04] px-3 py-2 text-left text-sm transition-colors",
            "focus-visible:border-primary/40 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary/20",
            open && "border-primary/30 ring-1 ring-primary/20",
            className
          )}
        >
          <CalendarDays className="h-3.5 w-3.5 shrink-0 text-muted-foreground/50" />
          <span
            className={cn(
              "flex-1 truncate text-sm",
              selected ? "text-foreground" : "text-muted-foreground/50"
            )}
          >
            {selected ? format(selected, "MMM d, yyyy") : placeholder}
          </span>
          {selected && (
            <span
              role="button"
              tabIndex={-1}
              onClick={clear}
              className="rounded p-0.5 text-muted-foreground/50 opacity-70 transition-opacity hover:opacity-100"
              aria-label="Clear date"
            >
              <X className="h-3 w-3" />
            </span>
          )}
        </button>
      </Popover.Trigger>

      <Popover.Portal>
        <Popover.Content
          side="bottom"
          align="start"
          sideOffset={6}
          avoidCollisions
          style={{
            background: "oklch(0.10 0.012 270 / 97%)",
            boxShadow: "0 20px 56px oklch(0 0 0 / 70%), 0 0 0 1px oklch(1 0 0 / 8%)",
          }}
          className="z-50 w-[252px] select-none rounded-xl border border-white/[0.08] p-3 [backdrop-filter:blur(20px)] data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2"
        >
          {/* Month navigation */}
          <div className="mb-3 flex items-center justify-between">
            <button
              type="button"
              onClick={() => setMonth((m) => subMonths(m, 1))}
              className="flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-white/[0.07] hover:text-foreground"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
            </button>
            <span className="text-[13px] font-semibold text-foreground">
              {format(month, "MMMM yyyy")}
            </span>
            <button
              type="button"
              onClick={() => setMonth((m) => addMonths(m, 1))}
              className="flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-white/[0.07] hover:text-foreground"
            >
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>

          {/* Weekday headers */}
          <div className="mb-1 grid grid-cols-7">
            {WEEKDAYS.map((d) => (
              <div
                key={d}
                className="py-1 text-center text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/40"
              >
                {d}
              </div>
            ))}
          </div>

          {/* Day grid */}
          <div className="grid grid-cols-7 gap-y-0.5">
            {days.map((day) => {
              const sel = selected && isSameDay(day, selected);
              const inMonth = isSameMonth(day, month);
              const todayMark = isToday(day);
              const past = isBefore(day, floor) && !isSameDay(day, floor);

              return (
                <button
                  key={day.toISOString()}
                  type="button"
                  onClick={() => select(day)}
                  disabled={past}
                  className={cn(
                    "relative mx-auto flex h-8 w-8 items-center justify-center rounded-lg text-[12px] font-medium transition-all",
                    !inMonth && "opacity-20",
                    past && "cursor-not-allowed opacity-20",
                    !past && !sel && "hover:bg-white/[0.08] hover:text-foreground",
                    todayMark && !sel && "text-primary font-semibold",
                    sel
                      ? "bg-primary font-semibold text-white [box-shadow:0_0_14px_oklch(0.55_0.24_25/45%)]"
                      : "text-foreground/75"
                  )}
                >
                  {format(day, "d")}
                  {todayMark && !sel && (
                    <span className="absolute bottom-1 left-1/2 h-[3px] w-[3px] -translate-x-1/2 rounded-full bg-primary" />
                  )}
                </button>
              );
            })}
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
