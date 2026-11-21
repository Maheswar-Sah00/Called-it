"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { HuddleInfo } from "@/lib/game";
import { api } from "@/lib/client/session";
import {
  acceptHuddle,
  bindLocal,
  bindRemote,
  joinHuddle,
  leaveHuddle,
  setCam,
  setHuddleHandlers,
  setMic,
  startHuddle,
} from "@/lib/client/huddle";
import { Art, Avatar } from "@/components/ui";

type Names = Record<string, { name: string; avatar: string }>;

function MicIcon({ off = false }: { off?: boolean }) {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden>
      <rect x="8.5" y="3" width="7" height="12" rx="3.5" fill="currentColor" />
      <path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21M8.5 21h7" stroke="currentColor" strokeWidth="2.2" fill="none" strokeLinecap="round" />
      {off && <path d="M4 4l16 16" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" />}
    </svg>
  );
}
function CamIcon({ off = false }: { off?: boolean }) {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden>
      <rect x="2.5" y="6" width="13.5" height="12" rx="3" fill="currentColor" />
      <path d="M16 10.5l5.5-3.5v10l-5.5-3.5z" fill="currentColor" />
      {off && <path d="M3 3l18 18" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" />}
    </svg>
  );
}

/** Voice / video huddle for the room, on the Nexconn Call SDK. */
export function Huddle({
  roomId,
  meId,
  meAvatar,
  names,
  huddle,
  ready,
  toast,
  onChange,
}: {
  roomId: string;
  meId?: string;
  meAvatar?: string;
  names: Names;
  huddle: HuddleInfo;
  ready: boolean;
  toast: (t: string, tone?: "ink" | "red" | "mint") => void;
  onChange: () => void;
}) {
  const [joined, setJoined] = useState<string | null>(null);
  const [video, setVideo] = useState(false);
  const [mic, setMicOn] = useState(true);
  const [cam, setCamOn] = useState(true);
  const [people, setPeople] = useState<string[]>([]);
  const [levels, setLevels] = useState<Record<string, number>>({});
  const [camOff, setCamOff] = useState<Record<string, boolean>>({});
  const [incoming, setIncoming] = useState<{ callId: string; from: string; video: boolean } | null>(null);
  const [busy, setBusy] = useState(false);
  const localRef = useRef<HTMLVideoElement | null>(null);
  const bound = useRef(new Set<string>());

  useEffect(() => {
    setHuddleHandlers({
      onIncoming: (callId, from, v) => setIncoming({ callId, from, video: v }),
      onConnected: (callId) => setJoined(callId),
      onEnded: () => {
        setJoined(null);
        setPeople([]);
        bound.current.clear();
      },
      onPeople: setPeople,
      onVolume: setLevels,
      onRemoteCamera: (uid, on) => setCamOff((c) => ({ ...c, [uid]: !on })),
    });
  }, []);

  useEffect(() => {
    if (joined && video && localRef.current) void bindLocal(localRef.current);
  }, [joined, video]);

  const remoteRef = useCallback(
    (uid: string) => (el: HTMLVideoElement | null) => {
      if (el && !bound.current.has(uid)) {
        bound.current.add(uid);
        void bindRemote(uid, el);
      }
    },
    [],
  );

  async function start(v: boolean) {
    if (!ready || !meId) return toast("Still connecting to the room…");
    const others = Object.keys(names).filter((u) => u !== meId && !u.startsWith("bot_"));
    if (others.length === 0) return toast("Nobody else is here yet. Invite a friend, then start the huddle.", "red");
    setBusy(true);
    setVideo(v);
    const r = await startHuddle(others.slice(0, 15), v);
    if (!r.ok) {
      setBusy(false);
      return toast(`Couldn't start the huddle: ${r.error}`, "red");
    }
    setJoined(r.callId);
    await api(`/api/rooms/${roomId}/huddle`, { action: "start", callId: r.callId, media: v ? "video" : "voice" });
    setBusy(false);
    onChange();
  }

  async function join() {
    if (!huddle) return;
    setBusy(true);
    setVideo(huddle.media === "video");
    const r = await joinHuddle(huddle.callId);
    setBusy(false);
    if (!r.ok) return toast(`Couldn't join: ${r.error}`, "red");
    setJoined(huddle.callId);
  }

  async function accept() {
    if (!incoming) return;
    setVideo(incoming.video);
    const ok = await acceptHuddle(incoming.callId);
    if (ok) setJoined(incoming.callId);
    else toast("Couldn't pick up the huddle", "red");
    setIncoming(null);
  }

  async function leave() {
    const id = await leaveHuddle();
    setJoined(null);
    bound.current.clear();
    if (people.length === 0) await api(`/api/rooms/${roomId}/huddle`, { action: "end", callId: id ?? undefined });
    setPeople([]);
    onChange();
  }

  const talking = (uid: string) => (levels[uid] ?? 0) > 8;

  return (
    <section className="brut overflow-hidden rounded-[20px] bg-stage-2">
      <div className="flex items-center justify-between gap-2 border-b-2 border-ink bg-stage-3 px-4 py-2.5">
        <div className="flex items-center gap-2">
          <span className="grid h-8 w-8 place-items-center rounded-lg border-2 border-ink bg-orange text-ink">
            <MicIcon />
          </span>
          <p className="font-arcade text-lg">Huddle</p>
          {(joined || huddle) && <span className="live-dot" />}
        </div>
        <span className="font-led text-lg text-on-muted">{joined ? `${people.length + 1} ON CALL` : huddle ? "LIVE NOW" : "VOICE · VIDEO"}</span>
      </div>

      {/* incoming invite */}
      {incoming && !joined && (
        <div className="rise m-3 flex items-center gap-3 rounded-xl border-2 border-ink bg-yellow p-3 text-ink">
          <Avatar id={names[incoming.from]?.avatar} size={40} className="border-2 border-ink" />
          <p className="flex-1 text-sm font-bold">
            {names[incoming.from]?.name ?? "A friend"} is calling the room ({incoming.video ? "video" : "voice"})
          </p>
          <button className="key key-sm" onClick={accept}>
            Pick up
          </button>
          <button className="key key-paper key-sm" onClick={() => setIncoming(null)}>
            Later
          </button>
        </div>
      )}

      {joined ? (
        <div className="p-3">
          <div className={`grid gap-2 ${people.length + 1 > 2 ? "grid-cols-2" : "grid-cols-2"}`}>
            {/* me */}
            <Tile name="You" avatar={meAvatar} talking={!!meId && talking(meId)} muted={!mic}>
              {video && cam && <video ref={localRef} autoPlay playsInline muted className="h-full w-full scale-x-[-1] object-cover" />}
            </Tile>
            {people.map((uid) => (
              <Tile key={uid} name={names[uid]?.name ?? "Friend"} avatar={names[uid]?.avatar} talking={talking(uid)}>
                {video && !camOff[uid] && <video ref={remoteRef(uid)} autoPlay playsInline className="h-full w-full object-cover" />}
              </Tile>
            ))}
            {people.length === 0 && (
              <div className="grid aspect-[4/3] place-items-center rounded-xl border-2 border-dashed border-line p-2 text-center text-xs text-on-muted">
                Ringing the room…
              </div>
            )}
          </div>
          <div className="mt-3 flex items-center justify-center gap-2">
            <button
              className={`key key-sm ${mic ? "key-paper" : "key-red"}`}
              onClick={async () => {
                if (await setMic(!mic)) setMicOn(!mic);
              }}
              aria-label={mic ? "Mute mic" : "Unmute mic"}
            >
              <MicIcon off={!mic} />
            </button>
            {video && (
              <button
                className={`key key-sm ${cam ? "key-paper" : "key-red"}`}
                onClick={async () => {
                  if (await setCam(!cam)) setCamOn(!cam);
                }}
                aria-label={cam ? "Camera off" : "Camera on"}
              >
                <CamIcon off={!cam} />
              </button>
            )}
            <button className="key key-red key-sm" onClick={leave}>
              Leave
            </button>
          </div>
        </div>
      ) : huddle ? (
        <div className="flex items-center gap-3 p-3">
          <Avatar id={names[huddle.by]?.avatar} size={40} className="border-2 border-ink" />
          <p className="flex-1 text-sm">
            <b>{huddle.byName}</b> started a {huddle.media} huddle
          </p>
          <button className="key key-sm" disabled={busy || !ready} onClick={join}>
            {huddle.media === "video" ? <CamIcon /> : <MicIcon />} Join
          </button>
        </div>
      ) : (
        <div className="p-3">
          <p className="text-sm text-on-muted">Talk like you&apos;re on the same sofa. Everyone in the room gets the call.</p>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <button className="key key-sm" disabled={busy} onClick={() => start(false)}>
              <MicIcon /> Voice
            </button>
            <button className="key key-yellow key-sm" disabled={busy} onClick={() => start(true)}>
              <CamIcon /> Video
            </button>
          </div>
        </div>
      )}
    </section>
  );
}

function Tile({ name, avatar, talking, muted, children }: { name: string; avatar?: string; talking: boolean; muted?: boolean; children?: React.ReactNode }) {
  return (
    <div
      className={`relative grid aspect-[4/3] place-items-center overflow-hidden rounded-xl border-2 bg-night transition-shadow ${
        talking ? "border-lime shadow-[0_0_0_3px_var(--lime)]" : "border-ink"
      }`}
    >
      <Avatar id={avatar} size={56} className={`border-2 border-ink ${talking ? "scale-110" : ""} transition-transform`} />
      {children && <div className="absolute inset-0">{children}</div>}
      <span className="font-led absolute bottom-1 left-1.5 rounded bg-black/60 px-1.5 text-base text-paper">{name}</span>
      {muted && (
        <span className="absolute right-1.5 top-1.5 rounded bg-red px-1 text-white">
          <MicIcon off />
        </span>
      )}
      {talking && <Art src="b5/sparkle" className="absolute right-1 top-1 h-5 w-5" />}
    </div>
  );
}
