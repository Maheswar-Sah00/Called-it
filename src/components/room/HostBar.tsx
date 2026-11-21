"use client";

import { useEffect, useRef, useState } from "react";
import { PRESETS, type RoomState, type Sport } from "@/lib/game";
import { Art } from "@/components/ui";

const SECS_KEY = "ci-host-secs";
/** HostPanel writes the score line here so the bar can send it with every action. */
export const HOST_SCORE_KEY = "ci-host-score";
const TIMERS = [0, 10, 20, 30];
type Phase = "idle" | "open" | "locked" | "pending";
type Opt = "open" | "locked" | "pending" | "settled" | null;

/** POST with a timeout, so a dropped connection can never leave a button stuck on "Opening…". */
async function post(path: string, body: unknown, ms = 25000) {
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), ms);
  try {
    const res = await fetch(path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      cache: "no-store",
      signal: ac.signal,
    });
    const data = (await res.json().catch(() => ({}))) as { error?: string };
    return { ok: res.ok, status: res.status, data };
  } catch {
    return { ok: false, status: 0, data: { error: "No connection. Tap again." } };
  } finally {
    clearTimeout(t);
  }
}

function buzz(p: number | number[]) {
  try {
    navigator.vibrate?.(p);
  } catch {
    /* not supported */
  }
}

/**
 * The host's thumb zone, pinned above the tab bar on phones.
 * 1 Ask (pick + Go) → 2 Lock → 3 Call it (tap what happened). Compact: never more than ~30% of the screen.
 * Every tap flips the bar at once (local phase), then the server confirms or it rolls back with a toast.
 */
