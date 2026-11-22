"use client";

import { useRef, useState } from "react";
import { AVATARS } from "@/lib/game";
import { Art, Avatar } from "./ui";

/** Same cleaning as the server: no control or invisible format characters, 24 whole characters. */
export function cleanNick(n: string) {
  return Array.from(n.replace(/[\p{Cc}\p{Cf}<>]/gu, "").replace(/\s+/g, " ").trim())
    .slice(0, 24)
    .join("")
    .trim();
}

/** Nickname + avatar. No sign-up, no email. */
export function JoinSheet({
  title = "Who's calling?",
  cta = "Let's go",
  onJoin,
  busy,
  error,
}: {
  title?: string;
  cta?: string;
  onJoin: (name: string, avatar: string) => void;
  busy?: boolean;
  error?: string | null;
}) {
  const [name, setName] = useState("");
  const [avatar, setAvatar] = useState<string>(AVATARS[0]);
  const clean = cleanNick(name);
  const valid = clean.length >= 1;
  // in-flight guard: React state lags a fast double tap, a ref doesn't
  const sending = useRef(false);
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (!valid || busy || sending.current) return;
        sending.current = true;
        setTimeout(() => (sending.current = false), 1500);
        onJoin(clean, avatar);
      }}
    >
      <div className="flex items-center gap-3 pr-12">
        <Art key={avatar} src={`c1/${avatar}`} className="pop-in h-14 w-14 shrink-0 rounded-full border-[2.5px] border-ink bg-k-sand sm:h-16 sm:w-16" />
        <div className="min-w-0">
          <h2 className="font-display text-2xl font-extrabold leading-tight">{title}</h2>
          <p className="text-sm text-muted">A nickname is all we need. No sign-up.</p>
        </div>
      </div>
      <label htmlFor="join-nick" className="mt-5 block text-xs font-bold uppercase tracking-wider">
        Nickname
      </label>
      <input
        id="join-nick"
        autoFocus={typeof window !== "undefined" && window.matchMedia?.("(pointer: fine)").matches}
        className="input mt-1.5 text-base"
        placeholder="e.g. Ashik"
        maxLength={24}
        autoComplete="nickname"
        enterKeyHint="go"
        value={name}
        onChange={(e) => setName(e.target.value)}
      />
      <p className="mt-5 text-xs font-bold uppercase tracking-wider">Pick your face</p>
      <div className="mt-2 grid grid-cols-6 gap-1.5 sm:gap-2" role="radiogroup" aria-label="Pick your face">
        {AVATARS.map((a) => (
          <button
            type="button"
            key={a}
            onClick={() => setAvatar(a)}
            className={`grid aspect-square min-h-11 place-items-center rounded-full transition-transform duration-150 active:scale-95 ${
              avatar === a ? "scale-105" : "opacity-75 hover:opacity-100"
            }`}
            aria-label={a.replace("-", " ")}
            role="radio"
            aria-checked={avatar === a}
          >
            <Avatar id={a} size={44} ring={avatar === a} className="h-auto! w-full! max-w-12 bg-k-sand" />
          </button>
        ))}
      </div>
      {error && <p className="mt-4 rounded-xl border-2 border-ink bg-k-rose px-3 py-2 text-sm font-semibold">{error}</p>}
      <button className="key mt-6 min-h-14 w-full text-lg" disabled={!valid || busy}>
        {busy ? "Joining…" : cta}
      </button>
    </form>
  );
}
