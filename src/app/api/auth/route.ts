import { NextRequest, NextResponse } from "next/server";
import {
  currentAccount,
  googleClientId,
  SESSION_COOKIE,
  sessionCookie,
  signIn,
  signOut,
  verifyGoogleIdToken,
} from "@/lib/auth";

export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "no-store" };

/**
 * Only this site's own pages may sign in or out. A form on another site cannot send JSON, and
 * browsers say where a request comes from in Sec-Fetch-Site.
 */
function fromThisSite(req: NextRequest, needsJson: boolean): boolean {
  const site = req.headers.get("sec-fetch-site");
  if (site && site !== "same-origin") return false;
  return !needsJson || (req.headers.get("content-type") ?? "").startsWith("application/json");
}

/** Who is signed in, and the client id the page needs to offer Google sign-in (null when it is not set up). */
export async function GET(req: NextRequest) {
  const account = await currentAccount(req.cookies.get(SESSION_COOKIE)?.value);
  return NextResponse.json({ account, clientId: googleClientId() }, { headers: NO_STORE });
}

/** Sign-in: the body is `{ credential }`, the ID token Google handed the page. */
export async function POST(req: NextRequest) {
  if (!fromThisSite(req, true)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const clientId = googleClientId();
  if (!clientId) return NextResponse.json({ error: "Google sign-in is not set up" }, { status: 503 });

  const body = await req.json().catch(() => null);
  const credential = typeof body?.credential === "string" ? body.credential : null;
  if (!credential) return NextResponse.json({ error: "Missing credential" }, { status: 400 });

  let verified;
  try {
    verified = await verifyGoogleIdToken(credential, clientId);
  } catch (err) {
    console.warn("[auth] rejected Google token:", (err as Error).message);
    return NextResponse.json({ error: "Invalid credential" }, { status: 401 });
  }

  const { account, token, expires } = await signIn(verified);
  const res = NextResponse.json({ account }, { headers: NO_STORE });
  res.cookies.set(sessionCookie(token, expires));
  return res;
}

export async function DELETE(req: NextRequest) {
  if (!fromThisSite(req, false)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  await signOut(req.cookies.get(SESSION_COOKIE)?.value);
  const res = NextResponse.json({ account: null }, { headers: NO_STORE });
  res.cookies.delete(SESSION_COOKIE);
  return res;
}
