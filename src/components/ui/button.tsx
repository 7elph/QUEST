"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "default" | "ghost" | "danger";
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "default", ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={cn(
          "inline-flex items-center justify-center rounded-md px-4 py-2 text-sm font-medium transition",
          "disabled:pointer-events-none disabled:opacity-50",
          variant === "default" && "bg-amber-500 text-black hover:bg-amber-400",
          variant === "ghost" && "bg-transparent text-amber-100 hover:bg-white/10",
          variant === "danger" && "bg-red-600 text-white hover:bg-red-500",
          className,
        )}
        {...props}
      />
    );
  },
);

Button.displayName = "Button";
