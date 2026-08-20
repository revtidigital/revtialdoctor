import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { Header } from "@/components/Header";
import { SignupGate } from "@/components/SignupGate";
import {
  categorize,
  computeTotal,
  getCurrentScores,
  getUser,
  isLoggedIn,
  resetScores,
  saveUserRemote,
  totalToPercentage,
  type GameScores,
} from "@/lib/storage";
import { buildShareCard, buildShareCardFromTemplate } from "@/lib/shareCard";
import { trackEvent } from "@/lib/analytics";

export const Route = createFileRoute("/result")({
  component: Result,
});

function Result() {
  const nav = useNavigate();
  const [scores, setScores] = useState<GameScores>({ reflex: null, memory: null, balance: null });
  const [animatedTotal, setAnimatedTotal] = useState(0);
  const [animatedPct, setAnimatedPct] = useState(0);
  const [unlocked, setUnlocked] = useState(false);
  const [shareNotice, setShareNotice] = useState<string | null>(null);
  const noticeTimeout = useRef<number | null>(null);

  useEffect(() => {
    const s = getCurrentScores();
    setScores(s);
    if (s.reflex === null || s.memory === null || s.balance === null) {
      nav({ to: "/challenges" });
      return;
    }
    setUnlocked(isLoggedIn());
  }, [nav]);

  useEffect(() => {
    if (!unlocked) return;
    const total = computeTotal(scores);
    trackEvent("score_revealed", {
      total,
      category: categorize(total).label,
      percentage: totalToPercentage(total),
    });
    let cur = 0;
    setAnimatedTotal(0);
    setAnimatedPct(0);
    const step = Math.max(1, Math.round(total / 60));
    const t = setInterval(() => {
      cur += step;
      if (cur >= total) {
        cur = total;
        clearInterval(t);
      }
      setAnimatedTotal(cur);
      setAnimatedPct(totalToPercentage(cur));
    }, 25);
    return () => clearInterval(t);
  }, [unlocked, scores]);

  const total = computeTotal(scores);
  const cat = categorize(total);
  const pct = totalToPercentage(total);

  const shareUrl = typeof window !== "undefined" ? window.location.origin : "https://revital.com";
  const shareText = `I scored ${total} — ${cat.label} on the Revital Energy Challenge ⚡ Tag @revital.uae on Instagram & boost your chance to win!`;
  const showShareNotice = (message: string) => {
    setShareNotice(message);
    if (noticeTimeout.current) {
      window.clearTimeout(noticeTimeout.current);
    }
    noticeTimeout.current = window.setTimeout(() => {
      setShareNotice(null);
      noticeTimeout.current = null;
    }, 2200);
  };

  const generateAndShare = async (openInstagram = false) => {
    try {
      const navAny = navigator as Navigator & {
        canShare?: (data: { files: File[] }) => boolean;
        share?: (data: {
          files?: File[];
          title?: string;
          text?: string;
          url?: string;
        }) => Promise<void>;
      };

      const user = getUser();
      const blob = await buildShareCardFromTemplate({
        name: user?.name,
        total,
        category: cat.label,
        tier: cat.tier,
      });
      const file = new File([blob], "revital-energy-score.png", { type: "image/png" });

      // Try native share sheet with image (works on iOS Safari and Android Chrome)
      if (navAny.canShare && navAny.canShare({ files: [file] }) && navAny.share) {
        try {
          await navAny.share({
            files: [file],
            title: "Revital Energy Challenge",
            text: `${shareText} ${shareUrl}`,
            url: shareUrl,
          });
          return;
        } catch (e) {
          if (e instanceof Error && e.name === "AbortError") return;
        }
      }

      // Some browsers support native sharing but not file sharing
      if (navAny.share) {
        try {
          await navAny.share({
            title: "Revital Energy Challenge",
            text: `${shareText} ${shareUrl}`,
            url: shareUrl,
          });
          showShareNotice("Shared link. Image sharing is limited on this browser/app.");
          return;
        } catch (e) {
          if (e instanceof Error && e.name === "AbortError") return;
        }
      }

      // Desktop fallback: download image + copy caption
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "revital-energy-score.png";
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      try {
        await navigator.clipboard.writeText(`${shareText} ${shareUrl}`);
      } catch {
        // clipboard write is best-effort — user can still copy manually
      }
      if (openInstagram) {
        showShareNotice(
          "Image downloaded and caption copied — add them to your Instagram story/post.",
        );
        window.open("https://www.instagram.com/", "_blank");
      } else {
        showShareNotice("Image downloaded and caption copied.");
      }
    } catch (e) {
      console.error(e);
      showShareNotice("Could not generate share card. Please try again.");
    }
  };

  const share = () => {
    trackEvent("share_clicked", { method: "generic" });
    generateAndShare(false);
  };
  const shareInstagram = () => {
    trackEvent("share_clicked", { method: "instagram" });
    generateAndShare(true);
  };

  useEffect(() => {
    if (!unlocked) return;
    if (scores.reflex === null || scores.memory === null || scores.balance === null) return;
    const user = getUser();
    if (!user) return;
    const nextTotal = computeTotal(scores);
    const nextCategory = categorize(nextTotal).label;
    void saveUserRemote({
      ...user,
      scores,
      total: nextTotal,
      category: nextCategory,
      consent: true,
    });
  }, [unlocked, scores]);

  useEffect(() => {
    return () => {
      if (noticeTimeout.current) {
        window.clearTimeout(noticeTimeout.current);
      }
    };
  }, []);

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      {!unlocked && <SignupGate onSuccess={() => setUnlocked(true)} />}
      <main
        className={`flex-1 max-w-2xl mx-auto px-4 py-8 text-center ${!unlocked ? "blur-sm pointer-events-none select-none" : ""}`}
      >
        <motion.p
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="inline-block uppercase text-xs md:text-sm tracking-[0.3em] text-garnet font-semibold drop-shadow-sm"
        >
          Your Energy Score
        </motion.p>

        <motion.div
          initial={{ scale: 0.6, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: "spring", damping: 12, delay: 0.2 }}
          className="relative mt-4 mx-auto w-64 h-64 md:w-80 md:h-80"
        >
          <svg className="absolute inset-0 -rotate-90" viewBox="0 0 100 100">
            <circle
              cx="50"
              cy="50"
              r="44"
              fill="none"
              stroke="oklch(0.98 0.01 80 / 0.08)"
              strokeWidth="6"
            />
            <motion.circle
              cx="50"
              cy="50"
              r="44"
              fill="none"
              stroke="url(#g)"
              strokeWidth="6"
              strokeLinecap="round"
              strokeDasharray={`${2 * Math.PI * 44}`}
              initial={{ strokeDashoffset: 2 * Math.PI * 44 }}
              animate={{ strokeDashoffset: 2 * Math.PI * 44 * (1 - pct / 100) }}
              transition={{ duration: 1.6, ease: "easeOut", delay: 0.3 }}
            />
            <defs>
              <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="oklch(0.88 0.17 90)" />
                <stop offset="50%" stopColor="oklch(0.72 0.19 50)" />
                <stop offset="100%" stopColor="oklch(0.55 0.22 30)" />
              </linearGradient>
            </defs>
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <div className="text-6xl md:text-7xl font-black text-[var(--tiger)] drop-shadow-[0_2px_8px_rgba(255,255,255,0.55)] tabular-nums">
              {animatedPct.toFixed(2)}%
            </div>
          </div>
          <div className="absolute -inset-6 rounded-full bg-gradient-glow opacity-50 blur-2xl pointer-events-none" />
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.2 }}
          className="mt-4"
        >
          <div className="inline-flex items-center gap-2 px-5 py-2 rounded-full bg-gradient-energy text-energy-foreground font-bold shadow-button">
            <span className="text-lg">★</span> {cat.label}{" "}
            <span className="opacity-70">· Tier {cat.tier}</span>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.4 }}
          className="mt-8 space-y-3"
        >
          <div className="bg-gradient-card border border-accent/40 rounded-3xl p-5 text-left">
            <div className="flex items-center gap-2">
              <span className="text-2xl">📸</span>
              <h3 className="font-black text-lg text-gradient-energy">Boost Your Chance to Win!</h3>
            </div>
            <p className="text-sm text-muted-foreground mt-2">
              Share your score on Instagram and tag{" "}
              <span className="text-garnet font-semibold">@revital.uae</span> in your story to
              multiply your chances of winning the daily prize 🏆
            </p>
            <button
              onClick={shareInstagram}
              className="mt-4 w-full py-3 rounded-full bg-gradient-energy text-energy-foreground font-bold shadow-button glow-pulse hover:scale-[1.02] active:scale-[0.98] transition-transform"
            >
              Share on Instagram →
            </button>
          </div>
          <div className="flex gap-2">
            <button
              onClick={share}
              className="flex-1 py-3 rounded-full bg-card border border-border font-semibold hover:bg-muted/50 transition-colors"
            >
              Share
            </button>
            <button
              onClick={() => {
                trackEvent("play_again");
                resetScores();
                nav({ to: "/challenges" });
              }}
              className="flex-1 py-3 rounded-full bg-card border border-border font-semibold hover:bg-muted/50 transition-colors"
            >
              Play Again
            </button>
          </div>
          {shareNotice && (
            <div className="mx-auto max-w-md rounded-xl border border-accent/30 bg-card/95 px-4 py-2 text-sm font-medium text-foreground shadow-lg">
              {shareNotice}
            </div>
          )}
          <Link
            to="/profile"
            className="block text-xs text-muted-foreground hover:text-foreground transition-colors pt-2"
          >
            View your profile →
          </Link>
        </motion.div>
      </main>
    </div>
  );
}
