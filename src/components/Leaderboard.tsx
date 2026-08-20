import { motion } from "framer-motion";
import type { LeaderEntry } from "@/lib/leaderboard";

const medals = ["🥇", "🥈", "🥉"];

export function Leaderboard({
  title,
  subtitle,
  emoji,
  entries,
  accent = "tiger",
  highlightWinner = true,
}: {
  title: string;
  subtitle: string;
  emoji: string;
  entries: LeaderEntry[];
  accent?: "tiger" | "marigold";
  highlightWinner?: boolean;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.5 }}
      className="bg-white/90 backdrop-blur-sm border-2 border-[var(--garnet)]/10 rounded-3xl p-5 md:p-6 shadow-card overflow-hidden relative"
    >
      <div
        className={`absolute -top-12 -right-12 w-40 h-40 rounded-full blur-3xl opacity-40 ${
          accent === "marigold" ? "bg-[var(--marigold)]" : "bg-[var(--tiger)]"
        }`}
      />
      <div className="relative">
        <div className="flex items-center gap-3">
          <div className="text-3xl">{emoji}</div>
          <div>
            <h3 className="text-xl md:text-2xl font-black text-garnet leading-tight">{title}</h3>
            <p className="text-xs text-muted-foreground uppercase tracking-wider">{subtitle}</p>
          </div>
        </div>

        <ul className="mt-5 space-y-2">
          {entries.map((e, i) => (
            <motion.li
              key={`${e.contact}-${i}`}
              initial={{ opacity: 0, x: -10 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.05 * i }}
              className={`flex items-center gap-3 rounded-2xl px-3 py-2.5 transition-colors ${
                highlightWinner && i === 0
                  ? "bg-gradient-to-r from-[var(--marigold)]/40 to-[var(--honey)]/20 border border-[var(--honey)]/40"
                  : "bg-[var(--background)]/60 hover:bg-[var(--background)]"
              }`}
            >
              <div className="w-8 text-center text-lg font-black">
                {highlightWinner && i < 3 ? (
                  medals[i]
                ) : (
                  <span className="text-muted-foreground">{i + 1}</span>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-bold text-garnet truncate text-sm md:text-base">{e.name}</div>
                <div className="text-[11px] text-muted-foreground truncate">
                  {e.contact} • {e.when}
                </div>
              </div>
              <div className="text-right">
                <div className="text-lg md:text-xl font-black text-gradient-energy">{e.total}</div>
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  pts
                </div>
              </div>
            </motion.li>
          ))}
        </ul>
      </div>
    </motion.div>
  );
}
