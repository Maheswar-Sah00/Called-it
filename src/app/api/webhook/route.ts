import { BOT_ID, deleteRoomMessage, verifyWebhook } from "@/lib/server/nexconn";
import { blockReason, CARD_TYPES } from "@/lib/game";
import { incr } from "@/lib/server/store";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

type Item = {
  userId: string;
  channelId: string;
  channelType: number;
  messageType: string;
  content: string | Record<string, unknown>;
  time: number;
  messageId: string;
};
type Envelope = { type: string; id: string; time: number; data: Item[] };

function textOf(content: Item["content"]): string {
  try {
    const c = (typeof content === "string" ? JSON.parse(content) : content) as { content?: string; text?: string };
    return String(c.content ?? c.text ?? "");
  } catch {
    return String(content ?? "");
  }
}

/**
 * Why a message must not reach the room, or null.
 * 1. Only the server bot may send game cards (no forged results).
 * 2. Betting spam, links, phone numbers and off-app invites never land.
 */
function verdict(it: Item): string | null {
  if (it.userId === BOT_ID) return null;
  if (CARD_TYPES.includes(it.messageType)) return "Only Called It can post game cards";
  if (it.messageType === "RC:TxtMsg") return blockReason(textOf(it.content));
  return null;
}

/**
 * Nexconn webhooks (Console → Chat settings → Webhooks).
 * - open_channel:pre_messaging: synchronous; {pass:0} blocks before delivery.
 * - message:send: fallback when pre-messaging is off; delete after delivery.
 */
export async function POST(req: Request) {
  if (!verifyWebhook(req.headers)) return NextResponse.json({ error: "bad signature" }, { status: 401 });
  const env = (await req.json().catch(() => null)) as Envelope | null;
  const it = env?.data?.[0];
  if (!env || !it) return NextResponse.json({ pass: 1 });

  if (env.type.endsWith(":pre_messaging")) {
    const why = verdict(it);
    if (why) {
      void incr("impact:blocked");
      return NextResponse.json({ pass: 0, extra: why });
    }
    return NextResponse.json({ pass: 1 });
  }

  if (env.type === "message:send" && it.channelType === 4) {
    const why = verdict(it);
    if (why) {
      void incr("impact:blocked");
      await deleteRoomMessage(it.userId, it.channelId, it.messageId, it.time).catch(() => null);
    }
  }
  return NextResponse.json({ ok: true });
}
