"use client";

/**
 * Thin client wrapper over the Nexconn Chat Web SDK.
 * - Registers the CI:* custom card types BEFORE connecting.
 * - Connects to the North America data center (where the app lives).
 * - Enters the room's open channel and fans out messages, participant
 *   changes and metadata changes to one listener.
 * Everything it does is also logged to the "Nexconn inside" panel.
 */

import { CARD_TYPES, MT } from "@/lib/game";

export type LiveMsg = {
  id: string;
  type: string;
  from: string;
  at: number;
  content: Record<string, unknown>;
  text?: string;
};

export type LiveEvent =
  | { kind: "msg"; msg: LiveMsg }
  | { kind: "deleted"; ids: string[] }
  | { kind: "participants"; count: number }
  | { kind: "metadata"; data: Record<string, string> }
  | { kind: "status"; status: "connecting" | "live" | "offline"; detail?: string }
  | { kind: "muted"; me: boolean }
  | { kind: "blocked"; reason: string };

export type LogLine = { at: number; api: string; detail: string; ms?: number };

type SDK = typeof import("@nexconn/chat");

let sdk: SDK | null = null;
let joinSeq = 0;
/** How many mounted rooms hold each channel; we only exit when the last one leaves. */
const holds = new Map<string, number>();
let connectedAs: string | null = null;
let initialised = false;

const logs: LogLine[] = [];
const logSubs = new Set<(l: LogLine[]) => void>();
export function log(api: string, detail: string, ms?: number) {
  logs.unshift({ at: Date.now(), api, detail, ms });
  if (logs.length > 60) logs.pop();
  logSubs.forEach((f) => f([...logs]));
}
export function onLogs(f: (l: LogLine[]) => void) {
  logSubs.add(f);
  f([...logs]);
  return () => void logSubs.delete(f);
}

function areaCode(s: SDK) {
  const a = (process.env.NEXT_PUBLIC_NEXCONN_AREA || "NA").toUpperCase();
  const map = s.AreaCode as unknown as Record<string, number>;
  return (map[a] ?? map.NA) as unknown as import("@nexconn/chat").AreaCode;
}

async function load(appKey: string) {
  if (!sdk) sdk = await import("@nexconn/chat");
  if (!initialised) {
    // The Call SDK's plumbing must be installed before the chat engine starts.
    try {
      const call = await import("@nexconn/call");
      call.NCCallEngine.install();
      log("NCCallEngine.install", "voice + video ready");
    } catch (e) {
      log("NCCallEngine.install", `failed: ${String(e).slice(0, 60)}`);
    }
    sdk.NCEngine.initialize({ appKey, areaCode: areaCode(sdk), logLevel: sdk.LogLevel.ERROR });
    // Custom game cards must be registered before connect.
    sdk.NCEngine.registerCustomMessages([
      ...CARD_TYPES.map((t) => ({ messageType: t, isPersisted: t === MT.Result || t === MT.Moment, isCounted: false })),
      { messageType: MT.Tally, isPersisted: false, isCounted: false, isStatusMessage: true },
      { messageType: MT.React, isPersisted: false, isCounted: false, isStatusMessage: true },
    ]);
    log("NCEngine.registerCustomMessages", `${CARD_TYPES.length + 1} CI:* card types`);
    initialised = true;
  }
  return sdk;
}

function toMsg(m: import("@nexconn/chat").Message): LiveMsg {
  const c = (m.content ?? {}) as Record<string, unknown>;
  const text = typeof c.text === "string" ? c.text : typeof c.content === "string" ? (c.content as string) : undefined;
  return { id: m.messageId, type: m.messageType, from: m.senderUserId, at: m.sentTime || Date.now(), content: c, text };
}

/** One connect at a time per user, shared by every caller (React may mount twice). */
let connecting: { userId: string; p: Promise<void> } | null = null;
function connectOnce(s: SDK, userId: string, token: string): Promise<void> {
  if (connectedAs === userId) return Promise.resolve();
  if (connecting?.userId === userId) return connecting.p;
  const p = (async () => {
    if (connectedAs) await s.NCEngine.disconnect();
    const t0 = performance.now();
    const r = await s.NCEngine.connect({ token });
    log("NCEngine.connect", r.isOk ? `as ${userId}` : `failed ${r.code}`, Math.round(performance.now() - t0));
    if (!r.isOk) throw new Error(`connect failed ${r.code}`);
    connectedAs = userId;
  })();
  connecting = { userId, p };
  p.then(
    () => (connecting = null),
    () => (connecting = null),
  );
  return p;
}

export type Live = {
  send: (text: string) => Promise<{ ok: boolean; reason?: string }>;
  react: (emoji: string) => Promise<void>;
  leave: () => Promise<void>;
};

