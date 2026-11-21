"use client";

import type { ResultCard, Sport } from "@/lib/game";
import { Art } from "@/components/ui";

export type Celebrate = { key: string; result: ResultCard; pick: string | null; right: boolean; sport: Sport; points?: number };

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

const CONFETTI = ["var(--orange)", "var(--pink)", "var(--lime)", "var(--yellow)", "var(--red)", "var(--paper)"];

/**
 * Sticker moment when a result lands (after any spoiler delay).
 * It never blocks play: taps pass through everywhere except the result pill, which closes it.
 * Phones: it sits in the upper half and stays small so the keys and the tab bar stay visible.
 */
export function Celebration({ c, onClose }: { c: Celebrate; onClose?: () => void }) {
  // no call and no outcome sticker: just the small result pill (never a misleading "LOCKED" sticker)
  const sticker = c.right ? "d2/called-it" : c.pick ? "d2/so-close" : OUTCOME_STICKER[c.result.outcome] ?? null;
  const outcomeSticker = OUTCOME_STICKER[c.result.outcome];
  return (
    <div key={c.key} className="pointer-events-none fixed inset-0 z-50 flex items-start justify-center pt-[16vh] sm:items-center sm:pt-0" aria-live="polite">
      {c.right &&
        Array.from({ length: 36 }).map((_, i) => (
          <span
            key={i}
            className="ra-confetti absolute top-0 block h-3 w-2 rounded-[2px]"
            style={{
              left: `${(i * 37) % 100}%`,
              background: CONFETTI[i % CONFETTI.length],
              animation: `confetti-fall ${1.6 + (i % 7) * 0.18}s ${(i % 9) * 0.05}s cubic-bezier(.3,.6,.5,1) forwards`,
              border: "1.5px solid var(--ink)",
            }}
          />
        ))}
      <div className="pop-in flex max-w-[calc(100vw-2rem)] flex-col items-center">
        {outcomeSticker && sticker !== outcomeSticker && <Art src={outcomeSticker} className="-mb-4 w-24 rotate-6 sm:-mb-6 sm:w-52" />}
        {sticker && <Art src={sticker} className={`drop-shadow-[6px_6px_0_rgba(0,0,0,.25)] ${c.pick ? "w-[13.5rem] sm:w-[26rem]" : "w-40 sm:w-72"}`} />}
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className={`brut pointer-events-auto ${sticker ? "-mt-3 sm:-mt-4" : ""} flex max-w-full items-center gap-2.5 rounded-full bg-paper py-2 pl-2.5 pr-4 text-ink sm:gap-3 sm:px-5 sm:py-2.5`}
        >
          <Art src={c.right ? "b3/celebrate" : c.pick ? "b3/facepalm" : "b3/wave"} className="h-10 w-10 shrink-0 sm:h-12 sm:w-12" />
          <span className="min-w-0 text-left">
            <span className="font-display block truncate text-base font-extrabold leading-tight sm:text-lg">
              {c.right ? `Called it! ${c.result.label}` : c.pick ? `So close. It was ${c.result.label}` : `It was ${c.result.label}`}
            </span>
            {c.right && c.points ? (
              <span className="font-led ra-points block text-xl leading-none text-orange-d">+{c.points} PTS</span>
            ) : (
              <span className="block text-[11px] font-bold text-muted">{c.pick ? "Next one's yours · tap to close" : "No call from you · tap to close"}</span>
            )}
          </span>
        </button>
      </div>
    </div>
  );
}
