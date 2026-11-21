"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { api, useSession } from "@/lib/client/session";
import { JoinSheet } from "@/components/JoinSheet";
import { Art, Brand, Pitch, Wordmark } from "@/components/ui";
import { ThemeToggle } from "@/components/Theme";

/** Judge demo: one tap → a replay room of the 2024 T20 World Cup final with labelled bots. */
export default function Try() {
  const router = useRouter();
  const { info, join, error: sessionError } = useSession();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const started = useRef(false);

  async function go() {
    if (started.current) return;
    started.current = true;
    setBusy(true);
    const r = await api<{ room: { id: string } }>("/api/rooms", { mode: "replay", demo: true });
    if (!r.ok) {
      setErr(r.data.error ?? "Could not start the demo");
      setBusy(false);
      started.current = false;
      return;
    }
    router.replace(`/r/${r.data.room.id}`);
  }

  useEffect(() => {
    if (info?.session) void go();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [info?.session]);

  return (
    <main className="flood relative min-h-screen overflow-hidden">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 pt-5">
        <Brand />
        <ThemeToggle />
      </div>
      {/* phones: say what this is before the card */}
      <div className="relative z-10 mx-auto max-w-5xl px-4 pt-4 md:hidden">
        <p className="font-led text-lg leading-tight text-orange">REPLAY · T20 WORLD CUP FINAL 2024</p>
        <h1 className="font-display mt-1 text-[1.7rem] font-extrabold leading-tight">The 60-second demo</h1>
        <p className="mt-1 text-sm text-on-muted">South Africa need 30 off 30. Call every ball before it&apos;s bowled.</p>
      </div>
      <div className="relative z-10 mx-auto grid max-w-5xl items-center gap-8 px-4 pb-40 pt-4 md:grid-cols-2 md:gap-10 md:pt-10">
        <div>
          <p className="font-led text-2xl text-orange max-md:hidden">REPLAY · T20 WORLD CUP FINAL 2024</p>
          <Wordmark size="text-5xl sm:text-7xl" className="mt-2 max-md:hidden" />
          <h1 className="font-display mt-6 text-3xl font-extrabold max-md:hidden">The 60-second demo</h1>
          <p className="font-display text-xl font-extrabold md:hidden">How it plays</p>
          <p className="mt-3 text-on-muted max-md:text-sm">
            Replay the last five overs of the <b>2024 T20 World Cup final</b>, ball by ball, from real Cricsheet data. South Africa
            need 30 off 30. Call every ball before it&apos;s bowled. Five demo friends (marked BOT) call with you.
          </p>
          <ul className="mt-5 flex flex-col gap-2.5 text-sm font-semibold">
            {[
              ["b2/stopwatch", "Calls lock on the server clock: try tapping late"],
              ["b2/replay", "Wickets go to the third umpire before points land"],
              ["b2/trophy", "The table, streaks and banter update live"],
            ].map(([a, t]) => (
              <li key={t} className="flex items-center gap-2.5">
                <Art src={a} className="h-8 w-8" /> {t}
              </li>
            ))}
          </ul>
        </div>
        <div className="brut-lg rounded-3xl bg-paper p-5 text-ink max-md:order-first sm:p-6">
          {(info === null && !sessionError) || busy || info?.session ? (
            <div className="grid place-items-center py-6 text-center sm:py-10">
              <Art src="b4/cricket" className="floaty w-28 sm:w-40" />
              <p className="font-display mt-4 text-xl font-extrabold">{err ?? "Walking out to the middle…"}</p>
              {err && (
                <button className="key mt-4" onClick={() => go()}>
                  Try again
                </button>
              )}
            </div>
          ) : (
            <JoinSheet
              title="Who's calling?"
              cta="Start the replay"
              error={err}
              busy={busy}
              onJoin={async (n, a) => {
                setBusy(true);
                try {
                  await join(n, a, true);
                } catch (e) {
                  setErr((e as Error).message);
                  setBusy(false);
                }
              }}
            />
          )}
        </div>
      </div>
      <Pitch className="absolute inset-x-0 bottom-0 h-28" />
    </main>
  );
}
