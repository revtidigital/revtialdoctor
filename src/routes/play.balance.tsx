import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { motion, AnimatePresence } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { Header } from "@/components/Header";
import { ProgressDots } from "@/components/ProgressDots";
import { StartOverlay } from "@/components/StartOverlay";
import { isGameUnlocked, saveGameScore } from "@/lib/storage";
import { trackEvent } from "@/lib/analytics";

export const Route = createFileRoute("/play/balance")({
  component: BalanceGame,
});

const DURATION = 20; // seconds (aligned with demo)
const GRAVITY = 0.35;
const TAP_BOOST = -6.5;
const TARGET_Y = 50; // % from top — sweet zone center
const TARGET_BAND = 15; // % half-width (35% to 65% zone)

function BalanceGame() {
  const nav = useNavigate();
  const [showStart, setShowStart] = useState(true);
  const [running, setRunning] = useState(false);
  const [done, setDone] = useState(false);
  const [y, setY] = useState(50);
  const vRef = useRef(0);
  const yRef = useRef(50);
  const [time, setTime] = useState(DURATION);
  const [hold, setHold] = useState(0); // ms in zone
  const lastFrame = useRef(0);
  const rafRef = useRef<number>(0);
  const startedAt = useRef(0);

  useEffect(() => {
    if (!isGameUnlocked("balance")) nav({ to: "/challenges" });
  }, [nav]);

  const start = () => {
    if (done) {
      setDone(false);
      setHold(0);
    }
    yRef.current = 50;
    vRef.current = 0;
    setY(50);
    setTime(DURATION);
    startedAt.current = performance.now();
    lastFrame.current = performance.now();
    setRunning(true);
    trackEvent("game_start", { game_type: "balance" });
  };

  useEffect(() => {
    if (!running) return;
    const tick = (t: number) => {
      const frameMs = Math.min(48, t - lastFrame.current);
      const dt = frameMs / 16.67;
      lastFrame.current = t;
      vRef.current += GRAVITY * dt;
      yRef.current += vRef.current * dt;
      if (yRef.current > 95) {
        yRef.current = 95;
        vRef.current = 0;
      }
      if (yRef.current < 5) {
        yRef.current = 5;
        vRef.current = Math.max(0, vRef.current);
      }
      setY(yRef.current);

      if (Math.abs(yRef.current - TARGET_Y) < TARGET_BAND) {
        setHold((h) => h + frameMs);
      }

      const elapsed = (t - startedAt.current) / 1000;
      const remaining = Math.max(0, DURATION - elapsed);
      setTime(remaining);

      if (remaining <= 0) {
        setRunning(false);
        setDone(true);
        return;
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [running]);

  // Save score on done
  useEffect(() => {
    if (done) {
      const rawScore = (hold / 15000) * 1500;
      const score = Math.round(Math.max(0, Math.min(1500, rawScore)));
      saveGameScore("balance", score);
      trackEvent("game_complete", { game_type: "balance", score });
      const t = setTimeout(() => nav({ to: "/result" }), 1500);
      return () => clearTimeout(t);
    }
  }, [done, hold, nav]);

  const tap = () => {
    if (!running) {
      start();
      return;
    }
    vRef.current = TAP_BOOST;
  };

  const inZone = Math.abs(y - TARGET_Y) < TARGET_BAND;

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      {showStart && (
        <StartOverlay
          emoji="🔥"
          title="Tap Balance"
          lines={[
            "Keep the ball inside the box for as long as possible.",
            "Control it carefully for the full 15 seconds.",
            "The longer it stays in, the higher your score!",
          ]}
          onStart={() => setShowStart(false)}
        />
      )}
      <main className="flex-1 max-w-md w-full mx-auto px-4 py-6 flex flex-col">
        <div className="text-center">
          <h1 className="text-2xl md:text-4xl font-black">🔥 Tap Balance</h1>
          <p className="text-sm text-muted-foreground mt-1">Keep the ember in the zone</p>
          <ProgressDots current="balance" />
        </div>

        <div className="mt-4 flex justify-around bg-gradient-card border border-border rounded-2xl p-3">
          <div className="text-center">
            <div className="text-xs uppercase tracking-wider text-muted-foreground">Time</div>
            <div className="text-xl font-black text-gradient-energy">{time.toFixed(1)}s</div>
          </div>
          <div className="text-center">
            <div className="text-xs uppercase tracking-wider text-muted-foreground">In Zone</div>
            <div className="text-xl font-black text-gradient-energy">
              {(hold / 1000).toFixed(1)}s
            </div>
          </div>
        </div>

        <button
          onClick={tap}
          className="mt-4 flex-1 min-h-[55vh] relative w-full rounded-3xl border border-border overflow-hidden bg-gradient-to-b from-[oklch(0.25_0.05_40)] to-[oklch(0.15_0.03_40)] active:scale-[0.99] transition-transform select-none"
          aria-label="Tap to lift ember"
        >
          {/* target zone — capsule shape */}
          <div
            className={`absolute left-[8%] right-[8%] rounded-full border-2 flex items-center justify-center ${inZone ? "border-accent bg-accent/20" : "border-accent/40 bg-accent/5"} transition-colors`}
            style={{ top: `${TARGET_Y - TARGET_BAND}%`, height: `${TARGET_BAND * 2}%` }}
          >
            <span className="text-xs uppercase tracking-widest text-accent/80 pointer-events-none select-none">
              ⟶ Revital Zone ⟵
            </span>
          </div>

          {/* ember */}
          <motion.div
            className="absolute left-1/2 -translate-x-1/2 w-16 h-16 md:w-20 md:h-20 rounded-full bg-gradient-energy shadow-glow"
            style={{ top: `calc(${y}% - 2rem)` }}
            animate={{ scale: inZone ? [1, 1.1, 1] : 1 }}
            transition={{ duration: 0.6, repeat: Infinity }}
          />

          {!running && !done && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="bg-background/80 backdrop-blur px-6 py-4 rounded-2xl border border-border">
                <p className="font-black text-xl">Tap to Start</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Tap repeatedly to fight gravity
                </p>
              </div>
            </div>
          )}
        </button>

        <AnimatePresence>
          {done && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="fixed inset-0 z-[90] flex items-center justify-center bg-background/85 backdrop-blur-md px-4"
            >
              <div className="bg-gradient-card border border-border rounded-3xl p-8 text-center shadow-card max-w-sm w-full">
                <div className="text-5xl mb-3">🔥</div>
                <h2 className="text-2xl font-black text-gradient-energy">Challenge complete!</h2>
                <p className="mt-3 text-sm text-muted-foreground">Calculating your Energy Score…</p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

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
