"use client";

import { useEffect, useState } from "react";
import { Art, Avatar } from "./ui";

/** A self-playing scoreboard: calls open → tally fills → LOCKED → result. Loops through sports. */
const SCENES = [
  {
    sport: "CRICKET",
    bolo: "b4/cricket",
    line: "IND 168/6 · 19.2 OV",
    q: "NEXT BALL?",
    options: ["DOT", "1–3", "FOUR", "SIX", "WICKET"],
    votes: [1, 1, 2, 1, 0],
    pick: 2,
    result: 2,
    sticker: "d2/called-it",
    winners: ["facepaint", "gamer"],
  },
  {
    sport: "FOOTBALL",
    bolo: "b4/football",
    line: "ARS 1–1 TOT · 88'",
    q: "PENALTY?",
    options: ["SCORED", "SAVED", "MISSED"],
    votes: [3, 1, 1],
    pick: 1,
    result: 1,
    sticker: "d2/called-it",
    winners: ["grandma"],
  },
  {
    sport: "KABADDI",
    bolo: "b4/kabaddi",
    line: "PAT 31–29 BEN · LAST RAID",
    q: "THIS RAID?",
    options: ["POINT", "TACKLED", "EMPTY", "SUPER"],
    votes: [2, 2, 0, 1],
    pick: 0,
    result: 1,
    sticker: "d2/so-close",
    winners: ["chai-uncle", "driver"],
  },
];
const FACES = ["facepaint", "gamer", "grandma", "chai-uncle", "driver", "student"];
const CYCLE = 7200;

