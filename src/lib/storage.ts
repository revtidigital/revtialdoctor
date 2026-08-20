// Persistence layer — session state lives in localStorage; user records are stored in MongoDB via server functions.
export type GameKey = "reflex" | "memory" | "balance";

export interface GameScores {
  reflex: number | null;
  memory: number | null;
  balance: number | null;
}

export interface PlayAttempt {
  playedAt: string; // ISO timestamp
  date: string; // YYYY-MM-DD
  scores: GameScores;
  total: number;
  category: string;
}

const makeAttemptKey = (attempt: PlayAttempt): string =>
  [
    attempt.playedAt,
    attempt.date,
    attempt.scores.reflex ?? "",
    attempt.scores.memory ?? "",
    attempt.scores.balance ?? "",
    attempt.total,
    attempt.category,
  ].join("|");

export const dedupeAttempts = (attempts: PlayAttempt[]): PlayAttempt[] => {
  const seen = new Set<string>();
  const deduped: PlayAttempt[] = [];
  for (const attempt of attempts) {
    const key = makeAttemptKey(attempt);
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(attempt);
  }
  return deduped;
};

export const getBestAttemptForDate = (attempts: PlayAttempt[], date: string): PlayAttempt | null =>
  attempts
    .filter((attempt) => attempt.date === date)
    .reduce<PlayAttempt | null>((best, current) => {
      if (!best) return current;
      return current.total > best.total ? current : best;
    }, null);

export interface UserRecord {
  userId: string; // generated unique id
  contact: string; // mobile number used for login
  email?: string; // optional profile email
  name?: string;
  address?: string;
  role?: "doctor" | "pharmacy";
  scores: GameScores;
  total: number;
  category: string;
  consent: boolean;
  createdAt: string;
  playDates?: string[]; // YYYY-MM-DD dates the user played (for streak tracking)
  playAttempts?: PlayAttempt[]; // all completed 3-challenge runs
  referredBy?: string; // userId of the user who referred this person
  referCount?: number; // number of people this user has referred
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  utmTerm?: string;
  utmContent?: string;
  winnerLockDates?: string[]; // YYYY-MM-DD dates where this user finished in the locked top 10
}

export interface UTMParams {
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  utmTerm?: string;
  utmContent?: string;
}

const UTM_STORAGE_KEY = "revital_utm_params";

export const getPersistedUtmParams = (): UTMParams => {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(UTM_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as UTMParams;
    return {
      utmSource: parsed.utmSource?.trim(),
      utmMedium: parsed.utmMedium?.trim(),
      utmCampaign: parsed.utmCampaign?.trim(),
      utmTerm: parsed.utmTerm?.trim(),
      utmContent: parsed.utmContent?.trim(),
    };
  } catch {
    return {};
  }
};

export const generateUserId = (): string => {
  const randomPart = (() => {
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
      return crypto.randomUUID().replace(/-/g, "");
    }
    if (typeof crypto !== "undefined" && typeof crypto.getRandomValues === "function") {
      const bytes = new Uint8Array(16);
      crypto.getRandomValues(bytes);
      return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
    }
    return `${Math.random().toString(16).slice(2)}${Date.now().toString(16)}`;
  })();
  const rand = randomPart.slice(0, 6).toUpperCase();
  const ts = Date.now().toString(36).slice(-4).toUpperCase();
  return `RVT-${ts}${rand}`;
};

export const logout = () => {
  if (typeof window === "undefined") return;
  localStorage.removeItem(USER_KEY);
  localStorage.removeItem(SCORES_KEY);
  window.dispatchEvent(new Event("revital-auth-changed"));
};

const SCORES_KEY = "revital.currentScores";
const USER_KEY = "revital.user";
const ALL_USERS_KEY = "revital.allUsers";
const CONSENT_KEY = "revital.cookieConsent";
const RUN_COMPLETED_AT_KEY = "revital.runCompletedAt";

export const getCurrentScores = (): GameScores => {
  if (typeof window === "undefined") return { reflex: null, memory: null, balance: null };
  try {
    return JSON.parse(localStorage.getItem(SCORES_KEY) || "") as GameScores;
  } catch {
    return { reflex: null, memory: null, balance: null };
  }
};

export const saveGameScore = (game: GameKey, score: number) => {
  const cur = getCurrentScores();
  cur[game] = score;
  localStorage.setItem(SCORES_KEY, JSON.stringify(cur));
  if (game === "balance") {
    localStorage.setItem(RUN_COMPLETED_AT_KEY, new Date().toISOString());
    const user = getUser();
    if (user?.consent) {
      const total = computeTotal(cur);
      const nextCategory = categorize(total).label;
      void saveUserRemote({
        ...user,
        scores: cur,
        total,
        category: nextCategory,
      }).catch((error) => {
        console.warn("Auto-save after completing balance failed", error);
      });
    }
  }
};

