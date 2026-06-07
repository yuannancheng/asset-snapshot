import type { InputHTMLAttributes, LabelHTMLAttributes } from "react";
import { forwardRef } from "react";
import { cn } from "../lib/utils";

export function Label({ className, ...props }: LabelHTMLAttributes<HTMLLabelElement>) {
  return <label className={cn("text-sm font-medium text-ink", className)} {...props} />;
}

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  function Input({ className, ...props }, ref) {
    return (
      <input
        ref={ref}
        className={cn(
          "h-10 w-full rounded-md border border-ink/10 bg-panel px-3 text-sm text-ink outline-none transition placeholder:text-ink/35 focus:border-moss focus:ring-2 focus:ring-moss/15",
          className,
        )}
        {...props}
      />
    );
  },
);
