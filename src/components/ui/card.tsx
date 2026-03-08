import { cn } from "@/lib/utils";

export function Card({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "quest-panel quest-panel-texture rounded-xl border border-amber-200/20 bg-slate-950/50 shadow-lg shadow-black/20",
        className,
      )}
      {...props}
    />
  );
}
