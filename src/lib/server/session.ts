import "server-only";
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

/** Signed cookie session: "userId.name.hmac". No accounts, no passwords. */
const COOKIE = "ci_session";

function secret() {
  return process.env.SESSION_SECRET || process.env.NEXCONN_APP_SECRET || "dev-only-secret";
}

function mac(v: string) {
  return createHmac("sha256", secret()).update(v).digest("base64url");
}

export type Session = { userId: string; name: string; avatar?: string };

export function newUserId() {
  return "u" + randomBytes(9).toString("base64url").replace(/[^a-zA-Z0-9]/g, "x");
}

export async function writeSession(s: Session) {
  const payload = Buffer.from(JSON.stringify(s)).toString("base64url");
  (await cookies()).set(COOKIE, `${payload}.${mac(payload)}`, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 60,
  });
}

export async function readSession(): Promise<Session | null> {
  const raw = (await cookies()).get(COOKIE)?.value;
  if (!raw) return null;
  const [payload, sig] = raw.split(".");
  if (!payload || !sig) return null;
  const want = Buffer.from(mac(payload));
  const got = Buffer.from(sig);
  if (want.length !== got.length || !timingSafeEqual(want, got)) return null;
  try {
    const s = JSON.parse(Buffer.from(payload, "base64url").toString()) as Session;
    return s.userId && s.name ? s : null;
  } catch {
    return null;
  }
}

export function cleanName(name: unknown): string | null {
  if (typeof name !== "string") return null;
  // Drop control and invisible format characters (zero-width, bidi overrides), cut by whole characters.
  const n = Array.from(name.replace(/[\p{Cc}\p{Cf}<>]/gu, "").replace(/\s+/g, " ").trim()).slice(0, 24).join("").trim();
  return n.length >= 1 ? n : null;
}
