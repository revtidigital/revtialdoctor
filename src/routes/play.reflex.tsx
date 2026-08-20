import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { motion, AnimatePresence } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { Header } from "@/components/Header";
import { ProgressDots } from "@/components/ProgressDots";
import { StartOverlay } from "@/components/StartOverlay";
import { saveGameScore } from "@/lib/storage";
import { trackEvent } from "@/lib/analytics";
import logo from "@/assets/revital-logo.png";

export const Route = createFileRoute("/play/reflex")({
  component: ReflexGame,
});

type Phase = "idle" | "waiting" | "go" | "tooSoon" | "done";
const ROUNDS = 3;
const MIN_DELAY = 1800;
const MAX_DELAY = 5200;

function ReflexGame() {
  const nav = useNavigate();
  const [showStart, setShowStart] = useState(true);
  const [phase, setPhase] = useState<Phase>("idle");
  const [round, setRound] = useState(0);
  const [times, setTimes] = useState<number[]>([]);
  const [lastReactionMs, setLastReactionMs] = useState<number | null>(null);
  const startRef = useRef(0);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const rafRef = useRef<number | null>(null);

  useEffect(
    () => () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    },
    [],
  );

  const startRound = () => {
    setPhase("waiting");
    // Slightly wider random delay range to make anticipation harder.
    const delay = Math.floor(Math.random() * (MAX_DELAY - MIN_DELAY + 1)) + MIN_DELAY;
    timeoutRef.current = setTimeout(() => {
      setPhase("go");
      rafRef.current = requestAnimationFrame(() => {
        startRef.current = performance.now();
        rafRef.current = null;
      });
    }, delay);
  };

  const finish = (allTimes: number[]) => {
    const bestTime = Math.min(...allTimes);
    const rawScore = 1500 * (1 - bestTime / 15000);
    const score = Math.round(Math.max(0, Math.min(1500, rawScore)));
    saveGameScore("reflex", score);
    trackEvent("game_complete", { game_type: "reflex", score });
    setPhase("done");
    setTimeout(() => nav({ to: "/play/memory" }), 1500);
  };

  const completeRound = (reactionMs: number, premature = false) => {
    setLastReactionMs(reactionMs);
    const next = [...times, reactionMs];
    const nextRound = round + 1;
    setTimes(next);
    setRound(nextRound);

    if (nextRound >= ROUNDS) {
      finish(next);
      return;
    }

    if (premature) {
      setPhase("tooSoon");
      timeoutRef.current = setTimeout(() => {
        setPhase("idle");
        startRound();
      }, 1500);
      return;
    }

    setPhase("idle");
    timeoutRef.current = setTimeout(startRound, 1000);
  };

  const handleTap = () => {
    if (showStart || phase === "done") return;

    if (phase === "idle") {
      startRound();
      return;
    }

    if (phase === "waiting") {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      completeRound(0, true);
      return;
    }

    if (phase === "go") {
      const reflexMs = Math.round(performance.now() - startRef.current);
      completeRound(reflexMs);
    }
  };

  const label: Record<Phase, string> = {
    idle: "Tap to begin",
    waiting: `Round ${round + 1}`,
    go: "TAP NOW!",
    tooSoon: "Too early!",
    done: "Complete!",
  };

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      {showStart && (
        <StartOverlay
          emoji="⚡"
          title="Reflex Tap"
          lines={[
            "Tap the screen as soon as the Revital logo appears.",
            "The faster you react, the higher your score.",
            "Don’t tap too early!",
          ]}
          onStart={() => {
            setShowStart(false);
            trackEvent("game_start", { game_type: "reflex" });
          }}
        />
      )}
      <main className="flex-1 max-w-3xl w-full mx-auto px-4 py-6 flex flex-col">
        <div className="text-center">
          <h1 className="text-2xl md:text-4xl font-black">⚡ Reflex Tap</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Best reaction time from 3 rounds decides your Reflex score
          </p>
          <ProgressDots current="reflex" />
        </div>

        <button
          onClick={handleTap}
          disabled={showStart || phase === "done"}
          className="mt-6 flex-1 min-h-[60vh] w-full rounded-3xl border border-white/25 overflow-hidden relative active:scale-[0.99] transition-transform select-none bg-gradient-energy"
          aria-label="Reflex tap area"
        >
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.12),transparent_55%)]" />
          <AnimatePresence mode="sync">
            <motion.div
              key={phase}
              initial={phase === "go" ? { opacity: 1, scale: 1 } : { scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              transition={{ duration: phase === "go" ? 0 : 0.15 }}
              className="absolute inset-0 flex flex-col items-center justify-center px-4"
            >
              {phase === "go" ? (
                <img
                  src={logo}
                  alt="Revital Ginseng Plus"
                  className="w-[130px] md:w-[180px] h-auto drop-shadow-[0_14px_26px_rgba(0,0,0,0.45)]"
                />
              ) : (
                <p className="mt-6 text-2xl md:text-5xl font-black text-white drop-shadow-[0_3px_6px_rgba(0,0,0,0.35)]">
                  {label[phase]}
                </p>
              )}
              {phase === "tooSoon" && (
                <p className="mt-2 text-sm md:text-base text-white/85">
                  Wait for the logo to appear.
                </p>
              )}
              {lastReactionMs !== null && phase !== "done" && (
                <p className="mt-3 text-sm md:text-base text-white/90">
                  Reaction time: <span className="font-bold">{lastReactionMs} ms</span>
                </p>
              )}
              {phase === "done" && (
                <div className="mt-6 text-center">
                  <p className="text-2xl font-bold text-white">Loading next challenge…</p>
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </button>

        <Link
          to="/challenges"
          className="mt-3 text-center text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          ← Back to challenges
        </Link>
      </main>
    </div>
  );
}
