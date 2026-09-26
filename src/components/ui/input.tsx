import * as React from "react";
import { cn } from "@/lib/utils";

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          "flex h-11 w-full rounded-md bg-panel-2 px-3 text-sm text-ink shadow-[var(--shadow-border)]",
          "placeholder:text-ink-faint",
          "transition-[box-shadow] duration-150 ease-out",
          "focus-visible:outline-none focus-visible:shadow-[var(--shadow-border-hover)] focus-visible:ring-2 focus-visible:ring-accent/50",
          "disabled:cursor-not-allowed disabled:opacity-50",
          "font-mono",
          className,
        )}
        ref={ref}
        {...props}
      />
    );
  },
);
Input.displayName = "Input";

export { Input };
