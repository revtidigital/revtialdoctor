import { useEffect, useRef, useState } from "react";

// ---------------------------------------------------------------------------
// Type declarations for the Google Identity Services (GSI) script
// https://developers.google.com/identity/oauth2/web/reference/js-reference
// ---------------------------------------------------------------------------

interface TokenResponse {
  access_token: string;
  error?: string;
  error_description?: string;
}

interface TokenClientConfig {
  client_id: string;
  scope: string;
  callback: (response: TokenResponse) => void;
  error_callback?: (error: { type: string }) => void;
}

interface TokenClient {
  requestAccessToken: (overrideConfig?: { prompt?: string }) => void;
}

declare global {
  interface Window {
    google?: {
      accounts: {
        oauth2: {
          initTokenClient: (config: TokenClientConfig) => TokenClient;
        };
      };
    };
  }
}

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface GoogleProfile {
  name: string;
  email: string;
  picture?: string;
}

interface UseGoogleSignInOptions {
  onSuccess: (profile: GoogleProfile) => void;
  onError?: (reason: string) => void;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

const GSI_SCRIPT_URL = "https://accounts.google.com/gsi/client";

export function useGoogleSignIn({ onSuccess, onError }: UseGoogleSignInOptions) {
  const [ready, setReady] = useState(false);
  const tokenClientRef = useRef<TokenClient | null>(null);

  // Keep callback refs stable so we never need to re-initialise the client
  const onSuccessRef = useRef(onSuccess);
  onSuccessRef.current = onSuccess;
  const onErrorRef = useRef(onError);
  onErrorRef.current = onError;

  useEffect(() => {
    const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined;
    if (!clientId) {
      console.warn(
        "[useGoogleSignIn] VITE_GOOGLE_CLIENT_ID is not set — Google Sign-In is disabled.",
      );
      return;
    }

    const init = () => {
      if (!window.google?.accounts?.oauth2) return;
      tokenClientRef.current = window.google.accounts.oauth2.initTokenClient({
        client_id: clientId,
        scope: "openid profile email",
        callback: async (tokenResponse) => {
          if (tokenResponse.error || !tokenResponse.access_token) {
            onErrorRef.current?.(
              tokenResponse.error_description ?? tokenResponse.error ?? "Google sign-in failed",
            );
            return;
          }
          try {
            const res = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
              headers: { Authorization: `Bearer ${tokenResponse.access_token}` },
            });
            if (!res.ok) throw new Error(`userinfo ${res.status}`);
            const data = (await res.json()) as { name?: string; email?: string; picture?: string };
            onSuccessRef.current({
              name: data.name ?? "",
              email: data.email ?? "",
              picture: data.picture,
            });
          } catch (err) {
            onErrorRef.current?.("Failed to fetch Google profile. Please try again.");
            console.error("[useGoogleSignIn] userinfo error", err);
          }
        },
        error_callback: (error) => {
          // User closed the popup or access was denied
          if (error.type !== "popup_closed") {
            onErrorRef.current?.("Google sign-in was cancelled or failed.");
          }
        },
      });
      setReady(true);
    };

    // If the script is already loaded (e.g. hot-reload), initialise immediately
    if (window.google?.accounts?.oauth2) {
      init();
      return;
    }

    // Avoid injecting duplicate <script> tags
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${GSI_SCRIPT_URL}"]`);
    if (existing) {
      existing.addEventListener("load", init, { once: true });
      return;
    }

    const script = document.createElement("script");
    script.src = GSI_SCRIPT_URL;
    script.async = true;
    script.defer = true;
    script.onload = init;
    script.onerror = () =>
      onErrorRef.current?.("Failed to load Google Sign-In. Check your internet connection.");
    document.head.appendChild(script);
  }, []); // intentionally empty — we only load the script once

  const signIn = () => {
    if (!tokenClientRef.current) {
      onErrorRef.current?.("Google Sign-In is not ready yet. Please try again in a moment.");
      return;
    }
    tokenClientRef.current.requestAccessToken({ prompt: "select_account" });
  };

  return { signIn, ready };
}
