import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { motion, AnimatePresence } from "framer-motion";
import { useEffect, useMemo, useState } from "react";
import { Header } from "@/components/Header";
import { ProgressDots } from "@/components/ProgressDots";
import { StartOverlay } from "@/components/StartOverlay";
import { isGameUnlocked, saveGameScore } from "@/lib/storage";
import { trackEvent } from "@/lib/analytics";
import revitalLogo from "@/assets/revital-logo.png";

export const Route = createFileRoute("/play/memory")({
  component: MemoryGame,
});

const CARD_TYPES = [
  { key: "energy", icon: "⚡", label: "Energy Strike" },
  { key: "gym", icon: "🏋️", label: "Active Gym" },
  { key: "dart", icon: "🎯", label: "Dart Focus" },
  { key: "shield", icon: "🛡️", label: "Revital Shield" },
] as const;

const MAX_DURATION = 15; // seconds
const TOTAL_PAIRS = CARD_TYPES.length;
const STARTING_CAPSULES = 3;
const PREVIEW_DURATION_MS = 800;

interface Card {
  id: number;
  key: string;
  icon: string;
  label: string;
  matched: boolean;
}

function shuffle<T>(arr: T[]) {
  return arr
    .map((v) => [Math.random(), v] as const)
    .sort((a, b) => a[0] - b[0])
    .map(([, v]) => v);
}

function buildDeck(): Card[] {
  return shuffle([...CARD_TYPES, ...CARD_TYPES]).map((item, i) => ({
    id: i,
    key: item.key,
    icon: item.icon,
    label: item.label,
    matched: false,
  }));
}

