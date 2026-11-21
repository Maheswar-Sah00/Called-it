import { roomState } from "@/lib/server/rooms";
import { readSession } from "@/lib/server/session";
import { fail, ok } from "@/lib/server/http";

export const dynamic = "force-dynamic";

/** Full room state (also what a late joiner sees first). */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const s = await readSession();
  const st = await roomState(id, s?.userId ?? null);
  if (!st) return fail(404, "Room not found");
  return ok({ ...st, serverNow: Date.now() });
}
