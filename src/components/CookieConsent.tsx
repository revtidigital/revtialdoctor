import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { hasConsent, setConsent } from "@/lib/storage";
import { useRouterState } from "@tanstack/react-router";

export function CookieConsent() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [show, setShow] = useState(false);
  useEffect(() => {
    if (!hasConsent()) setShow(true);
  }, []);
  if (pathname.toLowerCase().startsWith("/admin")) return null;

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ y: 100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 100, opacity: 0 }}
          transition={{ type: "spring", damping: 22 }}
          className="fixed bottom-4 inset-x-4 md:inset-x-auto md:right-6 md:max-w-md z-50"
        >
          <div className="bg-card/95 backdrop-blur-xl border border-border rounded-2xl p-5 shadow-card">
            <p className="text-sm text-foreground/90">
              We use cookies for analytics & to enhance your experience. By continuing you agree to
              our privacy policy (UAE compliant).
            </p>
            <div className="flex gap-2 mt-4">
              <button
                onClick={() => {
                  setConsent(true);
                  setShow(false);
                }}
                className="flex-1 py-2 rounded-full bg-gradient-energy text-energy-foreground font-semibold text-sm shadow-button active:scale-95 transition-transform"
              >
                Accept
              </button>
              <button
                onClick={() => {
                  setConsent(false);
                  setShow(false);
                }}
                className="px-4 py-2 rounded-full bg-muted text-muted-foreground font-medium text-sm hover:text-foreground transition-colors"
              >
                Decline
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
