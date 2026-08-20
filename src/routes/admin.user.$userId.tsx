import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { useEffect, useMemo, useState } from "react";
import { Shield, ArrowLeft, CircleHelp } from "lucide-react";
import type { UserRecord } from "@/lib/storage";
import { dedupeAttempts } from "@/lib/storage";

export const Route = createFileRoute("/admin/user/$userId")({
  component: AdminUserDetail,
});

function isComplete(scores: UserRecord["scores"]) {
  return scores.reflex !== null && scores.memory !== null && scores.balance !== null;
}

function AdminUserDetail() {
  const { userId } = Route.useParams();
  const navigate = useNavigate();

  const [authenticated, setAuthenticated] = useState(
    () => sessionStorage.getItem("adminAuth") === "true",
  );
  const [passInput, setPassInput] = useState("");
  const [passError, setPassError] = useState(false);
  const [user, setUser] = useState<UserRecord | null>(null);
  const [allUsers, setAllUsers] = useState<UserRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [notFound, setNotFound] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const { verifyAdminPasswordFn } = await import("@/server/adminFns");
      const result = await verifyAdminPasswordFn({ data: { password: passInput } });
      if (result.ok) {
        sessionStorage.setItem("adminAuth", "true");
        sessionStorage.setItem("adminPass", passInput);
        setAuthenticated(true);
        setPassError(false);
      } else {
        setPassError(true);
      }
    } catch {
      setPassError(true);
    }
  };

  useEffect(() => {
    if (!authenticated) return;
    setLoading(true);
    (async () => {
      try {
        const { getUserByIdFn, getAllUsersAdminFn } = await import("@/server/userFns");
        const [found, all] = await Promise.all([
          getUserByIdFn({ data: { userId } }),
          getAllUsersAdminFn({ data: { password: sessionStorage.getItem("adminPass") ?? "" } }),
        ]);
        if (!found) {
          setNotFound(true);
        } else {
          setUser(found);
        }
        setAllUsers(all);
      } catch (e) {
        console.error("Failed to load user", e);
        setNotFound(true);
      } finally {
        setLoading(false);
      }
    })();
  }, [authenticated, userId]);

  const completedAttempts = useMemo(() => {
    if (!user) return [];
    return dedupeAttempts([...(user.playAttempts ?? [])])
      .filter((a) => isComplete(a.scores))
      .sort((a, b) => b.playedAt.localeCompare(a.playedAt));
  }, [user]);

  const dateWiseAttempts = useMemo(() => {
    const groups = new Map<string, NonNullable<UserRecord["playAttempts"]>>();
    for (const attempt of completedAttempts) {
      const bucket = groups.get(attempt.date) ?? [];
      bucket.push(attempt);
      groups.set(attempt.date, bucket);
    }
    return [...groups.entries()]
      .sort(([a], [b]) => b.localeCompare(a))
      .map(([date, attempts]) => ({ date, attempts }));
  }, [completedAttempts]);

  const bestAttempt = useMemo(() => {
    if (completedAttempts.length === 0) return null;
    return completedAttempts.reduce((top, cur) => (cur.total > top.total ? cur : top));
  }, [completedAttempts]);

  const referredUsers = useMemo(() => {
    if (!user) return [];
    return allUsers
      .filter((u) => u.referredBy?.toUpperCase() === user.userId.toUpperCase())
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }, [allUsers, user]);

  const totalPlayDays = (user?.playDates ?? []).length;

  // ── Login Screen ────────────────────────────────────────────────────────────
  if (!authenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-4">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-sm"
        >
          <div className="flex items-center gap-3 justify-center mb-8">
            <Shield className="w-8 h-8 text-accent" />
            <h1 className="text-2xl font-black">
              Admin <span className="text-gradient-energy">Access</span>
            </h1>
          </div>
          <form
            onSubmit={handleLogin}
            className="bg-gradient-card border border-border rounded-3xl p-6 shadow-card space-y-4"
          >
            <label className="block">
              <span className="text-xs uppercase tracking-wider text-muted-foreground">
                Password
              </span>
              <input
                type="password"
                value={passInput}
                onChange={(e) => setPassInput(e.target.value)}
                className="mt-1.5 w-full bg-background/60 border border-border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                autoFocus
              />
            </label>
            {passError && <p className="text-xs text-red-400">Incorrect password.</p>}
            <button className="w-full px-6 py-2.5 rounded-full bg-gradient-energy text-energy-foreground font-bold shadow-button hover:scale-105 active:scale-95 transition-transform text-sm">
              Sign In
            </button>
          </form>
        </motion.div>
      </div>
    );
  }

  // ── Loading ─────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <p className="text-muted-foreground text-sm animate-pulse">Loading user details…</p>
      </div>
    );
  }

  // ── Not Found ───────────────────────────────────────────────────────────────
  if (notFound || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-4">
        <div className="text-center">
          <p className="text-2xl font-black text-gradient-energy">User Not Found</p>
          <p className="text-sm text-muted-foreground mt-2">No user found with ID: {userId}</p>
          <button
            onClick={() => navigate({ to: "/admin" })}
            className="mt-6 px-5 py-2 rounded-full border border-border text-sm hover:bg-muted/20"
          >
            Back to Admin
          </button>
        </div>
      </div>
    );
  }

  // ── User Detail ─────────────────────────────────────────────────────────────
  return (
    <div className="bg-background px-4 py-6 md:px-6 md:py-5">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <button
            onClick={() => navigate({ to: "/admin" })}
            className="p-2 rounded-full border border-border hover:bg-muted/20 transition-colors"
            title="Back to admin"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-black">User Details</h1>
              {user.role && (
                <span className="px-3 py-1 rounded-full bg-gradient-energy text-energy-foreground text-[10px] font-bold uppercase tracking-wider">
                  {user.role}
                </span>
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              {user.name || "Unnamed"} · {user.contact}
            </p>
            <p className="text-xs text-muted-foreground font-mono">{user.userId}</p>
          </div>
        </div>

        {/* KPI cards */}
        <div className="grid sm:grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          <KpiCard title="Best Score" value={bestAttempt?.total ?? 0} />
          <KpiCard title="Completed Attempts" value={completedAttempts.length} />
          <KpiCard title="Users Referred" value={referredUsers.length} />
          <KpiCard
            title="Total Play Days"
            value={totalPlayDays}
            info="Number of unique days this user has played any challenge."
          />
        </div>

        {/* User info */}
        <div className="bg-gradient-card border border-border rounded-2xl p-4 mb-4">
          <h2 className="font-bold text-sm mb-3">Profile</h2>
          <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-2 text-sm">
            <InfoRow label="User ID" value={user.userId} mono />
            <InfoRow label="Contact" value={user.contact} mono />
            {user.email && <InfoRow label="Email" value={user.email} mono />}
            {user.name && <InfoRow label="Name" value={user.name} />}
            <InfoRow label="Address" value={user.address || "—"} />
            <InfoRow label="Joined" value={new Date(user.createdAt).toLocaleString()} />
            <InfoRow label="Category" value={user.category} />
            <InfoRow label="Total (Best)" value={String(user.total)} />
            {user.referredBy && <InfoRow label="Referred By" value={user.referredBy} mono />}
          </div>
        </div>

        <div className="bg-gradient-card border border-border rounded-2xl p-4 mb-4">
          <h2 className="font-bold text-sm mb-3">UTM Details</h2>
          <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-2 text-sm">
            <InfoRow label="UTM Source" value={user.utmSource || "—"} />
            <InfoRow label="UTM Medium" value={user.utmMedium || "—"} />
            <InfoRow label="UTM Campaign" value={user.utmCampaign || "—"} />
            <InfoRow label="UTM Term" value={user.utmTerm || "—"} />
            <InfoRow label="UTM Content" value={user.utmContent || "—"} />
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-4">
          {/* Referred Users */}
          <div className="bg-gradient-card border border-border rounded-2xl p-4">
            <h2 className="font-bold text-sm mb-3">Referred Users</h2>
            {referredUsers.length === 0 ? (
              <p className="text-xs text-muted-foreground">No referrals yet.</p>
            ) : (
              <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
                {referredUsers.map((u) => (
                  <div key={u.userId} className="rounded-xl border border-border/70 p-2.5">
                    <div className="text-sm font-semibold">{u.name || "—"}</div>
                    <div className="text-[11px] text-muted-foreground font-mono">{u.contact}</div>
                    <div className="text-[11px] text-muted-foreground">
                      Joined: {new Date(u.createdAt).toLocaleString()}
                    </div>
                    <div className="text-[11px] font-semibold text-gradient-energy">
                      Best: {u.total}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="bg-gradient-card border border-border rounded-2xl p-4">
            <h2 className="font-bold text-sm mb-3">Date-wise Scores</h2>
            <p className="text-[11px] text-muted-foreground mb-3">
              Completed runs grouped by day so you can track daily attempts and scores.
            </p>
            {dateWiseAttempts.length === 0 ? (
              <p className="text-xs text-muted-foreground">No dated attempts available yet.</p>
            ) : (
              <div className="space-y-3 max-h-80 overflow-y-auto pr-1">
                {dateWiseAttempts.map((d) => (
                  <div key={d.date} className="rounded-xl border border-border/70 overflow-hidden">
                    <div className="px-3 py-2 bg-muted/10 flex items-center justify-between">
                      <div className="font-semibold text-sm">{d.date}</div>
                      <div className="text-[11px] text-muted-foreground">
                        {d.attempts.length} run{d.attempts.length === 1 ? "" : "s"}
                      </div>
                    </div>
                    <div className="divide-y divide-border/60">
                      {d.attempts.map((a, idx) => (
                        <div
                          key={`${d.date}-${a.playedAt}-${idx}`}
                          className="px-3 py-2 text-[11px] flex items-center justify-between gap-2"
                        >
                          <div className="text-muted-foreground">
                            {new Date(a.playedAt).toLocaleTimeString()}
                          </div>
                          <div className="font-medium">
                            R:{a.scores.reflex ?? 0} · M:{a.scores.memory ?? 0} · B:
                            {a.scores.balance ?? 0}
                          </div>
                          <div className="font-bold text-gradient-energy">{a.total}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function KpiCard({ title, value, info }: { title: string; value: string | number; info?: string }) {
  return (
    <div className="bg-gradient-card border border-border rounded-2xl p-4 shadow-card">
      <div className="flex items-center justify-between gap-2">
        <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{title}</div>
        {info ? (
          <span className="relative group/info inline-flex items-center">
            <span
              className="text-muted-foreground/80 hover:text-accent transition-colors cursor-help inline-flex"
              aria-label={info}
            >
              <CircleHelp className="w-3.5 h-3.5" />
            </span>
            <span className="pointer-events-none absolute right-0 top-5 z-[80] hidden w-56 max-w-[calc(100vw-2rem)] rounded-xl border border-border bg-background/95 p-2 text-[10px] normal-case font-medium leading-relaxed tracking-normal text-foreground shadow-lg backdrop-blur-sm group-hover/info:block">
              {info}
            </span>
          </span>
        ) : null}
      </div>
      <div className="text-2xl md:text-3xl font-black text-gradient-energy mt-1">{value}</div>
    </div>
  );
}

function InfoRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <span className="text-[10px] uppercase tracking-wider text-muted-foreground block">
        {label}
      </span>
      <span className={`text-sm ${mono ? "font-mono" : ""}`}>{value}</span>
    </div>
  );
}
