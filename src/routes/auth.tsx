import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { useEffect, useState } from "react";
import { Header } from "@/components/Header";
import {
  categorize,
  computeTotal,
  findUserByContact,
  findUserByContactRemote,
  generateUserId,
  getPersistedUtmParams,
  getCurrentScores,
  saveUser,
  saveUserRemote,
} from "@/lib/storage";
import { trackEvent } from "@/lib/analytics";
import { executeRecaptcha } from "@/lib/recaptcha";

export const Route = createFileRoute("/auth")({
  component: Auth,
});

function Auth() {
  const nav = useNavigate();
  const [contact, setContact] = useState("");
  const [role, setRole] = useState<"doctor" | "pharmacy" | "">("");
  const [referredBy, setReferredBy] = useState("");
  const [consent, setConsent] = useState(false);
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);
  const [existingUser, setExistingUser] =
    useState<Awaited<ReturnType<typeof findUserByContactRemote>>>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const refFromUrl = params.get("ref")?.trim();
    const storedRef = window.localStorage.getItem("revital_referral_code")?.trim();
    const normalizedRef = (refFromUrl || storedRef || "").toUpperCase();
    if (!normalizedRef) return;
    window.localStorage.setItem("revital_referral_code", normalizedRef);
    setReferredBy(normalizedRef);
  }, [nav]);

  useEffect(() => {
    const normalizedContact = normalizeUaePhone(contact);
    const isCandidate = /^\+9715\d{8}$/.test(normalizedContact);
    if (!isCandidate) {
      setExistingUser(null);
      return;
    }
    const timer = window.setTimeout(async () => {
      const user = await findUserByContactRemote(normalizedContact);
      setExistingUser(user);
    }, 250);
    return () => window.clearTimeout(timer);
  }, [contact]);

  const goToProfile = async () => {
    try {
      await nav({ to: "/profile" });
    } catch (e) {
      console.warn("Router navigation failed, falling back to hard redirect", e);
      if (typeof window !== "undefined") window.location.assign("/profile");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr("");
    if (!isValidUaePhone(contact)) {
      setErr("Enter a valid UAE mobile number");
      return;
    }
    if (!existingUser && !role) {
      setErr("Please select whether you are a Doctor or Pharmacy");
      return;
    }
    if (!consent) {
      setErr("Please accept the consent to continue");
      return;
    }
    setLoading(true);
    try {
      const token = await executeRecaptcha("save_score");
      if (token) {
        const { verifyCaptchaFn } = await import("@/server/userFns");
        const result = await verifyCaptchaFn({ data: { token } });
        if (!result.ok) {
          setErr("Security check failed. Please refresh and try again.");
          setLoading(false);
          return;
        }
      }
    } catch {
      // Best-effort — never block the user if reCAPTCHA errors.
    }
    const scores = getCurrentScores();
    const total = computeTotal(scores);
    const cat = categorize(total);
    const normalizedContact = normalizeUaePhone(contact.trim());
    const existing =
      existingUser ??
      (await findUserByContactRemote(normalizedContact)) ??
      findUserByContact(normalizedContact);
    const payload = {
      ...existing,
      ...getPersistedUtmParams(),
      userId: existing?.userId ?? generateUserId(),
      contact: normalizedContact,
      name: existing?.name,
      email: existing?.email,
      address: existing?.address,
      role: role || existing?.role,
      scores,
      total,
      category: cat.label,
      consent: true,
      createdAt: existing?.createdAt ?? new Date().toISOString(),
      referredBy: referredBy.trim().toUpperCase() || existing?.referredBy,
      referCount: existing?.referCount ?? 0,
    };
    try {
      await saveUserRemote(payload);
      trackEvent("score_saved", { source: "auth_page", is_new_user: !existing });
      await goToProfile();
    } catch (e) {
      console.warn("Save encountered an issue", e);
      // Keep local login state as a last resort so the user can still reach their profile.
      saveUser(payload);
      await goToProfile();
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen">
      <Header />
      <main className="max-w-md mx-auto px-4 py-8">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center"
        >
          <h1 className="text-3xl md:text-4xl font-black">
            Save Your <span className="text-gradient-energy">Score</span>
          </h1>
          <p className="text-sm text-muted-foreground mt-2">Enter your number to save your score</p>
        </motion.div>

        <div className="mt-8 bg-gradient-card border border-border rounded-3xl p-6 shadow-card">
          <motion.form
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            onSubmit={handleSubmit}
            className="space-y-4"
          >
            <div>
              <label className="text-xs uppercase tracking-wider text-muted-foreground">
                UAE Mobile Number
              </label>
              <div className="mt-2 flex items-center rounded-2xl border border-border bg-background/60 px-3 focus-within:ring-2 focus-within:ring-ring">
                <span className="text-sm font-semibold text-muted-foreground">+971</span>
                <input
                  autoFocus
                  value={contact}
                  onChange={(e) => setContact(e.target.value)}
                  placeholder="50 123 4567"
                  className="w-full border-0 bg-transparent px-2 py-3 text-foreground placeholder:text-muted-foreground/50 focus:outline-none"
                />
              </div>
              <p className="mt-1.5 text-[11px] text-muted-foreground">
                Enter a UAE mobile number (e.g. +971501234567).
              </p>
            </div>
            {!existingUser && (
              <div>
                <label className="text-xs uppercase tracking-wider text-muted-foreground">
                  I am a
                </label>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setRole("doctor")}
                    className={`py-2.5 rounded-full font-semibold text-sm transition-all ${
                      role === "doctor"
                        ? "bg-gradient-energy text-energy-foreground shadow-button"
                        : "border border-border bg-background/60 text-muted-foreground"
                    }`}
                  >
                    Doctor
                  </button>
                  <button
                    type="button"
                    onClick={() => setRole("pharmacy")}
                    className={`py-2.5 rounded-full font-semibold text-sm transition-all ${
                      role === "pharmacy"
                        ? "bg-gradient-energy text-energy-foreground shadow-button"
                        : "border border-border bg-background/60 text-muted-foreground"
                    }`}
                  >
                    Pharmacy
                  </button>
                </div>
              </div>
            )}
            {!existingUser && (
              <div>
                <label className="text-xs uppercase tracking-wider text-muted-foreground">
                  Referred by{" "}
                  <span className="text-muted-foreground/60 normal-case font-normal">
                    (optional)
                  </span>
                </label>
                <input
                  value={referredBy}
                  onChange={(e) => setReferredBy(e.target.value)}
                  placeholder="RVT-AB12CD34"
                  className="mt-2 w-full bg-background/60 border border-border rounded-2xl px-4 py-3 text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-ring transition-all"
                />
                <p className="mt-1.5 text-[11px] text-muted-foreground">
                  Enter your friend's User ID who referred you — they'll get more chances to win! 🏆
                </p>
              </div>
            )}
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={consent}
                onChange={(e) => setConsent(e.target.checked)}
                className="mt-1 accent-[oklch(0.72_0.19_50)]"
              />
              <span className="text-xs text-muted-foreground">
                I agree to be contacted via phone about Revital campaigns and to the privacy policy
                (UAE compliant).
              </span>
            </label>
            {err && <p className="text-sm text-destructive">{err}</p>}
            <button
              disabled={loading}
              className="w-full py-3 rounded-full bg-gradient-energy text-energy-foreground font-bold shadow-button hover:scale-[1.02] active:scale-[0.98] transition-transform disabled:opacity-60"
            >
              {loading ? "Saving..." : "Save My Score"}
            </button>
          </motion.form>
        </div>

        <Link
          to="/result"
          className="mt-4 block text-center text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          ← Back to result
        </Link>
      </main>
    </div>
  );
}
const normalizeUaePhone = (value: string): string => {
  const raw = value.replace(/[^\d+]/g, "");
  if (raw.startsWith("+971")) return `+971${raw.slice(4).replace(/\D/g, "")}`;
  if (raw.startsWith("00971")) return `+971${raw.slice(5).replace(/\D/g, "")}`;
  if (raw.startsWith("971")) return `+971${raw.slice(3).replace(/\D/g, "")}`;
  if (raw.startsWith("0")) return `+971${raw.slice(1).replace(/\D/g, "")}`;
  if (raw.startsWith("5")) return `+971${raw.replace(/\D/g, "")}`;
  return `+971${raw.replace(/\D/g, "")}`;
};
const isValidUaePhone = (value: string): boolean => {
  const normalized = normalizeUaePhone(value);
  return /^(?:\+971|00971|0)?5\d{8}$/.test(normalized);
};
