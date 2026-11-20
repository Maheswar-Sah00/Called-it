import "server-only";
import { NextResponse } from "next/server";

export function ok(data: unknown, init?: number) {
  return NextResponse.json(data, { status: init ?? 200, headers: { "Cache-Control": "no-store" } });
}

export function fail(status: number, error: string, extra?: Record<string, unknown>) {
  return NextResponse.json({ error, ...extra }, { status, headers: { "Cache-Control": "no-store" } });
}

/** Simple fixed-window rate limit per key, in memory per instance (good enough to stop floods). */
const buckets = new Map<string, { n: number; reset: number }>();
export function limited(key: string, max: number, windowMs: number) {
  const now = Date.now();
  const b = buckets.get(key);
  if (!b || b.reset < now) {
    buckets.set(key, { n: 1, reset: now + windowMs });
    return false;
  }
  b.n++;
  return b.n > max;
}
