"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { SPORT_ART, SPORT_LABEL, SPORTS, type LiveMatch, type Sport } from "@/lib/game";
import { api, useSession } from "@/lib/client/session";
import { JoinSheet } from "./JoinSheet";
import { HAS_FEED, LiveBrowser } from "./LiveMatches";
import { Art, Modal } from "./ui";

/** Start a room: nickname (once) → sport → the real match (or your own) → the room. */
export function StartRoom({
  open,
  onClose,
  sport: initialSport,
  match: initialMatch,
}: {
  open: boolean;
  onClose: () => void;
  sport?: Sport;
  match?: LiveMatch | null;
}) {
  const router = useRouter();
  const { info, join } = useSession();
  const [sport, setSport] = useState<Sport>(initialSport ?? initialMatch?.sport ?? "cricket");
  const [match, setMatch] = useState<LiveMatch | null>(initialMatch ?? null);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [seenProps, setSeenProps] = useState({ initialSport, initialMatch });
  if (seenProps.initialSport !== initialSport || seenProps.initialMatch !== initialMatch) {
    setSeenProps({ initialSport, initialMatch });
    if (initialMatch) {
      setSport(initialMatch.sport);
      setMatch(initialMatch);
    } else if (initialSport) {
      setSport(initialSport);
      setMatch(null);
    }
  }

  async function create() {
    setBusy(true);
    setErr(null);
    const r = await api<{ room: { id: string } }>("/api/rooms", {
      sport,
      mode: "host",
      name: (match ? match.short || match.title : name.trim()) || undefined,
      match: match ? { id: match.id, sport: match.sport, title: match.title, league: match.league } : undefined,
    });
    if (!r.ok) {
      setErr(r.data.error ?? "Could not create the room");
      setBusy(false);
      return;
    }
    router.push(`/r/${r.data.room.id}`);
  }

  const needName = info && !info.session;
  const feed = HAS_FEED.has(sport);

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
          <p className="text-xs font-bold uppercase tracking-wider text-muted">Start a room</p>
          <h2 className="font-display mt-1 pr-12 text-2xl font-extrabold">Which match are you watching?</h2>

          {/* sport */}
          <div className="scroll-thin -mx-1 mt-4 flex gap-2 overflow-x-auto px-1 pb-2">
            {SPORTS.map((s) => (
              <button
                key={s}
                onClick={() => {
                  setSport(s);
                  setMatch(null);
                }}
                className={`flex shrink-0 items-center gap-1.5 rounded-xl border-2 border-ink py-1 pl-1 pr-3 text-xs font-bold transition-all ${
                  sport === s ? "bg-orange shadow-[0_1px_0_var(--shadow)] translate-y-[2px]" : "bg-paper shadow-[0_3px_0_var(--shadow)] hover:-translate-y-0.5"
                }`}
                aria-pressed={sport === s}
              >
                <Art src={SPORT_ART[s].bolo} className="h-7 w-7" />
                {s === "hockey" ? "Hockey" : SPORT_LABEL[s]}
              </button>
            ))}
          </div>

          {/* match */}
          {feed ? (
            <div className="mt-3">
              <p className="mb-2 text-sm font-bold">
                Live and starting soon <span className="font-normal text-muted">· tap yours</span>
              </p>
              <LiveBrowser fixedSport={sport} compact selectedId={match?.id} onPick={(m) => setMatch(match?.id === m.id ? null : m)} />
            </div>
          ) : (
            <p className="mt-3 rounded-xl border-2 border-dashed border-ink/25 bg-k-sand/50 p-3 text-sm text-muted">
              No live feed for {SPORT_LABEL[sport].toLowerCase()} yet. Name the match below and you keep the score yourself.
            </p>
          )}

          {!match && (
            <div className="mt-4">
              <label className="text-xs font-bold uppercase tracking-wider text-muted">{feed ? "Not in the list? Name your own" : "Match name"}</label>
              <input
                className="input mt-1.5"
                placeholder={sport === "cricket" ? "e.g. Hostel league final" : "e.g. Sunday night with the gang"}
                value={name}
                maxLength={40}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && !busy && create()}
              />
            </div>
          )}

          <div className="sticky -bottom-6 z-10 -mx-6 mt-5 border-t-2 border-dashed border-ink/15 bg-paper px-6 pb-6 pt-4">
          {err && <p className="mb-3 rounded-xl border-2 border-ink bg-k-rose px-3 py-2 text-sm font-semibold">{err}</p>}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-muted max-sm:hidden">
              Hosting as <b className="text-ink">{info?.session?.name}</b>
              {match && (
                <>
                  {" "}
                  · score updates itself from the live feed
                </>
              )}
            </p>
            <button className="key text-base" onClick={create} disabled={busy || (!match && !name.trim())}>
              {busy ? "Opening…" : match ? `Open room: ${match.short}` : "Open my room"}
            </button>
          </div>
          </div>
        </div>
      )}
    </Modal>
  );
}
