import { createFileRoute, Link } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { Header } from "@/components/Header";
import { ChallengeProgressBar } from "@/components/ChallengeProgressBar";
import { getCurrentScores, getNextGame, CHALLENGE_ORDER } from "@/lib/storage";
import { useEffect, useState } from "react";

export const Route = createFileRoute("/challenges")({
  component: Challenges,
});

const nextRoute: Record<string, "/play/reflex" | "/play/memory" | "/play/balance"> = {
  reflex: "/play/reflex",
  memory: "/play/memory",
  balance: "/play/balance",
};

function Challenges() {
  const [scores, setScores] = useState<ReturnType<typeof getCurrentScores>>({
    reflex: null,
    memory: null,
    balance: null,
  });
  useEffect(() => {
    setScores(getCurrentScores());
  }, []);
  const allDone = CHALLENGE_ORDER.every((k) => scores[k] !== null);
  const next = getNextGame();

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1 max-w-5xl mx-auto px-4 py-8 md:py-12">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center"
        >
          <div className="inline-block px-4 py-1.5 rounded-full bg-[var(--marigold)] text-garnet text-xs uppercase tracking-[0.2em] font-black">
            Step by Step
          </div>
          <h1 className="mt-3 text-3xl md:text-5xl font-black text-garnet">
            Your <span className="text-gradient-energy">Challenge Path</span>
          </h1>
          <p className="mt-3 text-muted-foreground">
            Complete each challenge in order to unlock the next.
          </p>
          <ChallengeProgressBar />
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="mt-10 text-center"
        >
          {allDone ? (
            <Link
              to="/result"
              className="inline-flex px-8 py-4 rounded-full bg-gradient-energy text-white font-bold shadow-button glow-pulse hover:scale-105 active:scale-95 transition-transform"
            >
              See Your Score →
            </Link>
          ) : next ? (
            <Link
              to={nextRoute[next]}
              className="inline-flex px-8 py-4 rounded-full bg-gradient-energy text-white font-bold shadow-button glow-pulse hover:scale-105 active:scale-95 transition-transform"
            >
              ▶ Continue Challenge
            </Link>
          ) : null}
          <p className="mt-4 text-sm text-muted-foreground">
            Each challenge lasts up to 20 seconds.
          </p>
        </motion.div>
      </main>
    </div>
  );
}
