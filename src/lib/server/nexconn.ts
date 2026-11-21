import "server-only";
import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

/**
 * Nexconn Platform Chat API client (server only).
 * Every call is signed with SHA1(AppSecret + Nonce + Timestamp) and fails over
 * from the primary to the backup domain, as the Nexconn docs recommend.
 */

const HOSTS = [
  process.env.NEXCONN_API_HOST || "api.sg-light-api.com",
  process.env.NEXCONN_API_HOST_BACKUP || "api-b.sg-light-api.com",
];
let hostIndex = 0;

export const BOT_ID = "calledit_bot";

export function appKey(): string {
  const k = process.env.NEXCONN_APP_KEY;
  if (!k) throw new Error("NEXCONN_APP_KEY is not set");
  return k;
}

function appSecret(): string {
  const s = process.env.NEXCONN_APP_SECRET;
  if (!s) throw new Error("NEXCONN_APP_SECRET is not set");
  return s;
}

export function sign(nonce: string, timestamp: string): string {
  return createHash("sha1").update(appSecret() + nonce + timestamp).digest("hex");
}

/** Verifies the signature headers Nexconn puts on webhook requests. */
export function verifyWebhook(headers: Headers): boolean {
  const nonce = headers.get("nonce") || "";
  const ts = headers.get("timestamp") || "";
  const sig = (headers.get("signature") || "").toLowerCase();
  if (!nonce || !ts || !sig) return false;
  if (Math.abs(Date.now() - Number(ts)) > 5 * 60_000) return false; // replay window
  const want = Buffer.from(sign(nonce, ts));
  const got = Buffer.from(sig);
  return want.length === got.length && timingSafeEqual(want, got);
}

export type NexconnResult<T = unknown> = { code: number; result?: T; ms: number; errorMessage?: string };

export async function nexconn<T = unknown>(path: string, body: unknown): Promise<NexconnResult<T>> {
  let lastErr: unknown;
  for (let attempt = 0; attempt < 2; attempt++) {
    const host = HOSTS[hostIndex];
    const nonce = randomBytes(6).toString("hex");
    const timestamp = String(Date.now());
    const started = Date.now();
    try {
      const res = await fetch(`https://${host}${path}`, {
        method: "POST",
        headers: {
          "App-Key": appKey(),
          Nonce: nonce,
          Timestamp: timestamp,
          Signature: sign(nonce, timestamp),
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(5000),
        cache: "no-store",
      });
      const json = (await res.json().catch(() => ({}))) as { code?: number; result?: T; errorMessage?: string };
      if (res.status >= 500) throw new Error(`HTTP ${res.status}`);
      return { code: json.code ?? res.status, result: json.result, ms: Date.now() - started, errorMessage: json.errorMessage };
    } catch (e) {
      lastErr = e;
      hostIndex = (hostIndex + 1) % HOSTS.length; // fail over to the other domain
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error(String(lastErr));
}

/** Issue an access token for a user (registers the user on first call). */
export async function issueToken(userId: string, name: string) {
  const r = await nexconn<{ userId: string; accessToken: string }>("/v4/auth/access-token/issue", { userId, name });
  if (r.code !== 0 || !r.result) throw new Error(`token issue failed: ${r.code} ${r.errorMessage ?? ""}`);
  return { token: r.result.accessToken, ms: r.ms };
}

/** Create an open channel for a match room. Destroyed after 24 h of inactivity. */
export async function createOpenChannel(channelId: string, metadata?: Record<string, string>, ttlMinutes = 1440) {
  return nexconn("/v4/open-channel/create", {
    channelId,
    destroyType: 0,
    ttlMinutes: Math.min(Math.max(ttlMinutes, 60), 10080), // Nexconn range 60–10,080; closes after this much inactivity
    ...(metadata ? { metadataOwnerId: BOT_ID, metadata } : {}),
  });
}

/**
 * Send a message from the server bot into an open channel.
 * priority 2 = high priority (result and lock cards cut through the chatter).
 */
export async function sendToRoom(
  channelId: string,
  messageType: string,
  content: Record<string, unknown>,
  opts: { priority?: 0 | 2; persist?: boolean; from?: string } = {},
) {
  return nexconn<{ messageIds: { channelId: string; messageId: string }[] }>("/v4/open-channel/message/send", {
    fromUserId: opts.from ?? BOT_ID,
    toChannelIds: [channelId],
    messageType,
    content: JSON.stringify(content),
    shouldPersist: opts.persist === false ? 0 : 1,
    isEchoToSender: 0,
    priority: opts.priority ?? 0,
  });
}

/** Live room state mirrored into open-channel metadata, so late joiners see it at once. */
export async function setRoomMetadata(channelId: string, metadata: Record<string, string>) {
  return nexconn("/v4/open-channel/metadata/batch/set", {
    channelId,
    shouldAutoDelete: 0,
    metadataOwnerId: BOT_ID,
    metadata,
  });
}

/** Close open channels now (Free plan allows 50 at once, so finished demo rooms are recycled). */
export async function destroyOpenChannels(channelIds: string[]) {
  if (!channelIds.length) return { code: 0, ms: 0 };
  return nexconn("/v4/open-channel/destroy", { channelIds });
}

/** Host control: mute a participant in the room. */
export async function muteInRoom(channelId: string, userId: string, minutes: number) {
  return nexconn("/v4/open-channel/participant/mute-list/add", {
    channelId,
    participantIds: [userId],
    durationMinutes: minutes,
    needNotify: true,
  });
}

/** Delete a message for everyone (fallback when pre-messaging is not enabled). */
export async function deleteRoomMessage(fromUserId: string, channelId: string, messageId: string, sentAt: number) {
  return nexconn("/v4/message/delete", { fromUserId, channelType: 4, channelId, messageId, sentAt });
}
