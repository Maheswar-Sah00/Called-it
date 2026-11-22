"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { SPORT_ART, SPORT_LABEL, SPORTS, type LiveMatch, type Sport } from "@/lib/game";
import { api, useSession } from "@/lib/client/session";
import { JoinSheet } from "./JoinSheet";
import { HAS_FEED, LiveBrowser, MatchRow } from "./LiveMatches";
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
  const sessionState = useSession();
  const { info, join } = sessionState;
  const [sport, setSport] = useState<Sport>(initialSport ?? initialMatch?.sport ?? "cricket");
  const [match, setMatch] = useState<LiveMatch | null>(initialMatch ?? null);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const inFlight = useRef(false);
  // feed sports: the "name your own" field is one tap away, above the list (not under 50+ matches)
  const [ownOpen, setOwnOpen] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  // picker open = show sports + list; closed = show the chosen match as one big card
  const [picking, setPicking] = useState(!initialMatch);
  const [seenProps, setSeenProps] = useState({ initialSport, initialMatch, open });
  if (seenProps.initialSport !== initialSport || seenProps.initialMatch !== initialMatch || seenProps.open !== open) {
    setSeenProps({ initialSport, initialMatch, open });
    if (initialMatch) {
      setSport(initialMatch.sport);
      setMatch(initialMatch);
      setPicking(false);
    } else {
      if (initialSport) setSport(initialSport);
      setMatch(null);
      setPicking(true);
    }
  }

  async function create() {
    if (inFlight.current) return;
    inFlight.current = true;
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
      inFlight.current = false;
      return;
    }
    router.push(`/r/${r.data.room.id}`);
  }

  const { loading, error: sessionError } = sessionState;
  // still checking who you are: show a loader, not step 2 (it would jump back to the name step)
  const needName = !loading && (sessionError ? !info?.session : !!info && !info.session);
  const feed = HAS_FEED.has(sport);

  return (
    <Modal open={open} onClose={onClose} wide={!needName && !loading}>
      {loading ? (
        <div className="grid min-h-48 place-items-center" role="status" aria-live="polite">
          <div className="flex items-center gap-3 text-sm font-bold text-muted">
            <span className="h-5 w-5 animate-spin rounded-full border-[3px] border-ink/20 border-t-ink" />
            Getting your seat…
          </div>
        </div>
      ) : needName ? (
        <JoinSheet
          busy={busy}
          error={err}
          title={match?.short ? `Calling ${match.short}?` : undefined}
          cta={match ? "Next: open the room" : "Next: pick the match"}
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
          <p className="text-xs font-bold uppercase tracking-wider text-muted">Start a room · step 2 of 2</p>
          <h2 className="font-display mt-1 pr-12 text-2xl font-extrabold leading-tight">
            {picking ? "Which match are you watching?" : "Your match"}
          </h2>

          {!picking && match ? (
            /* the match they tapped: one big confirm card */
            <div className="rise mt-4">
              <MatchRow m={match} selected onPick={() => setPicking(true)} cta="Change" />
              <button
                type="button"
                onClick={() => setPicking(true)}
                className="mt-3 inline-flex min-h-11 items-center gap-1.5 rounded-xl px-1 text-sm font-extrabold text-orange-d underline decoration-2 underline-offset-4"
              >
                Pick a different match
              </button>
              <p className="mt-1 flex items-center gap-2 text-sm text-muted">
                <Art src="b2/scoreboard" className="h-6 w-6 shrink-0" />
                The score updates itself from the live feed.
              </p>
            </div>
          ) : (
            <>
              {/* sport */}
              <div
                className="scroll-thin -mx-5 mt-4 flex snap-x gap-2 overflow-x-auto overscroll-x-contain px-5 pb-2 sm:-mx-1 sm:px-1"
                role="tablist"
                aria-label="Sport"
              >
                {SPORTS.map((s) => (
                  <button
                    key={s}
                    role="tab"
                    aria-selected={sport === s}
                    onClick={() => {
                      setSport(s);
                      setMatch(null);
                      setOwnOpen(false);
                    }}
                    className={`flex min-h-11 shrink-0 snap-start items-center gap-1.5 rounded-xl border-2 border-ink py-1 pl-1 pr-3 text-sm font-bold transition-all ${
                      sport === s ? "translate-y-[2px] bg-orange shadow-[0_1px_0_var(--shadow)]" : "bg-paper shadow-[0_3px_0_var(--shadow)] hover:-translate-y-0.5"
                    }`}
                  >
                    <Art src={SPORT_ART[s].bolo} className="h-8 w-8" />
                    {s === "hockey" ? "Ice hockey" : SPORT_LABEL[s]}
                  </button>
                ))}
              </div>

              {/* your own match: above the list so nobody scrolls past 50 rows to find it */}
              {!match && feed && !ownOpen && (
                <button
                  type="button"
                  onClick={() => setOwnOpen(true)}
                  className="mt-3 flex min-h-12 w-full items-center gap-2 rounded-xl border-2 border-dashed border-ink/40 bg-k-sand/50 px-3 text-left text-sm font-extrabold"
                >
                  <span aria-hidden>✎</span> Not on TV? Name your own match
                  <span className="ml-auto font-normal text-muted">gully, hostel, local</span>
                </button>
              )}
              {!match && (!feed || ownOpen) && (
                <div className="mt-3">
                  <label htmlFor="own-match" className="text-xs font-bold uppercase tracking-wider text-muted">
                    {feed ? "Your own match" : "Match name"}
                  </label>
                  <input
                    id="own-match"
                    className="input mt-1.5 text-base"
                    placeholder={sport === "cricket" ? "e.g. Hostel league final" : "e.g. Sunday night with the gang"}
                    value={name}
                    maxLength={40}
                    enterKeyHint="go"
                    autoFocus={feed}
                    onChange={(e) => setName(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && !busy && name.trim() && create()}
                  />
                </div>
              )}

              {/* match */}
              {feed ? (
                <div className="mt-4">
                  <p className="mb-2 text-sm font-bold">
                    Live and starting soon <span className="font-normal text-muted">· tap yours</span>
                  </p>
                  <LiveBrowser
                    key={sport}
                    fixedSport={sport}
                    limit={6}
                    compact
                    selectedId={match?.id}
                    onPick={(m) => {
                      setMatch(m);
                      setPicking(false);
                    }}
                  />
                </div>
              ) : (
                <p className="mt-3 rounded-xl border-2 border-dashed border-ink/25 bg-k-sand/50 p-3 text-sm text-muted">
                  No live feed for {SPORT_LABEL[sport].toLowerCase()} yet. Name the match above and you keep the score yourself.
                </p>
              )}

            </>
          )}

          {/* sticky footer: the one primary action, always under the thumb */}
          <div className="sheet-foot sticky -bottom-5 z-10 -mx-5 mt-5 border-t-2 border-dashed border-ink/15 bg-paper px-5 pt-3 sm:-bottom-6 sm:-mx-6 sm:px-6 sm:pt-4">
            {err && <p className="mb-3 rounded-xl border-2 border-ink bg-k-rose px-3 py-2 text-sm font-semibold">{err}</p>}
            <div className="flex flex-col-reverse items-stretch gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
              <p className="truncate text-center text-xs text-muted sm:text-left sm:text-sm">
                Hosting as <b className="text-ink">{info?.session?.name}</b> · points only
              </p>
              <button className="key min-h-14 w-full text-base sm:w-auto" onClick={create} disabled={busy || (!match && !name.trim())}>
                {busy ? "Opening…" : match ? `Open room: ${match.short}` : name.trim() ? "Open my room" : "Pick a match or name one"}
              </button>
            </div>
          </div>
        </div>
      )}
    </Modal>
  );
}
