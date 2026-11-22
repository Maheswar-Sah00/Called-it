import { getRoom, lockMoment, markPending, openMoment, presetsFor, settle, withHostLease } from "@/lib/server/rooms";
import { muteInRoom, sendToRoom } from "@/lib/server/nexconn";
import { readSession } from "@/lib/server/session";
import { fail, limited, ok, readBody, str } from "@/lib/server/http";
import { blockReason, type Option } from "@/lib/game";

export const dynamic = "force-dynamic";

type Body = {
  action?: "open" | "lock" | "pending" | "result" | "mute" | "say";
  preset?: string;
  q?: string;
  labels?: string[];
  seconds?: number;
  reason?: string;
  outcome?: string;
  detail?: string;
  scoreline?: string;
  userId?: string;
  minutes?: number;
  text?: string;
};

type Out = Record<string, unknown> & { error?: string };

/** Host controls. Only the room's host may call these, and one runs at a time. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const s = await readSession();
  if (!s) return fail(401, "Join with a nickname first");
  const room = await getRoom(id);
  if (!room) return fail(404, "Room not found");
  if (room.hostId !== s.userId) return fail(403, "Only the host can do that");
  if (room.mode === "replay") return fail(400, "Replay rooms run themselves");
  if (await limited(`host:${s.userId}`, 40, 10_000)) return fail(429, "Slow down");
  const b = (await readBody(req)) as Body;
  const scoreline = str(b.scoreline, 60) || undefined;

  const r: Out | null = await withHostLease<Out>(id, async () => {
    switch (b.action) {
      case "open": {
        let q: string;
        let options: Option[];
        const preset = presetsFor(room.sport).find((p) => p.key === b.preset);
        if (preset) {
          q = preset.q;
          options = preset.options;
        } else {
          q = str(b.q, 80).trim();
          const labels = (Array.isArray(b.labels) ? b.labels : []).map((l) => str(l, 24).trim()).filter(Boolean).slice(0, 4);
          if (!q || labels.length < 2) return { error: "Write a question and at least two answers" };
          if (new Set(labels.map((l) => l.toLowerCase())).size !== labels.length) return { error: "Each answer must be different" };
          options = labels.map((label, i) => ({ id: `o${i}`, label, points: 10 }));
        }
        const secs = Number(b.seconds);
        const lockAt = secs >= 3 && secs <= 600 ? Date.now() + secs * 1000 : null;
        const { card, ms } = await openMoment(room, q, options, lockAt, undefined, scoreline);
        return { card, ms };
      }
      case "lock":
        return (await lockMoment(room)) ?? { error: "Nothing open to lock" };
      case "pending":
        return (await markPending(room, str(b.reason, 60) || "Under review")) ?? { error: "Nothing to review" };
      case "result": {
        const outcome = str(b.outcome, 32);
        if (!outcome) return { error: "Pick the result" };
        return (await settle(room, outcome, str(b.detail, 80) || undefined, scoreline)) ?? { error: "Already settled" };
      }
      case "mute": {
        const target = str(b.userId, 40);
        if (!target || target === s.userId) return { error: "Pick someone to mute" };
        const m = await muteInRoom(room.channelId, target, Math.min(Math.max(Number(b.minutes) || 10, 1), 120));
        return m.code === 0 ? { muted: target } : { error: `Mute failed (${m.code})` };
      }
      case "say": {
        const text = str(b.text, 140).trim();
        if (!text) return { error: "Empty" };
        const why = blockReason(text);
        if (why) return { error: why };
        await sendToRoom(room.channelId, "RC:TxtMsg", { content: `HOST: ${text}` }, { priority: 2 });
        return { said: true };
      }
      default:
        return { error: "Unknown action" };
    }
  }).catch((e) => {
    console.error("host action failed", b.action, e);
    return { error: "That didn't work. Try again" };
  });

  if (r === null) return fail(409, "Another host action is running");
  if (r.error) return fail(400, r.error);
  return ok(r);
}
