const steps = ["NONE", "PENDING", "CONFIRMED", "RELEASED", "REFUNDED"];

export function EscrowTimeline({ status }: { status: string }) {
  return (
    <div className="rounded-md border border-amber-100/20 bg-black/20 p-3">
      <p className="text-sm font-semibold text-amber-200">Timeline de Escrow</p>
      <div className="mt-2 flex flex-wrap gap-2 text-xs">
        {steps.map((step) => {
          const active = step === status;
          return (
            <span
              key={step}
              className={`rounded-full border px-3 py-1 ${active ? "border-amber-300 bg-amber-500/20 text-amber-100" : "border-amber-100/20 text-amber-100/70"}`}
            >
              {step}
            </span>
          );
        })}
      </div>
    </div>
  );
}
