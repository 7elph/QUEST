"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    Sentry.captureException(error);
    fetch("/api/telemetry/client-error", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        message: error.message,
        stack: error.stack,
        digest: error.digest,
        route: typeof window !== "undefined" ? window.location.pathname : undefined,
      }),
    }).catch(() => {
      // noop
    });
  }, [error]);

  return (
    <html lang="pt-BR">
      <body className="bg-slate-950 text-amber-100">
        <main className="mx-auto flex min-h-screen max-w-2xl flex-col items-center justify-center gap-4 px-6 text-center">
          <h1 className="text-3xl font-semibold text-amber-200">Erro inesperado</h1>
          <p className="text-sm text-amber-100/80">A falha foi registrada para analise. Tente novamente.</p>
          <button
            onClick={() => reset()}
            className="rounded-md border border-amber-300/60 bg-amber-500/20 px-4 py-2 text-sm hover:bg-amber-500/35"
          >
            Tentar de novo
          </button>
        </main>
      </body>
    </html>
  );
}
