import "server-only";
import { NextResponse } from "next/server";
import { hit } from "./store";

export function ok(data: unknown, init?: number) {
  return NextResponse.json(data, { status: init ?? 200, headers: { "Cache-Control": "no-store" } });
}

export function fail(status: number, error: string, extra?: Record<string, unknown>) {
  return NextResponse.json({ error, ...extra }, { status, headers: { "Cache-Control": "no-store" } });
}

/**
 * Fixed-window rate limit shared across all serverless instances (Redis).
 * Fails open if the store hiccups: a limiter must never take the app down.
 */
export async function limited(key: string, max: number, windowMs: number): Promise<boolean> {
  try {
    return (await hit(`rl:${key}`, windowMs)) > max;
  } catch {
    return false;
  }
}

/** The caller's IP as Vercel sees it. */
export function clientIp(req: Request) {
  return req.headers.get("x-real-ip") ?? req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
}

/**
 * Refuse cross-site POSTs. A browser always sends Origin on a cross-site POST,
 * so another page can't create sessions or rooms from its visitors' browsers.
 */
export function crossSite(req: Request) {
  const origin = req.headers.get("origin");
  if (!origin) return false;
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  try {
    return new URL(origin).host !== host;
  } catch {
    return true;
  }
}

/** Parse a JSON body into a plain object; anything else (null, array, number, bad JSON) becomes {}. */
export async function readBody<T extends Record<string, unknown>>(req: Request): Promise<Partial<T>> {
  const v = (await req.json().catch(() => null)) as unknown;
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Partial<T>) : {};
}

/** A plain short string from untrusted input, or "". */
export function str(v: unknown, max: number): string {
  return typeof v === "string" || typeof v === "number" ? String(v).slice(0, max) : "";
}
