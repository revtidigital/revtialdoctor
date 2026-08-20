import {
  Outlet,
  Link,
  createRootRoute,
  HeadContent,
  Scripts,
  useRouterState,
} from "@tanstack/react-router";
import { useEffect } from "react";
import appCss from "../styles.css?url";
import revitalLogo from "@/assets/revital-logo.png?url";

const socialShareOgImage =
  "https://revital.revtilabs.com/assets/revital-hero-wordmark-DN1KXeZP.png";
import { CookieConsent } from "@/components/CookieConsent";
import { Footer } from "@/components/Footer";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="max-w-md text-center">
        <h1 className="text-8xl font-black text-gradient-energy">404</h1>
        <h2 className="mt-4 text-xl font-semibold">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist.
        </p>
        <Link
          to="/"
          className="mt-6 inline-flex items-center justify-center rounded-full bg-gradient-energy px-6 py-3 text-sm font-semibold text-energy-foreground shadow-button hover:scale-105 transition-transform"
        >
          Go home
        </Link>
      </div>
    </div>
  );
}

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1, viewport-fit=cover" },
      { name: "theme-color", content: "#F37421" },
      { title: "Revital Energy Challenge — Are You Ready?" },
      {
        name: "description",
        content:
          "Take the Revital Energy Challenge. Play 3 fast games, score your energy, and climb the daily leaderboard.",
      },
      { property: "og:title", content: "Revital Energy Challenge — Are You Ready?" },
      {
        property: "og:description",
        content:
          "Take the Revital Energy Challenge. Play 3 fast games, score your energy, and climb the daily leaderboard.",
      },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "https://revital-energy-challenge.com" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "Revital Energy Challenge — Are You Ready?" },
      {
        name: "twitter:description",
        content:
          "Take the Revital Energy Challenge. Play 3 fast games, score your energy, and climb the daily leaderboard.",
      },
      { property: "og:image", content: socialShareOgImage },
      { property: "og:image:alt", content: "Revital Energy Challenge logo" },
      { name: "twitter:image", content: socialShareOgImage },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "icon", href: revitalLogo, type: "image/png" },
      { rel: "apple-touch-icon", href: revitalLogo },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      { rel: "preconnect", href: "https://accounts.google.com" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Mulish:wght@400;500;600;700;800;900&family=Pacifico&display=swap",
      },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
});

function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const isAdminRoute = pathname.toLowerCase().startsWith("/admin");

  useEffect(() => {
    if (typeof window === "undefined") return;
    const w = window as typeof window & {
      fbq?: (...args: unknown[]) => void;
      gtag?: (...args: unknown[]) => void;
      dataLayer?: unknown[];
    };
    const fbq = w.fbq;
    if (typeof fbq === "function") {
      fbq("track", "PageView");
    }

    // Keep GA4 page views in sync for SPA navigations.
    if (typeof w.gtag === "function") {
      w.gtag("event", "page_view", {
        page_path: window.location.pathname + window.location.search,
        page_title: document.title,
      });
    } else if (Array.isArray(w.dataLayer)) {
      w.dataLayer.push({
        event: "page_view",
        page_path: window.location.pathname + window.location.search,
        page_title: document.title,
      });
    }
  }, [pathname]);

  useEffect(() => {
    // Persist referral code from URL so it can be auto-filled later in the signup popup
    // even after route changes during gameplay.
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const referralCode = params.get("ref")?.trim();
      if (referralCode) {
        window.localStorage.setItem("revital_referral_code", referralCode.toUpperCase());
      }

      const utmPayload = {
        utmSource: params.get("utm_source")?.trim() || "",
        utmMedium: params.get("utm_medium")?.trim() || "",
        utmCampaign: params.get("utm_campaign")?.trim() || "",
        utmTerm: params.get("utm_term")?.trim() || "",
        utmContent: params.get("utm_content")?.trim() || "",
      };
      const hasUtm = Object.values(utmPayload).some(Boolean);
      if (hasUtm) {
        window.localStorage.setItem("revital_utm_params", JSON.stringify(utmPayload));
      }
    }

    // Inject tracking scripts from platform settings stored in the database.
    // We do this lazily so it never blocks the initial paint.
    const inject = async () => {
      try {
        const { getPlatformSettingsFn } = await import("@/server/adminFns");
        const s = await getPlatformSettingsFn();
        const ga4FromEnv = (import.meta.env.VITE_GA4_ID as string | undefined)?.trim() || "";
        const ga4Id = (s.ga4 || ga4FromEnv).trim();

        // Google Analytics (GA4)
        if (ga4Id && !document.getElementById("_ga4")) {
          const gScript = document.createElement("script");
          gScript.id = "_ga4";
          gScript.async = true;
          gScript.src = `https://www.googletagmanager.com/gtag/js?id=${ga4Id}`;
          document.head.appendChild(gScript);
          const gInline = document.createElement("script");
          gInline.id = "_ga4_inline";
          gInline.textContent = `window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','${ga4Id}');`;
          document.head.appendChild(gInline);
        }

        // Meta Pixel
        if (s.metaPixel && !document.getElementById("_fbpixel")) {
          const fbInline = document.createElement("script");
          fbInline.id = "_fbpixel";
          fbInline.textContent = `!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');fbq('init','${s.metaPixel}');fbq('track','PageView');`;
          document.head.appendChild(fbInline);
        }

        // Microsoft Clarity
        if (s.clarity && !document.getElementById("_clarity")) {
          const clScript = document.createElement("script");
          clScript.id = "_clarity";
          clScript.textContent = `(function(c,l,a,r,i,t,y){c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y)})(window,document,"clarity","script","${s.clarity}");`;
          document.head.appendChild(clScript);
        }

        // Google reCAPTCHA v3
        if (s.recaptchaSite && !document.getElementById("_recaptcha")) {
          const rcScript = document.createElement("script");
          rcScript.id = "_recaptcha";
          rcScript.async = true;
          rcScript.src = `https://www.google.com/recaptcha/api.js?render=${s.recaptchaSite}`;
          document.head.appendChild(rcScript);
          (window as typeof window & { __rcSiteKey?: string }).__rcSiteKey = s.recaptchaSite;
        }
      } catch (e) {
        // Tracking injection is best-effort — never throw to the user.
        // If settings API fails, still try GA4 from env for resiliency.
        const ga4FromEnv = (import.meta.env.VITE_GA4_ID as string | undefined)?.trim() || "";
        if (ga4FromEnv && !document.getElementById("_ga4")) {
          const gScript = document.createElement("script");
          gScript.id = "_ga4";
          gScript.async = true;
          gScript.src = `https://www.googletagmanager.com/gtag/js?id=${ga4FromEnv}`;
          document.head.appendChild(gScript);
          const gInline = document.createElement("script");
          gInline.id = "_ga4_inline";
          gInline.textContent = `window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','${ga4FromEnv}');`;
          document.head.appendChild(gInline);
        }
        if (import.meta.env.DEV) console.warn("Tracking injection failed:", e);
      }
    };
    inject();
  }, []);

  return (
    <div className="min-h-screen flex flex-col">
      <div className={`flex-1 md:pb-0 ${isAdminRoute ? "" : "pb-20"}`}>
        <Outlet />
      </div>
      {!isAdminRoute && <Footer />}
      {!isAdminRoute && <CookieConsent />}
    </div>
  );
}
