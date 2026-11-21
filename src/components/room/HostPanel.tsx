"use client";

import { useEffect, useState } from "react";
import { PRESETS, SPORT_ART, type RoomState, type Sport } from "@/lib/game";
import { api } from "@/lib/client/session";
import { Art } from "@/components/ui";
import { HOST_SCORE_KEY } from "./HostBar";

const TIMERS = [0, 10, 20, 30, 60];

/** Host controls: ask → Go → Lock → (Review) → Result. */
export function HostPanel({
  id,
  sport,
  st,
  onDone,
  toast,
}: {
  id: string;
  sport: Sport;
  st: RoomState;
  onDone: () => void;
  toast: (t: string, tone?: "ink" | "red" | "mint") => void;
}) {
  const presets = PRESETS[sport] ?? PRESETS.other;
  const [preset, setPreset] = useState<string>(presets[0]?.key ?? "custom");
  const [q, setQ] = useState("");
  const [labels, setLabels] = useState(["", "", "", ""]);
  const [secs, setSecs] = useState(0);
  const [score, setScore] = useState(st.scoreline ?? "");
  const [detail, setDetail] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const m = st.moment;
  const live = m && m.state !== "settled";

  // the phone bar sends the score line with its actions
  useEffect(() => {
    try {
      sessionStorage.setItem(`${HOST_SCORE_KEY}:${id}`, score);
    } catch {
      /* private mode */
    }
  }, [id, score]);

  async function invite() {
    const url = `${location.origin}/r/${id}`;
    if (navigator.share) {
      try {
        await navigator.share({ title: "Called It", text: `Come call ${st.room.name} with us on Called It`, url });
        return;
      } catch {
        /* copy instead */
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      toast("Room link copied. Send it to your group.", "mint");
    } catch {
      toast(url);
    }
  }

  async function act(action: string, extra: Record<string, unknown> = {}) {
    setBusy(action);
    const r = await api(`/api/rooms/${id}/host`, { action, scoreline: score || undefined, ...extra });
    setBusy(null);
    if (!r.ok) toast((r.data as { error?: string }).error ?? "That didn't work", "red");
    onDone();
    return r.ok;
  }

  return (
    <section className="brut-lg rounded-[24px] bg-paper p-4 text-ink sm:p-6">
      <div className="flex items-center gap-3">
        <Art src={SPORT_ART[sport].official} className="h-12 w-12 shrink-0 sm:h-16 sm:w-16" />
        <div className="min-w-0">
          <h3 className="font-display text-xl font-extrabold sm:text-2xl">Host controls</h3>
          <p className="text-sm text-muted">You ask, you lock, you call the result. The server keeps everyone honest.</p>
        </div>
      </div>

      {/* phones: the pinned bar runs the moment; this card explains it and holds the extras */}
      <div className="mt-4 grid gap-3 lg:hidden">
        <ol className="grid grid-cols-3 gap-1.5 text-center text-xs font-bold">
          {(
            [
              ["b2/megaphone", "1 · Ask", "Pick a question, tap Go"],
              ["b2/lock", "2 · Lock", "The second it happens"],
              ["b2/check", "3 · Call it", "Tap what happened"],
            ] as const
          ).map(([a, t, d]) => (
            <li key={t} className="rounded-xl border-2 border-ink/20 bg-cream/60 px-1 py-2">
              <Art src={a} className="mx-auto h-8 w-8" />
              <p className="mt-1 font-extrabold">{t}</p>
              <p className="mt-0.5 font-semibold leading-tight text-muted">{d}</p>
            </li>
          ))}
        </ol>
        <label className="grid gap-1 text-xs font-bold uppercase tracking-wider">
          Score line (optional, sent with your next tap)
          <input className="input !min-h-11 !py-2 text-[16px] normal-case tracking-normal" placeholder="e.g. IND 182/4 · 18.2 ov" value={score} maxLength={60} onChange={(e) => setScore(e.target.value)} />
        </label>
        <button className="key key-paper !min-h-12 w-full" onClick={invite}>
          <Art src="b2/foam-finger" className="h-6 w-6" /> Invite friends to this room
        </button>
        <p className="text-xs text-muted">To mute someone, open the Table tab and tap Mute next to their name.</p>
      </div>

      {!live ? (
        <div className="rise mt-5 max-lg:hidden">
          <p className="text-xs font-bold uppercase tracking-wider">1 · Pick the moment</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {presets.map((p) => (
              <button key={p.key} className="chip" data-on={preset === p.key} onClick={() => setPreset(p.key)}>
                {p.q}
              </button>
            ))}
            <button className="chip" data-on={preset === "custom"} onClick={() => setPreset("custom")}>
              Write my own
            </button>
          </div>
          {preset === "custom" && (
            <div className="rise mt-3 grid gap-2">
              {(!q.trim() || labels.filter((l) => l.trim()).length < 2) && (
                <p className="text-xs font-bold text-orange-d">Write the question and at least two answers.</p>
              )}
              <input className="input" placeholder="Your question, e.g. Does Kohli reach 50?" value={q} maxLength={80} onChange={(e) => setQ(e.target.value)} />
              <div className="grid grid-cols-2 gap-2">
                {labels.map((l, i) => (
                  <input
                    key={i}
                    className="input !py-2 text-sm"
                    placeholder={i < 2 ? `Answer ${i + 1}` : `Answer ${i + 1} (optional)`}
                    value={l}
                    maxLength={24}
                    onChange={(e) => setLabels(labels.map((x, j) => (j === i ? e.target.value : x)))}
                  />
                ))}
              </div>
            </div>
          )}
          <p className="mt-5 text-xs font-bold uppercase tracking-wider">2 · How does it lock?</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {TIMERS.map((t) => (
              <button key={t} className="chip" data-on={secs === t} onClick={() => setSecs(t)}>
                {t ? `Auto in ${t}s` : "I tap Lock"}
              </button>
            ))}
          </div>
          <p className="mt-5 text-xs font-bold uppercase tracking-wider">Score line (optional)</p>
          <input className="input mt-2 !py-2 text-sm" placeholder="e.g. IND 182/4 · 18.2 ov" value={score} maxLength={60} onChange={(e) => setScore(e.target.value)} />
          <button
            className="key mt-5 w-full text-lg"
            disabled={!!busy || (preset === "custom" && (!q.trim() || labels.filter((l) => l.trim()).length < 2))}
            onClick={() =>
              act("open", preset === "custom" ? { q, labels, seconds: secs } : { preset, seconds: secs })
            }
          >
            {busy === "open" ? "Opening…" : "Go: open calls"}
          </button>
        </div>
      ) : (
        <div className="rise mt-5 flex flex-col gap-4 max-lg:hidden">
          {m.state === "open" && (
            <button
              className="key w-full !bg-red py-5 text-2xl text-white"
              disabled={!!busy}
              onClick={() => act("lock")}
            >
              <Art src="b2/lock" className="h-9 w-9" /> {busy === "lock" ? "Locking…" : "LOCK NOW"}
            </button>
          )}
          <div>
            <p className="text-xs font-bold uppercase tracking-wider">
              {m.state === "open" ? "Or call the result straight away" : "What happened?"}
            </p>
            <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
              {m.options.map((o) => (
                <button key={o.id} className="key key-paper" disabled={!!busy} onClick={() => act("result", { outcome: o.id, detail: detail || undefined })}>
                  {o.label}
                </button>
              ))}
            </div>
            <input className="input mt-2 !py-2 text-sm" placeholder="One-line detail (optional), e.g. Edged to slip" value={detail} maxLength={80} onChange={(e) => setDetail(e.target.value)} />
            <input className="input mt-2 !py-2 text-sm" placeholder="Update the score line" value={score} maxLength={60} onChange={(e) => setScore(e.target.value)} />
          </div>
          {m.state !== "pending" && (
            <button className="key key-paper w-full" disabled={!!busy} onClick={() => act("pending", { reason: sport === "football" ? "VAR check" : sport === "cricket" ? "DRS review" : "Under review" })}>
              <Art src="b2/replay" className="h-6 w-6" /> Hold points: it&apos;s under review
            </button>
          )}
        </div>
      )}
    </section>
  );
}
