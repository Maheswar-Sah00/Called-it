import { ensureChannel, getRoom, rememberName } from "@/lib/server/rooms";
import { readSession } from "@/lib/server/session";
import { fail, ok } from "@/lib/server/http";

export const dynamic = "force-dynamic";

/** Register the player's name and avatar in this room. */
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const s = await readSession();
  if (!s) return fail(401, "Join with a nickname first");
  const room = await getRoom(id);
  if (!room) return fail(404, "Room not found");
  await rememberName(id, s.userId, s.name, s.avatar);
  // A room left idle may have had its channel recycled (Free-plan cap); reopen it before entering.
  try {
    await ensureChannel(room);
  } catch (e) {
    console.error("ensureChannel failed", id, e);
    return fail(503, "The room is waking up. Try again in a moment");
  }
  return ok({ joined: true });
}
