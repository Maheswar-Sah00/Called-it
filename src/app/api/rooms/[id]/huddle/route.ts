import { getHuddle, getRoom, isMember, setHuddle } from "@/lib/server/rooms";
import { readSession } from "@/lib/server/session";
import { fail, limited, ok, readBody, str } from "@/lib/server/http";

export const dynamic = "force-dynamic";

/**
 * Voice/video huddle bookkeeping. The call itself runs on the Nexconn Call SDK
 * in the browser; the server only records which call is live and announces it
 * to the room with a priority card, so anyone can tap "Join".
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const s = await readSession();
  if (!s) return fail(401, "Join with a nickname first");
  if (limited(`huddle:${s.userId}`, 10, 60_000)) return fail(429, "Slow down");
  const room = await getRoom(id);
  if (!room) return fail(404, "Room not found");
  if (!(await isMember(id, s.userId))) return fail(403, "Join the room first");
  const b = (await readBody(req)) as { action?: "start" | "end"; callId?: string; media?: "voice" | "video" };

  if (b.action === "start") {
    const callId = String(b.callId ?? "").slice(0, 128);
    if (!callId) return fail(400, "Missing call id");
    const h = { callId, media: b.media === "video" ? ("video" as const) : ("voice" as const), by: s.userId, byName: s.name, at: Date.now() };
    await setHuddle(room, h);
    return ok({ huddle: h });
  }
  if (b.action === "end") {
    const cur = await getHuddle(id);
    if (!b.callId) return fail(400, "Missing call id");
    if (cur && cur.callId === b.callId) await setHuddle(room, null);
    return ok({ huddle: null });
  }
  return fail(400, "Unknown action");
}
