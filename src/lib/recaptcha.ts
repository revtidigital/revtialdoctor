declare global {
  interface Window {
    __rcSiteKey?: string;
    grecaptcha?: {
      ready: (cb: () => void) => void;
      execute: (siteKey: string, options: { action: string }) => Promise<string>;
    };
  }
}

/**
 * Executes reCAPTCHA v3 and returns a token.
 * Returns an empty string silently when reCAPTCHA is not configured or not yet loaded,
 * so the caller can treat verification as optional.
 */
export function executeRecaptcha(action: string): Promise<string> {
  return new Promise((resolve) => {
    const { grecaptcha, __rcSiteKey } = window;
    if (!grecaptcha || !__rcSiteKey) {
      resolve("");
      return;
    }
    grecaptcha.ready(async () => {
      try {
        const token = await grecaptcha.execute(__rcSiteKey, { action });
        resolve(token);
      } catch {
        resolve("");
      }
    });
  });
}
