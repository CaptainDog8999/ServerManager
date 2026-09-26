import type { HTMLAttributes } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium tabular-nums",
  {
    variants: {
      variant: {
        default: "bg-panel-2 text-ink-soft",
        ok: "bg-ok/15 text-ok",
        warn: "bg-warn/15 text-warn",
        bad: "bg-bad/15 text-bad",
        accent: "bg-accent/15 text-accent",
      },
    },
    defaultVariants: { variant: "default" },
  },
);

export function Badge({
  className,
  variant,
  ...props
}: HTMLAttributes<HTMLDivElement> & VariantProps<typeof badgeVariants>) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}
