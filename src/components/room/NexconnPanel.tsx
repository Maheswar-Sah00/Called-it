"use client";

import { useEffect, useState } from "react";
import { onLogs, type LogLine } from "@/lib/client/live";
import { Art } from "@/components/ui";

const FEATURES = [
  { k: "Open channels", d: "Each match room is a Nexconn open channel, built for live crowds" },
  { k: "Custom message types", d: "CI:Moment, CI:Lock, CI:Result cards, registered before connect" },
  { k: "High-priority messages", d: "Lock and result cards cut through the chatter (priority 2)" },
  { k: "Channel metadata", d: "Room phase and score mirrored so late joiners catch up at once" },
  { k: "Participant events", d: "Live head count from onParticipantChanged" },
  { k: "Pre-messaging webhook", d: "Betting spam and forged cards are refused before delivery" },
  { k: "Mute", d: "The host can mute a participant in the room" },
  { k: "Server API", d: "Signed calls with failover to the backup domain" },
];

/** "Nexconn inside": what the SDK is doing, live. */
export function NexconnPanel({
  stats,
  people,
  live,
  channelId,
}: {
  stats: { cards: number; chats: number; forged: number; blocked: number };
  people: number | null;
  live: "connecting" | "live" | "offline";
  channelId?: string;
}) {
  const [open, setOpen] = useState(false);
  const [logs, setLogs] = useState<LogLine[]>([]);
  useEffect(() => onLogs(setLogs), []);

  return (
    <>
      <button
        onClick={() => setOpen(!open)}
        className="brut-sm fixed bottom-4 left-4 z-40 max-lg:bottom-[5.6rem] flex items-center gap-2 rounded-full bg-night px-4 py-2 text-xs font-bold text-white transition-transform hover:-translate-y-1"
      >
        <span className={`h-2.5 w-2.5 rounded-full ${live === "live" ? "bg-lime" : "bg-[#888]"}`} />
        <span className="hidden sm:inline">Nexconn inside</span>
        <span className="sm:hidden">N</span>
      </button>
      <aside
        className={`fixed bottom-16 left-4 z-40 max-lg:bottom-[8.6rem] w-[min(26rem,calc(100vw-2rem))] origin-bottom-left transition-all duration-300 ${
          open ? "scale-100 opacity-100" : "pointer-events-none scale-90 opacity-0"
        }`}
      >
        <div className="brut-lg max-h-[70vh] overflow-y-auto rounded-3xl bg-night p-5 text-white scroll-thin">
          <div className="flex items-center gap-2">
            <Art src="b2/scoreboard" className="h-9 w-9" />
            <div>
              <p className="font-display text-lg font-extrabold">Nexconn inside</p>
              <p className="font-mono text-[11px] text-white/60">{channelId ?? "…"}</p>
            </div>
          </div>
          <div className="mt-4 grid grid-cols-4 gap-2 text-center">
            {[
              ["in room", people ?? "–"],
              ["cards", stats.cards],
              ["chats", stats.chats],
              ["blocked", stats.blocked + stats.forged],
            ].map(([k, v]) => (
              <div key={k} className="rounded-xl border-2 border-white/20 bg-paper/5 p-2">
                <p className="font-display text-xl font-extrabold text-yellow">{v}</p>
                <p className="text-[10px] uppercase tracking-wider text-white/60">{k}</p>
              </div>
            ))}
          </div>
          <p className="mt-4 text-[11px] font-bold uppercase tracking-wider text-white/60">Live SDK log</p>
          <div className="mt-2 flex flex-col gap-1 font-mono text-[11px]">
            {logs.length === 0 && <p className="text-white/50">Waiting for the first event…</p>}
            {logs.slice(0, 14).map((l, i) => (
              <p key={l.at + l.api + i} className="truncate">
                <span className="text-mint">{l.api}</span> <span className="text-white/70">{l.detail}</span>
                {l.ms !== undefined && <span className="text-yellow"> · {l.ms}ms</span>}
              </p>
            ))}
          </div>
          <p className="mt-4 text-[11px] font-bold uppercase tracking-wider text-white/60">Features in use</p>
          <ul className="mt-2 flex flex-col gap-1.5 text-xs">
            {FEATURES.map((f) => (
              <li key={f.k}>
                <span className="font-bold text-yellow">✓ {f.k}</span> <span className="text-white/70">· {f.d}</span>
              </li>
            ))}
          </ul>
        </div>
      </aside>
    </>
  );
}
