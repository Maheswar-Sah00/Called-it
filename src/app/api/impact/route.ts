import { getJSON, scard } from "@/lib/server/store";
import { ok } from "@/lib/server/http";

export const dynamic = "force-dynamic";

/** Real usage only: demo rooms and bots are never counted. */
export async function GET() {
  const [users, rooms, calls, callers, blocked] = await Promise.all([
    scard("impact:users"),
    scard("impact:rooms"),
    getJSON<number>("impact:calls"),
    scard("impact:callers"),
    getJSON<number>("impact:blocked"),
  ]);
  return ok({ users, rooms, calls: Number(calls ?? 0), callers, blocked: Number(blocked ?? 0), at: Date.now() });
}
