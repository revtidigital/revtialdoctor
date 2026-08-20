import { motion } from "framer-motion";
import { CHALLENGE_ORDER, getCurrentScores, type GameKey } from "@/lib/storage";

const LABELS: Record<GameKey, { name: string; emoji: string }> = {
  reflex: { name: "Reflex Tap", emoji: "⚡" },
  memory: { name: "Memory Match", emoji: "🧠" },
  balance: { name: "Tap Balance", emoji: "🔥" },
};

export function ChallengeProgressBar({ current }: { current?: GameKey }) {
  const scores = getCurrentScores();
  const completed = CHALLENGE_ORDER.filter((k) => scores[k] !== null).length;
  const total = CHALLENGE_ORDER.length;
  const pct = (completed / total) * 100;

  return (
    <div className="w-full max-w-2xl mx-auto mt-6">
      {/* Animated bar */}
      <div className="relative h-4 rounded-full bg-white/70 border border-[var(--garnet)]/15 overflow-hidden shadow-inner">
        <motion.div
          className="h-full rounded-full bg-gradient-energy progress-stripes relative"
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
        >
          <span className="absolute inset-0 shimmer rounded-full" />
        </motion.div>
      </div>

      {/* Step nodes */}
      <div className="mt-4 grid grid-cols-3 gap-2">
        {CHALLENGE_ORDER.map((key, i) => {
          const done = scores[key] !== null;
          const active = current === key || (!done && i === completed);
          const locked = !done && i > completed;
          return (
            <motion.div
              key={key}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 * i }}
              className={`relative flex flex-col items-center text-center p-3 rounded-2xl border-2 transition-all ${
                done
                  ? "bg-gradient-to-br from-[var(--marigold)]/30 to-[var(--honey)]/20 border-[var(--honey)]"
                  : active
                    ? "bg-white border-[var(--tiger)] shadow-glow"
                    : "bg-white/40 border-[var(--garnet)]/10 opacity-60"
              }`}
            >
              <div
                className={`relative w-10 h-10 md:w-12 md:h-12 rounded-full flex items-center justify-center text-xl md:text-2xl font-black mb-1 ${
                  done
                    ? "bg-gradient-energy text-white shadow-button"
                    : active
                      ? "bg-[var(--tiger)] text-white shadow-button glow-pulse"
                      : "bg-muted text-muted-foreground"
                }`}
              >
                {done ? "✓" : locked ? "🔒" : i + 1}
              </div>
              <div className="text-[10px] md:text-xs font-bold text-garnet leading-tight">
                {LABELS[key].emoji} {LABELS[key].name}
              </div>
              {done && (
                <div className="text-[10px] font-bold text-[var(--tiger)] mt-0.5">
                  {scores[key]} pts
                </div>
              )}
            </motion.div>
          );
        })}
      </div>

      <div className="mt-3 text-center text-xs md:text-sm text-muted-foreground">
        <span className="font-bold text-garnet">{completed}</span> of {total} challenges complete
      </div>
    </div>
  );
}
