"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";

type NotificationItem = {
  id: string;
  title: string;
  message: string;
  readAt: string | null;
  createdAt: string;
};

export function NotificationBell() {
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [unread, setUnread] = useState(0);
  const [open, setOpen] = useState(false);

  const load = async () => {
    const response = await fetch("/api/notifications", { cache: "no-store" });
    if (!response.ok) return;
    const data = await response.json();
    setItems(data.notifications ?? []);
    setUnread(data.unread ?? 0);
  };

  useEffect(() => {
    const pollIntervalMs = open ? 20_000 : 60_000;
    void load();
    const id = setInterval(() => {
      if (!document.hidden) {
        void load();
      }
    }, pollIntervalMs);
    return () => clearInterval(id);
  }, [open]);

  useEffect(() => {
    const onVisibilityChange = () => {
      if (!document.hidden) {
        void load();
      }
    };
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => document.removeEventListener("visibilitychange", onVisibilityChange);
  }, []);

  const markAllRead = async () => {
    await fetch("/api/notifications/read", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    await load();
  };

  const unreadLabel = useMemo(() => (unread > 9 ? "9+" : String(unread)), [unread]);

  return (
    <div className="relative">
      <button
        aria-label="Notificacoes"
        className="relative inline-flex h-9 w-9 items-center justify-center rounded-md border border-amber-200/25 bg-black/25"
        onClick={() => setOpen((prev) => !prev)}
        type="button"
      >
        <svg viewBox="0 0 24 24" className="h-4 w-4 text-amber-100" aria-hidden>
          <path
            d="M12 4a5 5 0 0 0-5 5v3.2c0 .7-.2 1.4-.6 2L5 16h14l-1.4-1.8a3.4 3.4 0 0 1-.6-2V9a5 5 0 0 0-5-5zm0 17a2.4 2.4 0 0 0 2.2-1.5h-4.4A2.4 2.4 0 0 0 12 21z"
            fill="currentColor"
          />
        </svg>
        {unread > 0 && (
          <span className="absolute -right-2 -top-2 rounded-full bg-red-500 px-1 text-[10px] text-white">{unreadLabel}</span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 z-40 mt-2 w-[min(22rem,90vw)] rounded-lg border border-amber-200/20 bg-slate-950/95 p-3 shadow-xl">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-sm font-semibold text-amber-200">Caixa de notificacoes</p>
            <Button variant="ghost" className="px-2 py-1 text-xs" onClick={markAllRead}>Marcar tudo</Button>
          </div>

          <div className="max-h-72 space-y-2 overflow-auto">
            {items.map((item) => (
              <div key={item.id} className={`rounded-md border p-2 text-xs ${item.readAt ? "border-amber-100/10" : "border-amber-300/35"}`}>
                <p className="font-semibold text-amber-100">{item.title}</p>
                <p className="text-amber-50/80">{item.message}</p>
                <p className="mt-1 text-[10px] text-amber-100/60">{new Date(item.createdAt).toLocaleString("pt-BR")}</p>
              </div>
            ))}
            {items.length === 0 && <p className="text-xs text-amber-100/80">Sem notificacoes.</p>}
          </div>
        </div>
      )}
    </div>
  );
}
