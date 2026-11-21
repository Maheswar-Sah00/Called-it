import { getRoom, tick } from "@/lib/server/rooms";
import { fail, ok } from "@/lib/server/http";

export const dynamic = "force-dynamic";

/** Replay clock. Clients nudge it; the server only acts once its own deadline has passed. */
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const room = await getRoom(id);
  if (!room) return fail(404, "Room not found");
  return ok(await tick(room));
}
