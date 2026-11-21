"use client";

import { useState } from "react";
import { AVATARS } from "@/lib/game";
import { Art, Avatar } from "./ui";

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
  const valid = name.trim().length >= 1;
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (valid && !busy) onJoin(name.trim(), avatar);
      }}
    >
      <div className="flex items-center gap-3">
        <Art src="b3/wave" className="h-16 w-16" />
        <div>
          <h2 className="font-display text-2xl font-extrabold">{title}</h2>
          <p className="text-sm text-muted">A nickname is all we need. No sign-up.</p>
        </div>
      </div>
      <label className="mt-5 block text-xs font-bold uppercase tracking-wider">Nickname</label>
      <input
        autoFocus
        className="input mt-1.5"
        placeholder="e.g. Ashik"
        maxLength={24}
        value={name}
        onChange={(e) => setName(e.target.value)}
      />
      <label className="mt-5 block text-xs font-bold uppercase tracking-wider">Pick your face</label>
      <div className="mt-2 grid grid-cols-6 gap-2">
        {AVATARS.map((a) => (
          <button
            type="button"
            key={a}
            onClick={() => setAvatar(a)}
            className={`rounded-full transition-transform hover:-translate-y-1 hover:scale-110 ${avatar === a ? "scale-110" : "opacity-80"}`}
            aria-label={a}
            aria-pressed={avatar === a}
          >
            <Avatar id={a} size={48} ring={avatar === a} />
          </button>
        ))}
      </div>
      {error && <p className="mt-4 rounded-xl border-2 border-ink bg-k-rose px-3 py-2 text-sm font-semibold">{error}</p>}
      <button className="key mt-6 w-full text-lg" disabled={!valid || busy}>
        {busy ? "Joining…" : cta}
      </button>
    </form>
  );
}
