import * as React from "react";
import * as SliderPrimitive from "@radix-ui/react-slider";
import { cn } from "@/lib/utils";

const Slider = React.forwardRef<
  React.ElementRef<typeof SliderPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof SliderPrimitive.Root>
>(({ className, ...props }, ref) => (
  <SliderPrimitive.Root
    ref={ref}
    className={cn("relative flex w-full touch-none select-none items-center py-3", className)}
    {...props}
  >
    <SliderPrimitive.Track className="relative h-[3px] w-full grow overflow-hidden rounded-full bg-white/[0.1]">
      <SliderPrimitive.Range className="absolute h-full bg-primary" />
    </SliderPrimitive.Track>
    <SliderPrimitive.Thumb className="block h-3.5 w-3.5 cursor-grab rounded-full border border-primary/70 bg-background shadow-[0_0_8px_oklch(0.55_0.24_25/50%)] transition-all active:cursor-grabbing focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-0 disabled:pointer-events-none disabled:opacity-50 hover:scale-110 hover:shadow-[0_0_12px_oklch(0.55_0.24_25/70%)]" />
  </SliderPrimitive.Root>
));
Slider.displayName = SliderPrimitive.Root.displayName;

export { Slider };
