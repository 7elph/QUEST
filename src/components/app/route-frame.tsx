"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

export function RouteFrame({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const skipFrame = pathname.startsWith("/enterprise");

  if (skipFrame) {
    return <>{children}</>;
  }

  return (
    <div className="quest-frame-shell">
      <div className="quest-frame-inner">{children}</div>
    </div>
  );
}