const toLocalDateString = (d: Date): string => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

const toLocalDateTimeString = (d: Date): string => {
  const date = toLocalDateString(d);
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  const ss = String(d.getSeconds()).padStart(2, "0");
  return `${date}T${hh}:${mm}:${ss}`;
};

/** Returns today's local date as YYYY-MM-DD. */
export const todayDateString = (): string => toLocalDateString(new Date());

const MS_PER_DAY = 86_400_000; // milliseconds in one day

/** Calculate current consecutive-day streak from a sorted array of YYYY-MM-DD strings. */
export const calcStreak = (playDates: string[]): number => {
  if (!playDates || playDates.length === 0) return 0;
  const sorted = [...new Set(playDates)].sort().reverse(); // most recent first
  const today = todayDateString();
  const yesterday = toLocalDateString(new Date(Date.now() - MS_PER_DAY));
  // streak must include today or yesterday to be "active"
  if (sorted[0] !== today && sorted[0] !== yesterday) return 0;
  let streak = 1;
  for (let i = 1; i < sorted.length; i++) {
    const prev = new Date(sorted[i - 1]);
    const curr = new Date(sorted[i]);
    const diff = (prev.getTime() - curr.getTime()) / MS_PER_DAY;
    if (Math.round(diff) === 1) streak++;
    else break;
  }
  return streak;
};

export const resetScores = () => {
  localStorage.removeItem(SCORES_KEY);
  localStorage.removeItem(RUN_COMPLETED_AT_KEY);
};

export const computeTotal = (s: GameScores) =>
  Math.round(((s.reflex ?? 0) + (s.memory ?? 0) + (s.balance ?? 0)) / 3);

export const totalToPercentage = (total: number): number =>
  Math.max(0, Math.min(100, (total / 1500) * 100));

export const categorize = (total: number) => {
  const pct = totalToPercentage(total);
  if (pct >= 80) return { label: "Peak Performer", tier: "S" };
  if (pct >= 60) return { label: "High Energy", tier: "A" };
  if (pct >= 40) return { label: "Charged Up", tier: "B" };
  if (pct >= 20) return { label: "Warming Up", tier: "C" };
  return { label: "Recharge Needed", tier: "D" };
};

export const saveUser = (u: UserRecord) => {
  const all = getAllUsers();
  const idx = all.findIndex((x) => x.contact === u.contact);
  const existing = idx >= 0 ? all[idx] : null;
  const referralUserId = (u.referredBy || "").trim().toUpperCase();
  const firstTimeReferral = !!referralUserId && !existing?.referredBy;

  if (idx >= 0) all[idx] = u;
  else all.push(u);

  if (firstTimeReferral) {
    const referredIdx = all.findIndex(
      (candidate) => candidate.userId.toUpperCase() === referralUserId,
    );
    const selfContact = u.contact.toLowerCase();
    if (referredIdx >= 0 && all[referredIdx].contact.toLowerCase() !== selfContact) {
      all[referredIdx] = {
        ...all[referredIdx],
        referCount: (all[referredIdx].referCount ?? 0) + 1,
      };
    }
  }

  localStorage.setItem(USER_KEY, JSON.stringify(u));
  localStorage.setItem(ALL_USERS_KEY, JSON.stringify(all));
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event("revital-auth-changed"));
  }
};

