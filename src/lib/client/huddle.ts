"use client";

/**
 * Voice / video huddles on the Nexconn Call SDK (multi-party).
 * The chat connection (live.ts) must be up first; the Call SDK rides on it.
 */
import { log } from "./live";
import type {
  NCCallConnectedEvent,
  NCCallEndedEvent,
  NCCallReceivedEvent,
  NCCallRemoteCameraStateChangedEvent,
  NCCallRemoteUserStateChangedEvent,
  NCCallUser,
} from "@nexconn/call";

type CallMod = typeof import("@nexconn/call");
let mod: CallMod | null = null;
let engine: import("@nexconn/call").NCCallEngine | null = null;

export type HuddleEvents = {
  onIncoming?: (callId: string, from: string, video: boolean) => void;
  onConnected?: (callId: string) => void;
  onEnded?: (callId: string, reason: number) => void;
  onPeople?: (userIds: string[]) => void;
  onVolume?: (levels: Record<string, number>) => void;
  onRemoteCamera?: (userId: string, on: boolean) => void;
};

let current: string | null = null;
let people = new Set<string>();
let handlers: HuddleEvents = {};

async function ensure() {
  if (!mod) mod = await import("@nexconn/call");
  if (!engine) {
    engine = mod.NCCallEngine.initialize({ logOutputLevel: mod.NCCallLogLevel.ERROR, isPubLowResolutionStream: true });
    engine.setCallEventHandler({
      onCallReceived({ session }: NCCallReceivedEvent) {
        const video = session.getMediaType() === mod!.NCCallMediaType.AUDIO_VIDEO;
        log("onCallReceived", `${video ? "video" : "voice"} huddle from ${session.getCallerUserId()}`);
        handlers.onIncoming?.(session.getCallId(), session.getCallerUserId(), video);
      },
      onCallConnected({ session }: NCCallConnectedEvent) {
        current = session.getCallId();
        people = new Set(session.getRemoteParticipants().map((u: NCCallUser) => u.userId));
        log("onCallConnected", `${session.getCallId().slice(0, 10)}…, ${people.size} other(s)`);
        handlers.onConnected?.(session.getCallId());
        handlers.onPeople?.([...people]);
      },
      onCallEnded({ session, reason }: NCCallEndedEvent) {
        log("onCallEnded", `reason ${reason}`);
        if (current === session.getCallId()) current = null;
        people.clear();
        handlers.onEnded?.(session.getCallId(), reason);
        handlers.onPeople?.([]);
      },
      onRemoteUserStateChanged({ userId, userState }: NCCallRemoteUserStateChangedEvent) {
        // 0 idle / left, others = calling / ringing / connected
        if (Number(userState) === 0) people.delete(userId);
        else people.add(userId);
        handlers.onPeople?.([...people]);
      },
      onRemoteCameraStateChanged(e: NCCallRemoteCameraStateChangedEvent) {
        handlers.onRemoteCamera?.(e.userId, !e.disabled);
      },
    } as unknown as import("@nexconn/call").NCCallEventHandler);
    engine.setConnectionQualityHandler({
      onAudioVolumeChanged(levels: unknown) {
        const out: Record<string, number> = {};
        if (levels instanceof Map) levels.forEach((v, k) => (out[String(k)] = Number(v)));
        else if (levels && typeof levels === "object") Object.assign(out, levels as Record<string, number>);
        handlers.onVolume?.(out);
      },
    } as unknown as import("@nexconn/call").NCCallConnectionQualityHandler);
  }
  return { m: mod, e: engine };
}

export function setHuddleHandlers(h: HuddleEvents) {
  handlers = h;
}

export function inHuddle() {
  return current;
}

/** Plain-English versions of NCCallCode values. */
const ERR: Record<number, string> = {
  80001: "something was missing in the request",
  80002: "you're already on a call",
  80003: "that huddle has already ended",
  80006: "voice & video isn't switched on for this Nexconn app yet",
  80007: "nobody to call",
  80008: "that huddle has already ended",
  80012: "chat isn't connected yet, try again in a second",
  80100: "your camera is off or blocked",
  80101: "your microphone is off or blocked",
};
function why(code: number) {
  return ERR[code] ?? `Nexconn Call error ${code}`;
}

export async function startHuddle(calleeIds: string[], video: boolean): Promise<{ ok: true; callId: string } | { ok: false; error: string }> {
  const { m, e } = await ensure();
  const t = performance.now();
  const r = await e.startCall({
    calleeIds,
    callType: m.NCCallType.MULTI,
    mediaType: video ? m.NCCallMediaType.AUDIO_VIDEO : m.NCCallMediaType.AUDIO,
    extra: "called-it-huddle",
  } as import("@nexconn/call").NCCallStartCallParams);
  log("NCCallEngine.startCall", r.callId ? `${video ? "video" : "voice"} · ${calleeIds.length} invited` : `failed ${r.code}`, Math.round(performance.now() - t));
  if (!r.callId) return { ok: false, error: why(r.code) };
  current = r.callId;
  return { ok: true, callId: r.callId };
}

export async function joinHuddle(callId: string): Promise<{ ok: boolean; error?: string }> {
  const { e } = await ensure();
  const t = performance.now();
  const r = await e.joinCall({ callId });
  log("NCCallEngine.joinCall", r.code === 0 ? "joined" : `failed ${r.code}`, Math.round(performance.now() - t));
  if (r.code !== 0) return { ok: false, error: why(r.code) };
  current = callId;
  return { ok: true };
}

export async function acceptHuddle(callId: string) {
  const { e } = await ensure();
  const r = await e.acceptCall({ callId });
  log("NCCallEngine.acceptCall", r.code === 0 ? "accepted" : `failed ${r.code}`);
  if (r.code === 0) current = callId;
  return r.code === 0;
}

export async function leaveHuddle() {
  const { e } = await ensure();
  const id = current;
  const r = await e.endCall(id ? { callId: id } : undefined);
  log("NCCallEngine.endCall", r.code === 0 ? "left the huddle" : `code ${r.code}`);
  current = null;
  people.clear();
  return id;
}

export async function setMic(on: boolean) {
  const { e } = await ensure();
  return (await e.enableMicrophone(on)).code === 0;
}

export async function setCam(on: boolean) {
  const { e } = await ensure();
  return (await e.enableCamera(on)).code === 0;
}

export async function bindLocal(el: HTMLVideoElement) {
  const { e } = await ensure();
  return e.setLocalVideoView({ videoElement: el }).code === 0;
}

export async function bindRemote(userId: string, el: HTMLVideoElement) {
  const { e } = await ensure();
  return e.setRemoteVideoView([{ userId, videoElement: el, enableLowResolutionStream: true }]).code === 0;
}
