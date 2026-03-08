"use client";

import { useEffect, useMemo, useState } from "react";

export function SlaCountdown({ deadlineAt, completed }: { deadlineAt: string | Date; completed: boolean }) {
  const [now, setNow] = useState(Date.now());
  const deadline = useMemo(() => new Date(deadlineAt).getTime(), [deadlineAt]);

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const diff = deadline - now;
  const late = diff < 0;
  const abs = Math.abs(diff);
  const hours = Math.floor(abs / (1000 * 60 * 60));
  const minutes = Math.floor((abs % (1000 * 60 * 60)) / (1000 * 60));

  if (completed) {
    return <p className="text-xs text-green-300">SLA encerrado (missao concluida)</p>;
  }

  return (
    <p className={`text-sm ${late ? "text-red-300" : "text-amber-100"}`}>
      {late ? "Atrasada ha" : "Tempo restante:"} {hours}h {minutes}m
    </p>
  );
}
