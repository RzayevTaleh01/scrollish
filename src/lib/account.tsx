"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { loadGoogleIdentity, type GoogleIdentity } from "./google-identity";
import type { Account } from "./types";

interface AccountContext {
  /** The viewer signed in with Google, or null. */
  account: Account | null;
  /** False until the session has been checked. */
  ready: boolean;
  /** Draws Google's sign-in button into `parent`. Null while Google sign-in is not set up or still loading. */
  renderButton: ((parent: HTMLElement) => void) | null;
  signOut: () => Promise<void>;
}

interface Session {
  account: Account | null;
  clientId: string | null;
}

const Context = createContext<AccountContext | null>(null);

/**
 * Google's script is set up once per page, but the provider can mount more than once (React runs
 * effects twice in development), so Google's callback hands the credential to whichever is mounted now.
 */
let initializedFor: string | null = null;
let prompted = false;
let deliver: ((credential: string) => void) | null = null;

async function postCredential(credential: string): Promise<Account> {
  const res = await fetch("/api/auth", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ credential }),
  });
  if (!res.ok) throw new Error(`Sign-in failed: HTTP ${res.status}`);
  return ((await res.json()) as { account: Account }).account;
}

/**
 * Sign-in with Google. As soon as the page opens, a visitor who is not signed in gets Google's
 * One Tap prompt (top right on a computer, at the bottom on a phone); one who has used it before
 * is signed in by itself. The Profile panel has Google's button for later.
 */
export function AccountProvider({ children }: { children: ReactNode }) {
  const [account, setAccount] = useState<Account | null>(null);
  const [ready, setReady] = useState(false);
  const [google, setGoogle] = useState<GoogleIdentity | null>(null);

  useEffect(() => {
    deliver = (credential) => {
      postCredential(credential)
        .then(setAccount)
        .catch((err) => console.warn("[account]", err));
    };
    return () => {
      deliver = null;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const res = await fetch("/api/auth", { cache: "no-store" });
      if (!res.ok) throw new Error(`Session check failed: HTTP ${res.status}`);
      const session = (await res.json()) as Session;
      if (cancelled) return;
      setAccount(session.account);
      setReady(true);
      if (!session.clientId) return;

      const id = await loadGoogleIdentity();
      if (cancelled) return;
      if (initializedFor !== session.clientId) {
        id.initialize({
          client_id: session.clientId,
          callback: ({ credential }) => deliver?.(credential),
          auto_select: true,
          cancel_on_tap_outside: false,
          context: "signin",
          itp_support: true,
          use_fedcm_for_prompt: true,
        });
        initializedFor = session.clientId;
      }
      setGoogle(id);
      // Once per page load: Google itself waits longer each time the viewer closes the prompt.
      if (!session.account && !prompted) {
        prompted = true;
        id.prompt();
      }
    })().catch((err) => {
      console.warn("[account]", err);
      if (!cancelled) setReady(true);
    });

    return () => {
      cancelled = true;
    };
  }, []);

  const renderButton = useMemo(() => {
    if (!google) return null;
    return (parent: HTMLElement) =>
      google.renderButton(parent, {
        type: "standard",
        theme: "filled_black",
        size: "large",
        text: "signin_with",
        shape: "rectangular",
        logo_alignment: "left",
        // In the language of the rest of the app.
        locale: "en",
        // Google takes a width between 200 and 400 pixels.
        width: Math.round(Math.min(400, Math.max(200, parent.clientWidth))),
      });
  }, [google]);

  const signOut = useCallback(async () => {
    google?.disableAutoSelect();
    await fetch("/api/auth", { method: "DELETE" }).catch(() => {});
    setAccount(null);
  }, [google]);

  const value = useMemo<AccountContext>(
    () => ({ account, ready, renderButton, signOut }),
    [account, ready, renderButton, signOut],
  );

  return <Context.Provider value={value}>{children}</Context.Provider>;
}

export function useAccount(): AccountContext {
  const ctx = useContext(Context);
  if (!ctx) throw new Error("useAccount must be used inside AccountProvider");
  return ctx;
}
