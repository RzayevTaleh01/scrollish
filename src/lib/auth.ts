import { createHash, createPublicKey, randomBytes, verify, type JsonWebKey, type KeyObject } from "node:crypto";
import { accountBySession, deleteSession, insertSession, saveAccount } from "./db";
import type { Account } from "./types";

/**
 * Sign-in with Google (One Tap and Google's button). The page hands over the ID token Google gave it,
 * the token is checked here against Google's public keys, and the viewer gets a session cookie.
 * Only GOOGLE_CLIENT_ID is needed: the OAuth client id of the site, from Google Cloud Console.
 */

export const SESSION_COOKIE = "scrollish_session";
const SESSION_DAYS = 60;

const GOOGLE_CERTS_URL = "https://www.googleapis.com/oauth2/v3/certs";
const GOOGLE_ISSUERS = new Set(["accounts.google.com", "https://accounts.google.com"]);
/** How far apart this server's clock and Google's may be, in seconds. */
const CLOCK_SKEW_S = 60;
/** A token naming a key that is not known yet makes the keys be fetched again, but not more often than this. */
const CERTS_REFETCH_MS = 60_000;
const FETCH_TIMEOUT_MS = 5000;
/** Google's ID tokens are about 1 KB. */
const MAX_TOKEN_LENGTH = 8192;

export function googleClientId(): string | null {
  return process.env.GOOGLE_CLIENT_ID?.trim() || null;
}

interface Certs {
  keys: Map<string, KeyObject>;
  fetchedAt: number;
  expiresAt: number;
}

let certs: Certs | null = null;

async function fetchCerts(): Promise<Certs> {
  const res = await fetch(GOOGLE_CERTS_URL, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
  if (!res.ok) throw new Error(`Google keys: HTTP ${res.status}`);
  const body = (await res.json()) as { keys?: (JsonWebKey & { kid?: string })[] };
  const keys = new Map<string, KeyObject>();
  for (const jwk of body.keys ?? []) {
    if (jwk.kid) keys.set(jwk.kid, createPublicKey({ key: jwk, format: "jwk" }));
  }
  // Google says for how long the keys hold in Cache-Control.
  const maxAge = Number(/max-age=(\d+)/.exec(res.headers.get("cache-control") ?? "")?.[1] ?? 3600);
  const now = Date.now();
  return { keys, fetchedAt: now, expiresAt: now + maxAge * 1000 };
}

async function googleKey(kid: string): Promise<KeyObject | undefined> {
  const now = Date.now();
  if (!certs || now > certs.expiresAt || (!certs.keys.has(kid) && now - certs.fetchedAt > CERTS_REFETCH_MS)) {
    certs = await fetchCerts();
  }
  return certs.keys.get(kid);
}

const decodePart = (part: string) => JSON.parse(Buffer.from(part, "base64url").toString("utf8"));

/** The account in a Google ID token, once its signature, issuer, audience and time are checked. Throws otherwise. */
export async function verifyGoogleIdToken(token: string, clientId: string): Promise<Account> {
  if (token.length > MAX_TOKEN_LENGTH) throw new Error("Token too long");
  const parts = token.split(".");
  if (parts.length !== 3) throw new Error("Not a JWT");
  const [headerPart, payloadPart, signaturePart] = parts;

  const header = decodePart(headerPart);
  if (header?.alg !== "RS256" || typeof header.kid !== "string") throw new Error("Unexpected token header");
  const key = await googleKey(header.kid);
  if (!key) throw new Error("Unknown signing key");
  const signed = verify(
    "RSA-SHA256",
    Buffer.from(`${headerPart}.${payloadPart}`),
    key,
    Buffer.from(signaturePart, "base64url"),
  );
  if (!signed) throw new Error("Bad signature");

  const claims = decodePart(payloadPart);
  const now = Date.now() / 1000;
  if (!GOOGLE_ISSUERS.has(claims.iss)) throw new Error("Wrong issuer");
  if (claims.aud !== clientId) throw new Error("Token is for another site");
  if (typeof claims.exp !== "number" || claims.exp + CLOCK_SKEW_S < now) throw new Error("Token expired");
  if (typeof claims.iat === "number" && claims.iat - CLOCK_SKEW_S > now) throw new Error("Token from the future");
  if (typeof claims.sub !== "string" || !claims.sub) throw new Error("No account id");
  if (typeof claims.email !== "string" || claims.email_verified !== true) throw new Error("No verified email");

  return {
    id: claims.sub,
    email: claims.email,
    name: typeof claims.name === "string" ? claims.name : claims.email.split("@")[0],
    picture: typeof claims.picture === "string" ? claims.picture : null,
  };
}

const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");

/** Saves the account and opens a session for it. The token goes in the cookie, its hash in the database. */
export async function signIn(account: Account): Promise<{ account: Account; token: string; expires: Date }> {
  const saved = await saveAccount(account);
  const token = randomBytes(32).toString("base64url");
  const expires = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);
  await insertSession(hashToken(token), saved.id, expires.getTime());
  return { account: saved, token, expires };
}

/** The account behind a session cookie, or null. A visitor without the cookie costs no database query. */
export async function currentAccount(token: string | undefined): Promise<Account | null> {
  if (!token || token.length > 100) return null;
  return accountBySession(hashToken(token));
}

export async function signOut(token: string | undefined) {
  if (token && token.length <= 100) await deleteSession(hashToken(token));
}

export function sessionCookie(token: string, expires: Date) {
  return {
    name: SESSION_COOKIE,
    value: token,
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires,
  };
}
