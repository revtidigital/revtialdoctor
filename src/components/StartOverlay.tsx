import { motion } from "framer-motion";
import { useEffect } from "react";

interface StartOverlayProps {
  emoji?: string;
  title: string;
  lines: string[];
  onStart: () => void;
}

export function StartOverlay({ emoji, title, lines, onStart }: StartOverlayProps) {
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      onClick={(e) => e.stopPropagation()}
      onTouchStart={(e) => e.stopPropagation()}
      className="fixed inset-0 z-[100] flex items-center justify-center bg-background/85 backdrop-blur-md px-4 overscroll-contain touch-none"
    >
      <motion.div
        initial={{ scale: 0.9, y: 20, opacity: 0 }}
        animate={{ scale: 1, y: 0, opacity: 1 }}
        className="w-full max-w-md bg-gradient-card border border-border rounded-3xl p-6 text-center shadow-card"
      >
        {emoji && <div className="text-5xl mb-3">{emoji}</div>}
        <h2 className="text-2xl md:text-3xl font-black text-gradient-energy">{title}</h2>
        <div className="mt-4 space-y-1.5">
          {lines.map((l, i) => (
            <p key={i} className="text-sm md:text-base text-muted-foreground">
              {l}
            </p>
          ))}
        </div>
        <button
          onClick={onStart}
          className="mt-6 w-full py-4 rounded-full bg-gradient-energy text-energy-foreground font-bold shadow-button hover:scale-105 active:scale-95 transition-transform"
        >
          ▶ Start Now
        </button>
        <p className="mt-3 text-xs text-muted-foreground">15 seconds max</p>
      </motion.div>
    </motion.div>
  );
}