/** Persist user to MongoDB (server) AND update localStorage cache. */
export const saveUserRemote = async (u: UserRecord): Promise<void> => {
  const existingLocal = findUserByContact(u.contact);
  const priorDates = [...new Set([...(existingLocal?.playDates ?? []), ...(u.playDates ?? [])])];

  const completeRun =
    u.scores.reflex !== null && u.scores.memory !== null && u.scores.balance !== null;

  const priorAttempts = dedupeAttempts([
    ...(existingLocal?.playAttempts ?? []),
    ...(u.playAttempts ?? []),
  ]);
  const completedAtFromStorage =
    typeof window !== "undefined" ? localStorage.getItem(RUN_COMPLETED_AT_KEY) : null;
  const shouldAppendAttempt = completeRun && !!completedAtFromStorage;
  const completedAt = completedAtFromStorage || toLocalDateTimeString(new Date());
  const completedDate = completedAt.slice(0, 10);
  const mergedDates = shouldAppendAttempt
    ? priorDates.includes(completedDate)
      ? priorDates
      : [...priorDates, completedDate]
    : priorDates;
  const nextAttempts = shouldAppendAttempt
    ? [
        ...priorAttempts,
        {
          playedAt: completedAt,
          date: completedDate,
          scores: u.scores,
          total: u.total,
          category: u.category,
        },
      ]
    : priorAttempts;
  const dedupedAttempts = dedupeAttempts(nextAttempts);

  const targetDate = shouldAppendAttempt ? completedDate : todayDateString();
  const bestAttemptForDate = getBestAttemptForDate(dedupedAttempts, targetDate);

  const withDate: UserRecord = {
    ...u,
    playDates: mergedDates,
    playAttempts: dedupedAttempts,
    // winner selection should use the best completed run for the selected day,
    // while still preserving every attempt in playAttempts.
    scores: bestAttemptForDate?.scores ?? u.scores,
    total: bestAttemptForDate?.total ?? u.total,
    category: bestAttemptForDate?.category ?? u.category,
  };

  // Keep a local copy when possible so saving a score is not blocked by transient server/db issues.
  try {
    saveUser(withDate);
  } catch (e) {
    console.warn("Local save failed; continuing with remote save attempt", e);
  }

  let remoteError: unknown = null;
  try {
    const { saveUserFn } = await import("@/server/userFns");
    await saveUserFn({ data: withDate });
  } catch (e) {
    remoteError = e;
    console.warn("Remote save failed; user was saved locally", e);
  } finally {
    if (typeof window !== "undefined") {
      localStorage.removeItem(RUN_COMPLETED_AT_KEY);
    }
  }

  if (remoteError) {
    throw remoteError;
  }
};

/** Look up a user by contact in MongoDB (server), with localStorage as fallback. */
export const findUserByContactRemote = async (contact: string): Promise<UserRecord | null> => {
  try {
    const { getUserByContactFn } = await import("@/server/userFns");
    const remote = await getUserByContactFn({ data: { contact } });
    if (remote) {
      // sync to local cache
      saveUser(remote);
      return remote;
    }
  } catch (e) {
    console.warn("MongoDB lookup failed, falling back to localStorage", e);
  }
  return findUserByContact(contact);
};

/** Fetch all users from MongoDB (server), with localStorage as fallback. */
export const getAllUsersRemote = async (): Promise<UserRecord[]> => {
  try {
    const { getAllUsersFn } = await import("@/server/userFns");
    return await getAllUsersFn();
  } catch (e) {
    console.warn("MongoDB getAllUsers failed, falling back to localStorage", e);
    return getAllUsers();
  }
};

export const getUser = (): UserRecord | null => {
  try {
    const u = JSON.parse(localStorage.getItem(USER_KEY) || "") as UserRecord;
    if (!u) return null;
    // Backfill userId for older records
    if (!u.userId) {
      u.userId = generateUserId();
      localStorage.setItem(USER_KEY, JSON.stringify(u));
      const all = getAllUsers();
      const idx = all.findIndex((x) => x.contact === u.contact);
      if (idx >= 0) {
        all[idx] = u;
        localStorage.setItem(ALL_USERS_KEY, JSON.stringify(all));
      }
    }
    return u;
  } catch {
    return null;
  }
};

export const getAllUsers = (): UserRecord[] => {
  try {
    return JSON.parse(localStorage.getItem(ALL_USERS_KEY) || "[]");
  } catch {
    return [];
  }
};

export const findUserByContact = (contact: string) =>
  getAllUsers().find((u) => u.contact.toLowerCase() === contact.toLowerCase()) || null;

export const hasConsent = () => localStorage.getItem(CONSENT_KEY) === "true";
export const setConsent = (v: boolean) => localStorage.setItem(CONSENT_KEY, v ? "true" : "false");

export const isLoggedIn = () => !!getUser();

// Sequential challenge progression: reflex → memory → balance
export const CHALLENGE_ORDER: GameKey[] = ["reflex", "memory", "balance"];

export const isGameUnlocked = (game: GameKey): boolean => {
  const s = getCurrentScores();
  const idx = CHALLENGE_ORDER.indexOf(game);
  if (idx <= 0) return true;
  // unlocked only if every prior challenge has a score
  return CHALLENGE_ORDER.slice(0, idx).every((k) => s[k] !== null);
};

export const getNextGame = (): GameKey | null => {
  const s = getCurrentScores();
  return CHALLENGE_ORDER.find((k) => s[k] === null) ?? null;
};

export const getCompletedCount = (): number => {
  const s = getCurrentScores();
  return CHALLENGE_ORDER.filter((k) => s[k] !== null).length;
};
