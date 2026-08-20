import { getCurrentScores } from "@/lib/storage";

export function ProgressDots({ current }: { current?: "reflex" | "memory" | "balance" }) {
  const s = getCurrentScores();
  const items: Array<{ key: "reflex" | "memory" | "balance"; label: string }> = [
    { key: "reflex", label: "Reflex" },
    { key: "memory", label: "Memory" },
    { key: "balance", label: "Balance" },
  ];
  return (
    <div className="mt-5 flex items-center justify-center gap-2 md:gap-3">
      {items.map((it, i) => {
        const done = s[it.key] !== null;
        const active = current === it.key;
        return (
          <div key={it.key} className="flex items-center gap-2 md:gap-3">
            <div className="flex flex-col items-center gap-2">
              <div
                className={`h-3.5 w-3.5 rounded-full transition-all duration-300 ${
                  done
                    ? "bg-gradient-energy shadow-glow"
                    : active
                      ? "bg-accent ring-4 ring-accent/30 shadow-[0_0_18px_rgba(255,164,51,0.45)]"
                      : "bg-muted"
                }`}
              />
              <span
                className={`rounded-full border px-3 py-1 text-[11px] font-bold uppercase tracking-[0.16em] transition-all md:text-xs ${
                  done
                    ? "border-[var(--honey)]/70 bg-[var(--honey)]/15 text-garnet"
                    : active
                      ? "border-[var(--tiger)]/80 bg-white/85 text-garnet shadow-sm"
                      : "border-border/70 bg-background/35 text-muted-foreground"
                }`}
              >
                {it.label}
              </span>
            </div>
            {i < items.length - 1 && (
              <div className="h-px w-7 bg-gradient-to-r from-transparent via-border to-transparent md:w-10" />
            )}
          </div>
        );
      })}
    </div>
  );
}
