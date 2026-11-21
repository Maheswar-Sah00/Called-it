"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { SPORT_ART, SPORT_LABEL, SPORTS, type Sport } from "@/lib/game";
import { api, useSession } from "@/lib/client/session";
import { JoinSheet } from "./JoinSheet";
import { Art, Modal } from "./ui";

/** "Start a room" flow: nickname (once) → sport + room name → the room. */
export function StartRoom({ open, onClose, sport: initial }: { open: boolean; onClose: () => void; sport?: Sport }) {
  const router = useRouter();
  const { info, join } = useSession();
  const [sport, setSport] = useState<Sport>(initial ?? "cricket");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [lastInitial, setLastInitial] = useState(initial);
  if (initial !== lastInitial) {
    setLastInitial(initial);
    if (initial) setSport(initial);
  }

  async function create() {
    setBusy(true);
    setErr(null);
    const r = await api<{ room: { id: string } }>("/api/rooms", { sport, name: name.trim(), mode: "host" });
    if (!r.ok) {
      setErr(r.data.error ?? "Could not create the room");
      setBusy(false);
      return;
    }
    router.push(`/r/${r.data.room.id}`);
  }

  const needName = info && !info.session;

  return (
    <Modal open={open} onClose={onClose} wide={!needName}>
      {needName ? (
        <JoinSheet
          busy={busy}
          error={err}
          cta="Next: pick the match"
          onJoin={async (n, a) => {
            setBusy(true);
            setErr(null);
            try {
              await join(n, a);
            } catch (e) {
              setErr(String((e as Error).message));
            }
            setBusy(false);
          }}
        />
      ) : (
        <div>
          <div className="flex items-center gap-3 pr-10">
            <Art src="b2/megaphone" className="h-14 w-14" />
            <div>
              <h2 className="font-display text-2xl font-extrabold">Start a room</h2>
              <p className="text-sm text-muted">You&apos;re the host: you ask, you lock, you call the result.</p>
            </div>
          </div>
          <div className="mt-5 grid grid-cols-3 gap-2.5 sm:grid-cols-5">
            {SPORTS.map((s) => (
              <button
                key={s}
                onClick={() => setSport(s)}
                className={`brut-sm group flex flex-col items-center rounded-2xl px-1 pb-2 pt-1 transition-all hover:-translate-y-1 ${
                  sport === s ? "bg-yellow" : "bg-white hover:bg-t-butter"
                }`}
                aria-pressed={sport === s}
              >
                <Art src={SPORT_ART[s].bolo} className="h-16 w-16 transition-transform group-hover:scale-110 group-hover:-rotate-6" />
                <span className="text-xs font-bold">{SPORT_LABEL[s]}</span>
              </button>
            ))}
          </div>
          <label className="mt-5 block text-xs font-bold uppercase tracking-wider">Room name</label>
          <input
            className="input mt-1.5"
            placeholder={sport === "cricket" ? "e.g. IND vs NZ, hostel block C" : "e.g. Sunday night with the gang"}
            value={name}
            maxLength={40}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && !busy && create()}
          />
          {err && <p className="mt-3 rounded-xl border-2 border-ink bg-t-pink px-3 py-2 text-sm font-semibold">{err}</p>}
          <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-muted">
              Hosting as <b className="text-ink">{info?.session?.name}</b>
            </p>
            <button className="btn text-lg" onClick={create} disabled={busy}>
              {busy ? "Opening the room…" : "Open my room →"}
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
}
