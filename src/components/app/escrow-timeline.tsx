const steps = ["NONE", "PENDING", "CONFIRMED", "RELEASED", "REFUNDED"];

export function EscrowTimeline({ status }: { status: string }) {
  return (
    <div className="p-1 text-[#1b130f]">
      <p className="text-sm font-semibold text-[#1b130f]">Timeline de Escrow</p>
      <div className="mt-2 flex flex-wrap gap-2 text-xs">
        {steps.map((step) => {
          const active = step === status;
          return (
            <span
              key={step}
              className={`rounded-full border px-3 py-1 font-semibold ${
                active
                  ? "border-[#5a3829]/45 bg-[#f5e3bf]/80 text-[#1b130f]"
                  : "border-[#5a3829]/25 bg-[#f5e3bf]/45 text-[#3d271c]/85"
              }`}
            >
              {step}
            </span>
          );
        })}
      </div>
    </div>
  );
}
