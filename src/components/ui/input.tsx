"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

export type InputProps = React.InputHTMLAttributes<HTMLInputElement>;

export const Input = React.forwardRef<HTMLInputElement, InputProps>(({ className, ...props }, ref) => {
  return (
    <input
      ref={ref}
      className={cn(
        "w-full rounded-md border border-amber-100/20 bg-slate-900/80 px-3 py-2 text-sm text-amber-50",
        "placeholder:text-amber-100/40 focus:border-amber-400 focus:outline-none",
        className,
      )}
      {...props}
    />
  );
});

Input.displayName = "Input";
