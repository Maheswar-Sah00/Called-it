"use client";

import type { ResultCard, Sport } from "@/lib/game";
import { Art } from "@/components/ui";

export type Celebrate = { key: string; result: ResultCard; pick: string | null; right: boolean; sport: Sport };

const OUTCOME_STICKER: Record<string, string> = {
  "6": "d2/six",
  W: "d2/out",
  goal: "d2/goal",
  home: "d2/goal",
  away: "d2/goal",
  clutch: "d2/clutch",
  "3": "d2/clutch",
  break: "d2/ace",
  super: "d2/clutch",
  smash: "d2/ace",
  yes: "d2/clutch",
};

const CONFETTI = ["#ffe45c", "#ff6fb5", "#3ddc97", "#b9a3ff", "#ff4d3d", "#2f55e4"];

/** Full-screen sticker moment when a result lands (after any spoiler delay). */
export function Celebration({ c }: { c: Celebrate }) {
  const sticker = c.right ? "d2/called-it" : c.pick ? "d2/so-close" : OUTCOME_STICKER[c.result.outcome] ?? "d2/locked";
  const outcomeSticker = OUTCOME_STICKER[c.result.outcome];
  return (
    <div key={c.key} className="pointer-events-none fixed inset-0 z-50 grid place-items-center">
      {c.right &&
        Array.from({ length: 44 }).map((_, i) => (
          <span
            key={i}
            className="absolute top-0 block h-3 w-2 rounded-[2px]"
            style={{
              left: `${(i * 37) % 100}%`,
              background: CONFETTI[i % CONFETTI.length],
              animation: `confetti-fall ${1.6 + (i % 7) * 0.18}s ${(i % 9) * 0.05}s cubic-bezier(.3,.6,.5,1) forwards`,
              border: "1.5px solid #111",
            }}
          />
        ))}
      <div className="pop-in flex flex-col items-center">
        {outcomeSticker && sticker !== outcomeSticker && <Art src={outcomeSticker} className="-mb-6 w-40 rotate-6 sm:w-52" />}
        <Art src={sticker} className="w-[19rem] drop-shadow-[8px_8px_0_rgba(0,0,0,.25)] sm:w-[26rem]" />
        <div className="brut -mt-4 flex items-center gap-3 rounded-full bg-paper px-5 py-2.5 text-ink">
          <Art src={c.right ? "b3/celebrate" : c.pick ? "b3/facepalm" : "b3/wave"} className="h-12 w-12" />
          <p className="font-display text-lg font-extrabold">
            {c.right ? `Called it! ${c.result.label}` : c.pick ? `So close. It was ${c.result.label}` : `${c.result.label}`}
          </p>
        </div>
      </div>
    </div>
  );
}
