import { getRoom, syncScore } from "@/lib/server/rooms";
import { fail, limited, ok } from "@/lib/server/http";

export const dynamic = "force-dynamic";

/**
 * Nudge: "check this room's real match". Any client may call it; the server
 * checks the feed at most once per 25 s per room and, only if the score moved,
 * pushes it to everyone through Nexconn open-channel metadata.
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0] ?? "local";
  if (limited(`score:${ip}`, 20, 60_000)) return fail(429, "Slow down");
  const room = await getRoom(id);
  if (!room) return fail(404, "Room not found");
  return ok(await syncScore(room));
}
