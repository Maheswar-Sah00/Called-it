import { getRoom, placeCall } from "@/lib/server/rooms";
import { readSession } from "@/lib/server/session";
import { fail, limited, ok } from "@/lib/server/http";

export const dynamic = "force-dynamic";

/** Make (or change) a call. The server clock decides; a late tap gets "locked". */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const now = Date.now(); // stamped on arrival, before any awaits
  const { id } = await params;
  const s = await readSession();
  if (!s) return fail(401, "Join with a nickname first");
  if (limited(`call:${s.userId}`, 30, 10_000)) return fail(429, "Easy there");
  const room = await getRoom(id);
  if (!room) return fail(404, "Room not found");
  const body = (await req.json().catch(() => ({}))) as { mid?: string; option?: string };
  if (!body.mid || !body.option) return fail(400, "Missing call");
  const r = await placeCall(room, s.userId, body.mid, body.option, now);
  if (r.status === "locked") return fail(409, "Locked", { status: "locked", lockAt: r.lockAt, at: now });
  if (r.status !== "ok") return fail(409, r.status === "stale" ? "That moment has passed" : "Not an option", { status: r.status });
  return ok({ status: "ok", tally: r.tally, at: now });
}
