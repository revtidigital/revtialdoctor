type GtagFn = (...args: unknown[]) => void;
type FbqFn = (method: string, event: string, params?: object) => void;
type ClarityFn = (method: string, key: string, value?: string) => void;

declare global {
  interface Window {
    gtag?: GtagFn;
    dataLayer?: unknown[];
    fbq?: FbqFn;
    clarity?: ClarityFn;
  }
}

// Maps our internal event names to Meta Pixel standard events for better
// conversion optimisation in Meta Ads Manager.
const META_STANDARD: Record<string, string> = {
  signup_complete: "Lead",
  score_saved: "Lead",
  score_revealed: "ViewContent",
};

export function trackEvent(name: string, params?: Record<string, unknown>): void {
  if (typeof window === "undefined") return;

  // ── GA4 ───────────────────────────────────────────────────────────────────
  if (typeof window.gtag === "function") {
    window.gtag("event", name, params ?? {});
  } else if (Array.isArray(window.dataLayer)) {
    window.dataLayer.push({ event: name, ...params });
  }

  // ── Meta Pixel ────────────────────────────────────────────────────────────
  if (typeof window.fbq === "function") {
    const standard = META_STANDARD[name];
    if (standard) {
      window.fbq("track", standard, params ?? {});
    } else {
      window.fbq("trackCustom", name, params ?? {});
    }
  }

  // ── Microsoft Clarity ─────────────────────────────────────────────────────
  if (typeof window.clarity === "function") {
    window.clarity("event", name);
    // Tag scalar params so they appear as filterable properties in Clarity.
    if (params) {
      for (const [k, v] of Object.entries(params)) {
        if (typeof v === "string" || typeof v === "number" || typeof v === "boolean") {
          window.clarity("set", k, String(v));
        }
      }
    }
  }
}
