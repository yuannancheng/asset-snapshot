import type { ButtonHTMLAttributes, PropsWithChildren } from "react";
import { cn } from "../lib/utils";

type ButtonProps = PropsWithChildren<
  ButtonHTMLAttributes<HTMLButtonElement> & {
    variant?: "primary" | "secondary" | "ghost";
  }
>;

export function Button({ className, variant = "primary", ...props }: ButtonProps) {
  const variants = {
    primary: "bg-ink text-white hover:bg-moss active:bg-ink",
    secondary: "border border-ink/10 bg-white text-ink hover:bg-mint active:bg-mint/80",
    ghost: "text-ink hover:bg-ink/5 active:bg-ink/10",
  };

  return (
    <button
      className={cn(
        "inline-flex h-10 items-center justify-center gap-2 rounded-md px-4 text-sm font-medium transition focus:outline-none focus:ring-2 focus:ring-coral/40 disabled:cursor-not-allowed disabled:opacity-50",
        variants[variant],
        className,
      )}
      {...props}
    />
  );
}
