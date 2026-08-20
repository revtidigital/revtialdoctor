import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import logo from "@/assets/revital-logo.png";
import { getUser, logout, type UserRecord } from "@/lib/storage";

export function Header() {
  const nav = useNavigate();
  const routerState = useRouterState();
  const [user, setUser] = useState<UserRecord | null>(null);
  const isHomePage = routerState.location.pathname === "/";

  // Refresh user state on every route change
  useEffect(() => {
    setUser(getUser());
  }, [routerState.location.pathname]);

  useEffect(() => {
    const syncAuth = () => setUser(getUser());
    window.addEventListener("revital-auth-changed", syncAuth);
    return () => window.removeEventListener("revital-auth-changed", syncAuth);
  }, []);

  return (
    <header className="sticky top-0 z-40 backdrop-blur-xl bg-white/80 border-b border-[var(--garnet)]/10">
      <div className="max-w-6xl mx-auto w-full px-3 sm:px-4 py-2 grid grid-cols-[auto_1fr_auto] items-center gap-2 sm:gap-3">
        <Link to="/" className="flex items-center group shrink-0">
          <img
            src={logo}
            alt="Revital Ginseng Plus"
            className="h-8 sm:h-9 md:h-12 w-auto object-contain transition-transform group-hover:scale-105"
          />
        </Link>
        <nav className="hidden md:flex min-w-0 items-center justify-center gap-1 text-xs sm:text-sm">
          {isHomePage && (
            <>
              <a
                href="#hero-section"
                className="inline-flex px-2.5 sm:px-3 py-2 rounded-full text-garnet/80 hover:text-garnet hover:bg-[var(--marigold)]/30 transition-colors font-medium whitespace-nowrap"
              >
                Home
              </a>
              <a
                href="#how-to-participate"
                className="inline-flex px-2.5 sm:px-3 py-2 rounded-full text-garnet/80 hover:text-garnet hover:bg-[var(--marigold)]/30 transition-colors font-medium whitespace-nowrap"
              >
                🎮 How to Participate
              </a>
              <a
                href="#leaderboard-section"
                className="inline-flex px-2.5 sm:px-3 py-2 rounded-full text-garnet/80 hover:text-garnet hover:bg-[var(--marigold)]/30 transition-colors font-medium whitespace-nowrap"
              >
                Leaderboard
              </a>
            </>
          )}
        </nav>

        <div className="flex items-center justify-end gap-1 text-xs sm:text-sm">
          {!user && (
            <Link
              to="/auth"
              className="px-2.5 sm:px-3 py-2 rounded-full text-garnet/80 hover:text-garnet hover:bg-[var(--marigold)]/30 transition-colors font-medium whitespace-nowrap"
            >
              My Score
            </Link>
          )}
          {user ? (
            <div className="relative group/account">
              <button
                onClick={() => nav({ to: "/profile" })}
                aria-label="Go to profile"
                className="w-10 h-10 rounded-full bg-gradient-energy text-white shadow-button hover:scale-105 active:scale-95 transition-transform flex items-center justify-center"
              >
                <span className="text-lg leading-none">👤</span>
              </button>

              <div className="absolute right-0 top-12 z-50 hidden min-w-[190px] rounded-2xl border border-border bg-background/95 p-3 shadow-card backdrop-blur-sm group-hover/account:block group-focus-within/account:block">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  User ID
                </p>
                <p className="mt-1 text-xs font-black text-foreground break-all">{user.userId}</p>
                <button
                  type="button"
                  onClick={() => {
                    logout();
                    nav({ to: "/auth" });
                  }}
                  className="mt-3 w-full rounded-full border border-border px-3 py-1.5 text-xs font-bold text-foreground hover:bg-muted/20 transition-colors"
                >
                  Logout
                </button>
              </div>
            </div>
          ) : (
            <Link
              to="/auth"
              className="px-4 py-2 rounded-full bg-gradient-energy text-white font-semibold shadow-button hover:scale-105 active:scale-95 transition-transform"
            >
              Login
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
