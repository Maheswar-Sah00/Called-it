"use client";

import { useEffect, useState } from "react";
import { PRESETS, type RoomState, type Sport } from "@/lib/game";
import { api } from "@/lib/client/session";
import { Art } from "@/components/ui";

const SECS_KEY = "ci-host-secs";
const TIMERS = [0, 10, 20, 30];

/**
 * The host's thumb zone: pinned above the tab bar on phones.
 * idle → pick a question + Go · open → LOCK · locked/pending → tap what happened.
 * Two taps per moment, no scrolling. Updates locally at once, rolls back on error.
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
  onOptimistic: (state: "open" | "locked" | "pending" | "settled" | null) => void;
  toast: (t: string, tone?: "ink" | "red" | "mint") => void;
}) {
  const presets = PRESETS[sport] ?? PRESETS.other;
  const [preset, setPreset] = useState(presets[0]?.key ?? "");
  const [secs, setSecs] = useState(0);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    try {
      const v = Number(localStorage.getItem(SECS_KEY));
      if (TIMERS.includes(v)) setSecs(v);
    } catch {
      /* private mode */
    }
  }, []);

  const m = st.moment;
  const phase = !m || m.state === "settled" ? "idle" : m.state;

  async function act(action: string, extra: Record<string, unknown>, optimistic: "open" | "locked" | "pending" | "settled" | null) {
    if (busy === action) return;
    setBusy(action);
    if (navigator.vibrate) navigator.vibrate(15);
    if (optimistic) onOptimistic(optimistic);
    // the server runs one host action at a time; if the previous one is still finishing, retry briefly
    let r = await api(`/api/rooms/${id}/host`, { action, ...extra });
    for (let i = 0; i < 8 && r.status === 409; i++) {
      await new Promise((res) => setTimeout(res, 400));
      r = await api(`/api/rooms/${id}/host`, { action, ...extra });
    }
    setBusy((b) => (b === action ? null : b));
    if (!r.ok) {
      onOptimistic(null); // roll back to the server's truth
      toast((r.data as { error?: string }).error ?? "That didn't go through", "red");
    }
    onDone();
  }

  function cycleTimer() {
    const next = TIMERS[(TIMERS.indexOf(secs) + 1) % TIMERS.length];
    setSecs(next);
    try {
      localStorage.setItem(SECS_KEY, String(next));
    } catch {
      /* ignore */
    }
  }

  return (
    <div className="fixed inset-x-3 bottom-[4.9rem] z-40 rounded-2xl border-[2.5px] border-ink bg-paper p-2.5 text-ink shadow-[0_5px_0_var(--shadow)] lg:hidden">
      {phase === "idle" && (
        <div>
          <div className="scroll-thin -mx-0.5 flex gap-1.5 overflow-x-auto px-0.5 pb-2">
            {presets.map((p) => (
              <button key={p.key} className="chip min-h-9 shrink-0" data-on={preset === p.key} onClick={() => setPreset(p.key)}>
                {p.q}
              </button>
            ))}
          </div>
          <div className="flex gap-2">
            <button
              className="key key-paper key-sm shrink-0 !px-3"
              onClick={cycleTimer}
              title="How calls lock"
            >
              <Art src="b2/stopwatch" className="h-5 w-5" />
              {secs ? `${secs}s` : "Tap"}
            </button>
            <button
              className="key flex-1 !py-3 text-base"
              disabled={busy === "open" || !preset}
              onClick={() => act("open", { preset, seconds: secs }, "open")}
            >
              {busy === "open" ? "Opening…" : "Go: open calls"}
            </button>
          </div>
        </div>
      )}

      {phase === "open" && (
        <button className="key key-red w-full !py-4 text-xl" disabled={busy === "lock"} onClick={() => act("lock", {}, "locked")}>
          <Art src="b2/lock" className="h-8 w-8" /> LOCK NOW
        </button>
      )}

      {(phase === "locked" || phase === "pending") && m && (
        <div>
          <div className="mb-2 flex items-center justify-between">
            <p className="text-xs font-extrabold uppercase tracking-wider text-muted">{phase === "pending" ? "Under review · what was the call?" : "What happened?"}</p>
            {phase === "locked" && (
              <button
                className="rounded-lg border-2 border-ink bg-k-butter px-2 py-0.5 text-xs font-bold"
                disabled={busy === "pending"}
                onClick={() => act("pending", { reason: sport === "football" ? "VAR check" : sport === "cricket" ? "DRS review" : "Under review" }, "pending")}
              >
                Review
              </button>
            )}
          </div>
          <div className={`grid gap-1.5 ${m.options.length > 4 ? "grid-cols-3" : m.options.length === 3 ? "grid-cols-3" : "grid-cols-2"}`}>
            {m.options.map((o) => (
              <button key={o.id} className="key key-sm !min-h-11 !px-1 text-[13px] leading-tight" disabled={busy === "result"} onClick={() => act("result", { outcome: o.id }, "settled")}>
                {o.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
