import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
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

interface SignupGateProps {
  onSuccess: () => void;
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

export function SignupGate({ onSuccess }: SignupGateProps) {
  const [name, setName] = useState("");
  const [contact, setContact] = useState("");
  const [role, setRole] = useState<"doctor" | "pharmacy" | "">("");
  const [referredBy, setReferredBy] = useState("");
  const [consent, setConsent] = useState(false);
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);
  const existingUser = useMemo(
    () => (contact.trim() ? findUserByContact(contact.trim()) : null),
    [contact],
  );
  const [existingRemoteUser, setExistingRemoteUser] =
    useState<Awaited<ReturnType<typeof findUserByContactRemote>>>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const refFromUrl = new URLSearchParams(window.location.search).get("ref")?.trim();
    const persistedRef = window.localStorage.getItem("revital_referral_code")?.trim();
    const referralCode = (refFromUrl || persistedRef || "").toUpperCase();
    if (referralCode) {
      setReferredBy(referralCode);
      window.localStorage.setItem("revital_referral_code", referralCode);
    }
  }, []);

  useEffect(() => {
    const normalizedContact = normalizeUaePhone(contact);
    const isCandidate = /^\+9715\d{8}$/.test(normalizedContact);
    if (!isCandidate) {
      setExistingRemoteUser(null);
      return;
    }
    const timer = window.setTimeout(async () => {
      const user = await findUserByContactRemote(normalizedContact);
      setExistingRemoteUser(user);
    }, 250);
    return () => window.clearTimeout(timer);
  }, [contact]);

  const completeSignup = async (contactValue: string, displayName: string, referrer?: string) => {
    const scores = getCurrentScores();
    const total = computeTotal(scores);
    const cat = categorize(total);
    const existing = findUserByContact(contactValue.trim());
    const normalizedReferrer = existing?.referredBy || referrer?.trim().toUpperCase();
    try {
      const payload = {
        ...getPersistedUtmParams(),
        userId: existing?.userId ?? generateUserId(),
        contact: contactValue.trim(),
        name: displayName.trim() || existing?.name,
        address: existing?.address,
        role: role || existing?.role,
        scores,
        total,
        category: cat.label,
        consent: true,
        createdAt: existing?.createdAt ?? new Date().toISOString(),
        referredBy: normalizedReferrer,
        referCount: existing?.referCount ?? 0,
      };
      // Persist local auth state immediately so Header updates to the account icon right away.
      saveUser(payload);
      await saveUserRemote(payload);
      trackEvent("signup_complete", {
        is_new_user: !existing,
        total: payload.total,
        category: payload.category,
      });
      onSuccess();
    } catch {
      setErr("Failed to save your score. Please try again.");
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr("");
    if (!name.trim()) return setErr("Please enter your name");
    if (!isValidUaePhone(contact)) return setErr("Enter a valid UAE mobile number");
    if (!role) return setErr("Please select whether you are a Doctor or Pharmacy");
    if (!consent) return setErr("Please accept the consent to continue");
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
    trackEvent("signup_started", { source: "result_gate" });
    await completeSignup(normalizeUaePhone(contact), name, referredBy || undefined);
  };

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
      className="fixed inset-0 z-[100] flex items-center justify-center bg-background/90 backdrop-blur-md px-4 overflow-y-auto py-8 overscroll-contain"
    >
      <motion.div
        initial={{ scale: 0.92, y: 20, opacity: 0 }}
        animate={{ scale: 1, y: 0, opacity: 1 }}
        className="w-full max-w-md bg-gradient-card border border-border rounded-3xl p-6 shadow-card"
      >
        <div className="text-center">
          <div className="text-4xl mb-2">🔒</div>
          <h2 className="text-2xl md:text-3xl font-black text-gradient-energy">
            Unlock Your Score
          </h2>
          <p className="text-sm text-muted-foreground mt-2">
            Enter your details to reveal your Energy Score and qualify for the global prize.
          </p>
        </div>

        <motion.form
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          onSubmit={handleSubmit}
          className="mt-5 space-y-3"
        >
          <div>
            <label className="text-xs uppercase tracking-wider text-muted-foreground">
              Full Name
            </label>
            <input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your name"
              className="mt-1.5 w-full bg-background/60 border border-border rounded-2xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
          <div>
            <label className="text-xs uppercase tracking-wider text-muted-foreground">
              UAE Mobile Number
            </label>
            <div className="mt-1.5 flex items-center rounded-2xl border border-border bg-background/60 px-3 focus-within:ring-2 focus-within:ring-ring">
              <span className="text-sm font-semibold text-muted-foreground">+971</span>
              <input
                value={contact}
                onChange={(e) => setContact(e.target.value)}
                placeholder="50 123 4567"
                className="w-full border-0 bg-transparent px-2 py-3 focus:outline-none"
              />
            </div>
            <p className="mt-1 text-[11px] text-muted-foreground">
              Enter a UAE mobile number (e.g. +971501234567). We'll send a one-time code.
            </p>
            {(existingUser || existingRemoteUser) && (
              <p className="mt-1 text-[11px] text-accent">
                Existing account detected. Referral code is locked for returning users.
              </p>
            )}
          </div>
          <div>
            <label className="text-xs uppercase tracking-wider text-muted-foreground">I am a</label>
            <div className="mt-1.5 grid grid-cols-2 gap-2">
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
          {!existingUser && !existingRemoteUser && (
            <div>
              <label className="text-xs uppercase tracking-wider text-muted-foreground">
                Referred by{" "}
                <span className="text-muted-foreground/60 normal-case font-normal">(optional)</span>
              </label>
              <input
                value={referredBy}
                onChange={(e) => setReferredBy(e.target.value)}
                placeholder="RVT-AB12CD34"
                className="mt-1.5 w-full bg-background/60 border border-border rounded-2xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-ring"
              />
              <p className="mt-1 text-[11px] text-muted-foreground">
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
              I agree to be contacted by Revital about campaigns & rewards by phone, and accept the
              privacy policy (UAE compliant).
            </span>
          </label>
          {err && <p className="text-sm text-destructive">{err}</p>}
          <button
            disabled={loading}
            className="w-full py-3 rounded-full bg-gradient-energy text-energy-foreground font-bold shadow-button hover:scale-[1.02] active:scale-[0.98] transition-transform disabled:opacity-60"
          >
            {loading ? "Saving..." : "Save & Reveal Score →"}
          </button>
        </motion.form>
      </motion.div>
    </motion.div>
  );
}