export function HostBar({
  id,
  sport,
  st,
  onDone,
  onOptimistic,
  toast,
}: {
  id: string;
  sport: Sport;
  st: RoomState;
  onDone: () => void;
  onOptimistic: (state: Opt) => void;
  toast: (t: string, tone?: "ink" | "red" | "mint") => void;
}) {
  const presets = PRESETS[sport] ?? PRESETS.other;
  const [preset, setPreset] = useState(presets[0]?.key ?? "custom");
  const [secs, setSecs] = useState(0);
  const [busy, setBusy] = useState<string | null>(null);
  const [retrying, setRetrying] = useState(false);
  /** the server is taking a while: say so instead of looking frozen */
  const [slow, setSlow] = useState(false);
  /** the phase we just asked for, shown before the server answers */
  const [local, setLocal] = useState<Phase | null>(null);
  const [q, setQ] = useState("");
  const [labels, setLabels] = useState(["", ""]);
  const [kb, setKb] = useState(0);
  const [now, setNow] = useState(() => Date.now());
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    try {
      const v = Number(localStorage.getItem(SECS_KEY));
      if (TIMERS.includes(v)) setSecs(v);
    } catch {
      /* private mode */
    }
  }, []);

  // publish the bar's height so the page can pad under it and toasts can sit above it
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const root = document.documentElement;
    const set = () => root.style.setProperty("--hostbar-h", `${Math.round(el.getBoundingClientRect().height)}px`);
    set();
    const ro = new ResizeObserver(set);
    ro.observe(el);
    return () => {
      ro.disconnect();
      root.style.removeProperty("--hostbar-h");
    };
  }, []);

  // phone keyboard: ride on top of it instead of hiding behind it
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const on = () => {
      const gap = window.innerHeight - (vv.height + vv.offsetTop);
      setKb(gap > 120 ? gap : 0);
    };
    vv.addEventListener("resize", on);
    vv.addEventListener("scroll", on);
    return () => {
      vv.removeEventListener("resize", on);
      vv.removeEventListener("scroll", on);
    };
  }, []);

  const m = st.moment;
  const server: Phase = !m || m.state === "settled" ? "idle" : m.state;
  // drop the local guess as soon as the server agrees (or moves on)
  useEffect(() => {
    if (local && local === server) setLocal(null);
  }, [local, server]);
  const phase = local ?? server;

  const lockAt = phase === "open" && m?.state === "open" ? m.lockAt : null;
  useEffect(() => {
    if (!lockAt) return;
    const t = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(t);
  }, [lockAt]);
  const left = lockAt ? Math.max(0, Math.ceil((lockAt - now) / 1000)) : null;

  const tally = m && st.tally?.mid === m.mid ? st.tally : null;
  const players = Object.keys(st.names ?? {}).filter((u) => u !== st.room.hostId && !u.startsWith("bot_")).length;
  const settled = m?.state === "settled" && st.lastResult?.mid === m.mid ? st.lastResult : null;
  const customOk = q.trim().length > 0 && labels.filter((l) => l.trim()).length >= 2;

  async function act(action: string, extra: Record<string, unknown>, optimistic: Opt, next: Phase | null) {
    if (busy === action) return;
    setBusy(action);
    buzz(action === "lock" ? [20, 40, 20] : 15);
    if (next) setLocal(next);
    if (optimistic) onOptimistic(optimistic);
    let scoreline: string | undefined;
    try {
      scoreline = sessionStorage.getItem(`${HOST_SCORE_KEY}:${id}`) || undefined;
    } catch {
      /* ignore */
    }
    const body = { action, scoreline, ...extra };
    const slowT = setTimeout(() => setSlow(true), 2500);
    // the server runs one host action at a time; if the previous one is still finishing, retry briefly
    let r = await post(`/api/rooms/${id}/host`, body);
    for (let i = 0; i < 8 && r.status === 409; i++) {
      setRetrying(true);
      await new Promise((res) => setTimeout(res, 400));
      r = await post(`/api/rooms/${id}/host`, body);
    }
    clearTimeout(slowT);
    setSlow(false);
    setRetrying(false);
    setBusy((b) => (b === action ? null : b));
    if (!r.ok) {
      setLocal(null);
      onOptimistic(null); // roll back to the server's truth
      buzz([60, 40, 60]);
      toast(r.data.error ?? "That didn't go through", "red");
    } else {
      // if the server skips past the phase we guessed (auto-lock), stop guessing
      setTimeout(() => setLocal((l) => (l === next ? null : l)), 4000);
    }
    if (r.ok && action === "open" && preset === "custom") {
      setQ("");
      setLabels(["", ""]);
      setPreset(presets[0]?.key ?? "custom");
    }
    onDone();
  }

  function cycleTimer() {
    const next = TIMERS[(TIMERS.indexOf(secs) + 1) % TIMERS.length];
    setSecs(next);
    buzz(8);
    try {
      localStorage.setItem(SECS_KEY, String(next));
    } catch {
      /* ignore */
    }
  }

  async function invite() {
    const url = `${location.origin}/r/${id}`;
    if (navigator.share) {
      try {
        await navigator.share({ title: "Called It", text: `Come call ${st.room.name} with us on Called It`, url });
        return;
      } catch {
        /* cancelled or blocked: copy instead */
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      toast("Room link copied. Send it to your group.", "mint");
    } catch {
      toast(url);
    }
  }

  const step = phase === "idle" ? 1 : phase === "open" ? 2 : 3;
  const custom = phase === "idle" && preset === "custom";

  return (
    <div
      ref={ref}
      data-hostbar
      data-phase={phase}
      className="hostbar fixed inset-x-2 z-40 rounded-2xl border-[2.5px] border-ink bg-paper px-2.5 pb-2.5 pt-1.5 text-ink shadow-[0_5px_0_var(--shadow)] lg:hidden"
      style={{ bottom: kb ? kb + 8 : undefined }}
    >
      {/* step rail: where am I, what's next */}
      {!kb && (
        <div className="mb-1.5 flex items-center gap-1.5" aria-live="polite">
          {(["Ask", "Lock", "Call it"] as const).map((s, i) => (
            <span key={s} className={`hb-step ${step === i + 1 ? "hb-step-on" : step > i + 1 ? "hb-step-done" : ""}`}>
              {i + 1} {s}
            </span>
          ))}
          <span className="ml-auto truncate text-[11px] font-bold text-muted">
            {settled ? (
              <>
                <b className="text-ink">{settled.label}</b> · {settled.winners.length}/{settled.total} got it
              </>
            ) : players === 0 && phase === "idle" ? (
              "Room's empty"
            ) : (
              `${players} ${players === 1 ? "friend" : "friends"} in`
            )}
          </span>
          {players === 0 && phase === "idle" && (
            <button className="hb-mini" onClick={invite}>
              Invite
            </button>
          )}
        </div>
      )}

      {phase === "idle" && !custom && (
        <div className="hb-in">
          <div className="hb-chips scroll-thin -mx-2.5 flex gap-1.5 overflow-x-auto px-2.5 pb-2 pt-0.5">
            {presets.map((p) => (
              <button key={p.key} className="chip min-h-11 shrink-0 !text-[13px]" data-on={preset === p.key} onClick={() => setPreset(p.key)}>
                {p.q}
              </button>
            ))}
            <button className="chip min-h-11 shrink-0 !text-[13px]" onClick={() => setPreset("custom")}>
              + Write my own
            </button>
          </div>
          <div className="flex gap-2">
            <button className="key key-paper shrink-0 !min-h-12 !gap-1 !px-2.5 !py-0 text-xs leading-tight" onClick={cycleTimer} aria-label={secs ? `Calls lock automatically in ${secs} seconds. Tap to change.` : "You lock calls by hand. Tap to set a timer."}>
              <Art src="b2/stopwatch" className="h-6 w-6" />
              <span className="text-left">
                Lock
                <br />
                <b>{secs ? `in ${secs}s` : "by hand"}</b>
              </span>
            </button>
            <button className="key flex-1 !min-h-12 !py-0 text-base" disabled={busy === "open" || !preset} onClick={() => act("open", { preset, seconds: secs }, null, "open")}>
              Go: open calls
            </button>
          </div>
        </div>
      )}

      {custom && (
        <form
          className="hb-in grid gap-1.5"
          onSubmit={(e) => {
            e.preventDefault();
            if (customOk) void act("open", { q, labels, seconds: secs }, null, "open");
          }}
        >
          <input className="input !min-h-11 !px-3 !py-2 text-[16px]" placeholder="Your question, e.g. Does Kohli reach 50?" value={q} maxLength={80} enterKeyHint="next" autoFocus onChange={(e) => setQ(e.target.value)} />
          <div className="flex gap-1.5">
            {labels.map((l, i) => (
              <input
                key={i}
                className="input !min-h-11 min-w-0 flex-1 !px-2.5 !py-2 text-[16px]"
                placeholder={`Answer ${i + 1}`}
                aria-label={`Answer ${i + 1}`}
                value={l}
                maxLength={24}
                enterKeyHint={i === labels.length - 1 ? "go" : "next"}
                onChange={(e) => setLabels(labels.map((x, j) => (j === i ? e.target.value : x)))}
              />
            ))}
            {labels.length < 4 && (
              <button type="button" className="key key-paper !min-h-11 shrink-0 !px-3 !py-0 text-lg" aria-label="Add an answer" onClick={() => setLabels([...labels, ""])}>
                +
              </button>
            )}
          </div>
          <div className="flex gap-2">
            <button type="button" className="key key-paper !min-h-12 shrink-0 !px-3 !py-0 text-sm" onClick={() => setPreset(presets[0]?.key ?? "custom")}>
              Back
            </button>
            <button className="key flex-1 !min-h-12 !py-0 text-base" disabled={!customOk || busy === "open"}>
              {customOk ? "Go: open calls" : "Question + 2 answers"}
            </button>
          </div>
        </form>
      )}

      {phase === "open" && (
        <div className="hb-in">
          <div className="mb-2 flex min-h-6 items-center gap-2 text-sm font-bold">
            <span className="live-dot shrink-0" />
            <span className="min-w-0 flex-1 truncate">
              {!m || m.state !== "open" ? "Opening calls…" : `${tally?.total ?? 0} ${tally?.total === 1 ? "call" : "calls"} in · ${m.q}`}
            </span>
            {left !== null && <span className="font-led shrink-0 rounded-md bg-ink px-1.5 text-lg leading-tight text-paper">{left}s</span>}
          </div>
          {m && m.state === "open" && tally && tally.total > 0 && (
            <div className="mb-2 flex h-2.5 overflow-hidden rounded-full border-2 border-ink bg-sand" aria-hidden>
              {m.options.map((o, i) => (
                <span key={o.id} className={`hb-seg hb-seg-${i % 4}`} style={{ flexGrow: tally.counts[o.id] ?? 0 }} />
              ))}
            </div>
          )}
          <button className="key key-red w-full !min-h-14 !py-0 text-xl" disabled={busy === "lock" || busy === "open"} onClick={() => act("lock", {}, "locked", "locked")}>
            <Art src="b2/lock" className="h-8 w-8" /> {busy === "open" ? (slow ? "Still opening…" : "Opening…") : busy === "lock" && (retrying || slow) ? "Locking…" : "LOCK NOW"}
          </button>
        </div>
      )}

      {(phase === "locked" || phase === "pending") && m && (
        <div className="hb-in">
          <div className="mb-1.5 flex min-h-9 items-center justify-between gap-2">
            <p className="min-w-0 truncate text-sm font-extrabold">
              {busy === "result" ? (slow ? "Still sending the result…" : "Sending the result…") : phase === "pending" ? "Points held · what was the call?" : "Locked. What happened?"}
            </p>
            {phase === "locked" && (
              <button
                className="hb-mini shrink-0 !bg-k-butter"
                disabled={busy === "pending"}
                onClick={() => act("pending", { reason: sport === "football" ? "VAR check" : sport === "cricket" ? "DRS review" : "Under review" }, "pending", "pending")}
              >
                <Art src="b2/replay" className="h-5 w-5" /> Review
              </button>
            )}
          </div>
          <div className={`grid gap-1.5 ${m.options.length >= 5 || m.options.length === 3 ? "grid-cols-3" : "grid-cols-2"}`}>
            {m.options.map((o) => {
              const n = tally?.counts[o.id] ?? 0;
              return (
                <button key={o.id} className="key key-sm relative !min-h-12 !px-1 !py-1 text-[13px] leading-tight !whitespace-normal" disabled={busy === "result"} onClick={() => act("result", { outcome: o.id }, "settled", "idle")}>
                  {o.label}
                  {n > 0 && <span className="hb-count">{n}</span>}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