export function HeroScoreboard() {
  const [t, setT] = useState(0);
  const [i, setI] = useState(0);
  useEffect(() => {
    const start = Date.now();
    const id = setInterval(() => {
      const el = Date.now() - start;
      setI(Math.floor(el / CYCLE) % SCENES.length);
      setT(el % CYCLE);
    }, 80);
    return () => clearInterval(id);
  }, []);

  const s = SCENES[i];
  const phase = t < 4200 ? "open" : t < 5200 ? "locked" : "result";
  const left = Math.max(0, (4200 - t) / 1000);
  const fill = Math.min(1, t / 3600);
  const picked = t > 2200;
  const total = s.votes.reduce((a, b) => a + b, 0) + (picked ? 1 : 0);

  return (
    <div className="relative mx-auto mb-8 w-full max-w-[34rem] sm:mb-10">
      {/* stand legs */}
      <div className="absolute -bottom-10 left-[22%] h-12 w-4 border-2 border-ink bg-night-3" />
      <div className="absolute -bottom-10 right-[22%] h-12 w-4 border-2 border-ink bg-night-3" />

      <div className="led scanlines relative rounded-[22px] p-4 sm:p-5">
        {/* header row */}
        <div className="flex items-center justify-between gap-3">
          <span className="font-led led-text text-xl sm:text-2xl">{s.sport}</span>
          <span className="flex items-center gap-2 rounded-md border-2 border-red/70 px-2 py-0.5">
            <span className="live-dot" />
            <span className="font-led text-lg text-red">LIVE</span>
          </span>
        </div>
        <div className="mt-1 flex items-end justify-between gap-3">
          <div className="min-w-0">
            <p className="font-led truncate text-lg text-paper/70 sm:text-xl">{s.line}</p>
            <p className="font-arcade mt-1 text-3xl text-paper sm:text-4xl">{s.q}</p>
          </div>
          <Art key={s.bolo + phase} src={phase === "locked" ? "b3/locked" : phase === "result" ? (s.pick === s.result ? "b3/celebrate" : "b3/facepalm") : s.bolo} className="pop-in -mb-1 h-20 w-20 shrink-0 sm:h-24 sm:w-24" />
        </div>

        {/* lock fuse */}
        <div className="mt-3 flex items-center gap-2">
          <span className="font-led text-lg text-paper/60">LOCKS IN</span>
          <div className="flex flex-1 gap-[3px]">
            {Array.from({ length: 20 }).map((_, k) => (
              <span
                key={k}
                className={`h-3 flex-1 rounded-[2px] ${k / 20 < left / 4.2 ? (left < 1.2 ? "bg-red" : "bg-yellow") : "bg-white/10"}`}
              />
            ))}
          </div>
          <span className="font-led led-text w-12 text-right text-xl">{left.toFixed(1)}</span>
        </div>

        {/* options */}
        <div className={`mt-4 grid gap-2.5 ${s.options.length > 4 ? "grid-cols-3" : "grid-cols-2"}`}>
          {s.options.map((o, k) => {
            const v = s.votes[k] + (picked && k === s.pick ? 1 : 0);
            const isPick = picked && k === s.pick;
            const isResult = phase === "result" && k === s.result;
            return (
              <div
                key={o}
                className={`relative overflow-hidden rounded-xl border-2 border-ink px-3 py-2 transition-all duration-300 ${
                  isResult ? "bg-lime text-ink" : isPick ? "bg-orange text-ink" : "bg-night-3 text-paper"
                } ${phase !== "open" && !isResult && !isPick ? "opacity-40" : ""}`}
                style={{ boxShadow: isPick || isResult ? "0 2px 0 var(--shadow)" : "0 4px 0 var(--shadow)", transform: isPick ? "translateY(2px)" : undefined }}
              >
                <div
                  className="absolute inset-y-0 left-0 bg-white/15 transition-[width] duration-700"
                  style={{ width: `${total ? (v / Math.max(total, 1)) * 100 * fill : 0}%` }}
                />
                <div className="relative flex items-center justify-between gap-1">
                  <span className="font-arcade text-sm sm:text-base">{o}</span>
                  <span className="flex -space-x-2">
                    {Array.from({ length: Math.min(v, 3) }).map((_, f) =>
                      isPick && f === 0 ? (
                        <span key={f} className="grid h-6 w-6 place-items-center rounded-full border border-ink bg-yellow text-[9px] font-black text-ink">
                          YOU
                        </span>
                      ) : (
                        <Avatar key={f} id={FACES[(k * 2 + f) % FACES.length]} size={20} className="border border-ink" />
                      ),
                    )}
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        {/* footer line */}
        <div className="mt-4 flex items-center justify-between border-t-2 border-dashed border-white/10 pt-3">
          <span className="font-led text-lg text-paper/70">
            {phase === "open" ? `${total} CALLS IN` : phase === "locked" ? "CALLS CLOSED · SERVER CLOCK" : `${s.options[s.result]} · ${s.winners.length + (s.pick === s.result ? 1 : 0)} CALLED IT`}
          </span>
          <span className="flex -space-x-2">
            {s.winners.map((w) => (
              <Avatar key={w} id={w} size={24} className="border-2 border-ink" />
            ))}
          </span>
        </div>

        {/* overlays */}
        {phase === "locked" && (
          <div className="pointer-events-none absolute inset-0 grid place-items-center">
            <span className="stamp font-arcade inline-flex items-center gap-2 rounded-2xl border-[3px] border-ink bg-red px-4 py-2 text-3xl text-white shadow-[5px_5px_0_var(--shadow)] sm:text-4xl"><Art src="b2/lock" className="h-9 w-9 sm:h-11 sm:w-11" /> LOCKED</span>
          </div>
        )}
        {phase === "result" && (
          <div className="pointer-events-none absolute inset-0 grid place-items-center">
            <Art key={i} src={s.sticker} className="pop-in w-48 drop-shadow-[6px_6px_0_rgba(0,0,0,.4)] sm:w-72" />
          </div>
        )}
      </div>

      {/* tap cursor */}
      {phase === "open" && t > 1500 && t < 2600 && (
        <Art src="b2/foam-finger" className="pop-in pointer-events-none absolute left-[44%] top-[58%] z-10 w-11 rotate-[-18deg] sm:w-14" />
      )}
    </div>
  );
}
