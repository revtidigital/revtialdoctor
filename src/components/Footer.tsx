import { Link, useRouterState } from "@tanstack/react-router";

export function Footer() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  if (pathname.toLowerCase().startsWith("/admin")) return null;

  return (
    <footer className="mt-16 border-t border-[var(--garnet)]/10 bg-white/60">
      <div className="mx-auto flex w-full max-w-6xl flex-col items-center justify-between gap-2 px-3 py-2 text-xs sm:px-4 sm:py-3 sm:text-sm md:flex-row md:gap-4 md:py-8">
        <p className="text-center font-medium text-garnet/70 md:text-left">
          © {new Date().getFullYear()} Revital Energy Challenge. All rights reserved.
        </p>
        <nav className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1">
          <Link
            to="/rules"
            className="font-semibold text-garnet/80 transition-colors hover:text-[var(--tiger)]"
          >
            Rules
          </Link>
          <span className="text-garnet/30">•</span>
          <Link
            to="/privacy"
            className="font-semibold text-garnet/80 transition-colors hover:text-[var(--tiger)]"
          >
            Privacy Policy
          </Link>
          <span className="text-garnet/30">•</span>
          <Link
            to="/terms"
            className="font-semibold text-garnet/80 transition-colors hover:text-[var(--tiger)]"
          >
            Terms & Conditions
          </Link>
        </nav>
      </div>
    </footer>
  );
}