export async function joinLive(opts: {
  appKey: string;
  token: string;
  userId: string;
  channelId: string;
  onEvent: (e: LiveEvent) => void;
}): Promise<Live> {
  const s = await load(opts.appKey);
  const emit = opts.onEvent;
  emit({ kind: "status", status: "connecting" });

  const hid = `ci-${opts.channelId}-${++joinSeq}`;
  holds.set(opts.channelId, (holds.get(opts.channelId) ?? 0) + 1);
  s.NCEngine.addMessageHandler(
    hid,
    new s.MessageHandler({
      onMessageReceived({ messages }) {
        for (const m of messages) {
          if (m.channelIdentifier?.channelId && m.channelIdentifier.channelId !== opts.channelId) continue;
          emit({ kind: "msg", msg: toMsg(m) });
        }
      },
      onMessageDeleted({ messages }) {
        emit({ kind: "deleted", ids: messages.map((m) => m.messageId) });
        log("onMessageDeleted", `${messages.length} removed by the server`);
      },
      onMessageBlocked(e) {
        log("onMessageBlocked", JSON.stringify(e).slice(0, 80));
        emit({ kind: "blocked", reason: "Blocked by the room's safety check" });
      },
    }),
  );
  s.NCEngine.addOpenChannelHandler(
    hid,
    new s.OpenChannelHandler({
      onEntered({ response }) {
        emit({ kind: "participants", count: response.participantCount });
        if (response.isCurrentUserMuted) emit({ kind: "muted", me: true });
      },
      onParticipantChanged({ channelId, participantCount, actions }) {
        if (channelId !== opts.channelId) return;
        emit({ kind: "participants", count: participantCount });
        log("onParticipantChanged", `${participantCount} in room (${actions.length} change)`);
      },
      onMetadataChanged({ changeInfo }) {
        const data: Record<string, string> = {};
        for (const c of changeInfo) if (c.channelId === opts.channelId) data[c.key] = c.value;
        if (Object.keys(data).length) {
          emit({ kind: "metadata", data });
          log("onMetadataChanged", Object.entries(data).map(([k, v]) => `${k}=${v}`).join(" ").slice(0, 70));
        }
      },
      onParticipantMuted({ info }) {
        if (info.channelId !== opts.channelId) return;
        const me = info.userIdList.includes(opts.userId);
        if (me) emit({ kind: "muted", me: true });
        log("onParticipantMuted", `${info.userIdList.length} muted for ${Math.round(info.durationTime / 60)} min`);
      },
    }),
  );
  s.NCEngine.addConnectionStatusHandler(
    hid,
    new s.ConnectionStatusHandler({
      onConnectionStatusChanged(e) {
        log("onConnectionStatusChanged", String((e as { status?: unknown }).status ?? ""));
      },
    }),
  );

  if (connectedAs !== opts.userId) {
    try {
      await connectOnce(s, opts.userId, opts.token);
    } catch (e) {
      emit({ kind: "status", status: "offline", detail: String(e) });
      throw e;
    }
  }

  const ch = new s.OpenChannel(opts.channelId);
  const t1 = performance.now();
  const er = await ch.enterChannel({ messageCount: 30 });
  log("OpenChannel.enterChannel", er.isOk ? `${opts.channelId}, ${er.data?.participantCount ?? "?"} here` : `failed ${er.code}`, Math.round(performance.now() - t1));
  if (!er.isOk) {
    emit({ kind: "status", status: "offline", detail: `enter ${er.code}` });
    throw new Error(`enter failed ${er.code}`);
  }
  emit({ kind: "status", status: "live" });
  if (er.data) emit({ kind: "participants", count: er.data.participantCount });

  ch.getMetadata()
    .then((m) => {
      if (m.isOk && m.data) {
        emit({ kind: "metadata", data: m.data });
        log("OpenChannel.getMetadata", Object.keys(m.data).join(", ") || "empty");
      }
    })
    .catch(() => null);

  return {
    async send(text) {
      const t = performance.now();
      let r = await ch.sendMessage(new s.SendTextMessageParams({ text }));
      if (!r.isOk && r.code === 23406) {
        // not in the channel any more (network blip, tab sleep): walk back in and retry once
        const back = await ch.enterChannel({ messageCount: 0 });
        log("OpenChannel.enterChannel", back.isOk ? "re-entered after 23406" : `re-enter failed ${back.code}`);
        if (back.isOk) r = await ch.sendMessage(new s.SendTextMessageParams({ text }));
      }
      log("OpenChannel.sendMessage", r.isOk ? "RC:TxtMsg" : `refused ${r.code}`, Math.round(performance.now() - t));
      if (r.isOk && r.data) {
        emit({ kind: "msg", msg: toMsg(r.data) });
        return { ok: true };
      }
      return { ok: false, reason: r.code === 23408 || r.code === 23412 ? "You're muted by the host" : r.msg || `Not sent (${r.code})` };
    },
    async react(emoji) {
      const r = await ch.sendMessage(new s.SendMessageParams({ e: emoji }, MT.React));
      if (r.isOk && r.data) emit({ kind: "msg", msg: toMsg(r.data) });
    },
    async leave() {
      s.NCEngine.removeMessageHandler?.(hid);
      s.NCEngine.removeOpenChannelHandler?.(hid);
      s.NCEngine.removeConnectionStatusHandler?.(hid);
      const left = (holds.get(opts.channelId) ?? 1) - 1;
      holds.set(opts.channelId, left);
      if (left <= 0) {
        holds.delete(opts.channelId);
        await ch.exitChannel().catch(() => null);
      }
    },
  };
}
