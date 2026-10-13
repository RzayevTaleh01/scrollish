/** The parts of Google Identity Services (the One Tap prompt and the sign-in button) used here. */
export interface GoogleIdentity {
  initialize(config: {
    client_id: string;
    callback: (response: { credential: string }) => void;
    /** Signs a returning viewer in by itself, when they have only one Google account that used this site. */
    auto_select?: boolean;
    cancel_on_tap_outside?: boolean;
    context?: "signin" | "signup" | "use";
    itp_support?: boolean;
    /** The prompt through the browser's own sign-in (FedCM), which Chrome now requires. */
    use_fedcm_for_prompt?: boolean;
  }): void;
  prompt(): void;
  renderButton(
    parent: HTMLElement,
    options: {
      type?: "standard" | "icon";
      theme?: "outline" | "filled_blue" | "filled_black";
      size?: "large" | "medium" | "small";
      text?: "signin_with" | "signup_with" | "continue_with" | "signin";
      shape?: "rectangular" | "pill" | "circle" | "square";
      logo_alignment?: "left" | "center";
      width?: number;
      /** Otherwise the browser's language. */
      locale?: string;
    },
  ): void;
  /** After signing out, so the prompt does not sign the viewer straight back in. */
  disableAutoSelect(): void;
  cancel(): void;
}

declare global {
  interface Window {
    google?: { accounts?: { id?: GoogleIdentity } };
  }
}

const GOOGLE_IDENTITY_URL = "https://accounts.google.com/gsi/client";

let scriptPromise: Promise<GoogleIdentity> | null = null;

export function loadGoogleIdentity(): Promise<GoogleIdentity> {
  const ready = window.google?.accounts?.id;
  if (ready) return Promise.resolve(ready);

  scriptPromise ??= new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = GOOGLE_IDENTITY_URL;
    script.async = true;
    script.onload = () => {
      const id = window.google?.accounts?.id;
      if (id) resolve(id);
      else reject(new Error("Google sign-in did not start"));
    };
    script.onerror = () => {
      // Blocked or offline: the next call tries again.
      scriptPromise = null;
      script.remove();
      reject(new Error("Could not load Google sign-in"));
    };
    document.head.appendChild(script);
  });

  return scriptPromise;
}