function MemoryGame() {
  const nav = useNavigate();
  const [showStart, setShowStart] = useState(true);
  const [deck, setDeck] = useState<Card[]>(buildDeck);
  const [flipped, setFlipped] = useState<number[]>([]);
  const [moves, setMoves] = useState(0);
  const [seconds, setSeconds] = useState(0);
  const [done, setDone] = useState(false);
  const [capsulesLeft, setCapsulesLeft] = useState(STARTING_CAPSULES);
  const [isPreviewing, setIsPreviewing] = useState(false);

  useEffect(() => {
    if (!isGameUnlocked("memory")) nav({ to: "/challenges" });
  }, [nav]);

  useEffect(() => {
    if (done || showStart || isPreviewing) return;
    const t = setInterval(
      () =>
        setSeconds((s) => {
          const next = s + 1;
          if (next >= MAX_DURATION) setDone(true);
          return next;
        }),
      1000,
    );
    return () => clearInterval(t);
  }, [done, showStart, isPreviewing]);

  useEffect(() => {
    if (!isPreviewing) return;
    const t = setTimeout(() => setIsPreviewing(false), PREVIEW_DURATION_MS);
    return () => clearTimeout(t);
  }, [isPreviewing]);

  useEffect(() => {
    if (flipped.length !== 2) return;
    setMoves((m) => m + 1);
    const [a, b] = flipped;
    const ca = deck.find((c) => c.id === a)!;
    const cb = deck.find((c) => c.id === b)!;
    if (ca.key === cb.key) {
      setTimeout(() => {
        setDeck((d) => d.map((c) => (c.id === a || c.id === b ? { ...c, matched: true } : c)));
        setFlipped([]);
      }, 350);
    } else {
      setCapsulesLeft((n) => Math.max(0, n - 1));
      setTimeout(() => setFlipped([]), 2000);
    }
  }, [flipped, deck]);

  useEffect(() => {
    if (deck.every((c) => c.matched) && !done) setDone(true);
  }, [deck, done]);

  useEffect(() => {
    if (capsulesLeft <= 0 && !done) setDone(true);
  }, [capsulesLeft, done]);

  const matchedPairs = useMemo(() => deck.filter((c) => c.matched).length / 2, [deck]);
  const wrongMoves = STARTING_CAPSULES - capsulesLeft;
  const hasMatchedAllPairs = matchedPairs === TOTAL_PAIRS;
  const endMessage = hasMatchedAllPairs && wrongMoves <= 1 ? "Nice work" : "You can do better";

  useEffect(() => {
    if (!done) return;

    const remainingMs = Math.max(0, (MAX_DURATION - seconds) * 1000);
    const timeScore = Math.round((Math.min(remainingMs, 15000) / 15000) * 1000);
    const pairScore = matchedPairs * 75;
    const accuracyScore =
      capsulesLeft >= 3 ? 200 : capsulesLeft === 2 ? 130 : capsulesLeft === 1 ? 60 : 0;

    const rawScore = timeScore + pairScore + accuracyScore;
    const finalScore = Math.round(Math.max(0, Math.min(1500, rawScore)));

    saveGameScore("memory", finalScore);
    trackEvent("game_complete", {
      game_type: "memory",
      score: finalScore,
      matched_pairs: matchedPairs,
    });
    const t = setTimeout(() => nav({ to: "/play/balance" }), 1500);
    return () => clearTimeout(t);
  }, [done, matchedPairs, seconds, capsulesLeft, nav]);

  const flip = (id: number) => {
    if (showStart || done || isPreviewing) return;
    if (flipped.length === 2) return;
    if (flipped.includes(id)) return;
    if (deck.find((c) => c.id === id)?.matched) return;
    setFlipped([...flipped, id]);
  };

  // 3x3 layout with fixed center logo
  const grid: (Card | "center")[] = [
    deck[0],
    deck[1],
    deck[2],
    deck[3],
    "center",
    deck[4],
    deck[5],
    deck[6],
    deck[7],
  ];

  return (
    <div className="min-h-screen">
      <Header />
      {showStart && (
        <StartOverlay
          emoji="🧠"
          title="Memory Match"
          lines={[
            "Flip two cards at a time to find matching pairs.",
            "Match all pairs within 15 seconds.",
            "Be careful, you only have 3 lives!",
          ]}
          onStart={() => {
            setShowStart(false);
            setIsPreviewing(true);
            trackEvent("game_start", { game_type: "memory" });
          }}
        />
      )}
      <main className="max-w-2xl mx-auto px-4 py-4 md:py-3">
        <div className="text-center">
          <h1 className="text-2xl md:text-4xl font-black">🧠 Memory Match</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Match all {TOTAL_PAIRS} pairs · {Math.max(0, MAX_DURATION - seconds)}s left
          </p>
          {isPreviewing && (
            <p className="text-xs text-garnet mt-1">
              Memorize the cards… they flip in {PREVIEW_DURATION_MS / 1000}s
            </p>
          )}
          <ProgressDots current="memory" />
        </div>

        <div className="mt-5 flex justify-around bg-gradient-card border border-border rounded-2xl p-3">
          <Stat label="Moves" value={moves} />
          <Stat label="Time" value={`${seconds}s`} />
          <Stat label="Capsules" value={capsulesLeft} />
          <Stat label="Pairs" value={`${matchedPairs}/${TOTAL_PAIRS}`} />
        </div>

        <div className="mt-4 md:mt-3 grid grid-cols-3 gap-2 md:gap-2.5 w-full max-w-[30rem] mx-auto">
          {grid.map((cell, idx) => {
            if (cell === "center") {
              return (
                <div
                  key="center"
                  className="aspect-square rounded-2xl bg-gradient-card border-2 border-accent/60 shadow-glow flex items-center justify-center p-3 relative overflow-hidden"
                >
                  <img
                    src={revitalLogo}
                    alt="Revital Ginseng Plus"
                    className="w-full h-full object-contain"
                  />
                </div>
              );
            }
            const card = cell;
            const isUp = isPreviewing || flipped.includes(card.id) || card.matched;
            return (
              <button
                key={`c-${card.id}-${idx}`}
                onClick={() => flip(card.id)}
                className="aspect-square perspective-card group"
                disabled={card.matched || done || showStart || isPreviewing}
                aria-label="card"
              >
                <div
                  className={`relative w-full h-full preserve-3d transition-transform duration-500 ${isUp ? "[transform:rotateY(180deg)]" : ""}`}
                >
                  <div className="absolute inset-0 backface-hidden rounded-2xl bg-gradient-energy shadow-card group-active:scale-95 transition-transform flex items-center justify-center">
                    <span className="text-2xl text-energy-foreground/40 font-black">?</span>
                  </div>
                  <div
                    className={`absolute inset-0 backface-hidden [transform:rotateY(180deg)] rounded-2xl ${card.matched ? "bg-accent/30 ring-2 ring-accent" : "bg-card"} border border-border flex flex-col items-center justify-center text-center px-1`}
                  >
                    <span className="text-2xl md:text-4xl leading-none">{card.icon}</span>
                    <span className="mt-1 text-[10px] md:text-xs font-bold uppercase tracking-wide text-foreground/90">
                      {card.label}
                    </span>
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        <AnimatePresence>
          {done && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="fixed inset-0 z-[90] flex items-center justify-center bg-background/85 backdrop-blur-md px-4"
            >
              <div className="bg-gradient-card border border-border rounded-3xl p-8 text-center shadow-card max-w-sm w-full">
                <div className="text-5xl mb-3">🧠</div>
                <h2 className="text-2xl font-black text-gradient-energy">{endMessage}</h2>
                <p className="mt-3 text-sm text-muted-foreground">Loading next challenge…</p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <Link
          to="/challenges"
          className="mt-4 block text-center text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          ← Back to challenges
        </Link>
      </main>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="text-center">
      <div className="text-xs uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="text-xl font-black text-gradient-energy">{value}</div>
    </div>
  );
}
