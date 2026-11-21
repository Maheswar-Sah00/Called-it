"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  CARD_TYPES,
  MT,
  REACTIONS,
  SPORT_ART,
  SPORT_LABEL,
  blockReason,
  type ResultCard,
  type RoomState,
  type TallyCard,
} from "@/lib/game";
import { api, useSession } from "@/lib/client/session";
import { joinLive, log, type Live, type LiveEvent } from "@/lib/client/live";
import { JoinSheet } from "@/components/JoinSheet";
import { Art, Avatar, Brand, Modal, Sparkle, useToast } from "@/components/ui";
import { HostPanel } from "./HostPanel";
import { NexconnPanel } from "./NexconnPanel";
import { Celebration, type Celebrate } from "./Celebration";

const BOT_ID = "calledit_bot";
type State = RoomState & { serverNow: number };
type ChatLine = { id: string; from: string; text: string; at: number; showAt: number; sys?: boolean };
type Floating = { id: number; e: string; x: number };

const OPTION_COLORS = ["bg-t-pink", "bg-t-mint", "bg-t-peach", "bg-t-sky", "bg-t-lav", "bg-t-lime"];
const BADGE_COLORS = ["bg-pink", "bg-mint", "bg-[#ffb27a]", "bg-[#7cc4ff]", "bg-lav", "bg-lime"];

function useNow(ms = 200) {
  const [n, setN] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setN(Date.now()), ms);
    return () => clearInterval(t);
  }, [ms]);
  return n;
}

export function Room({ id }: { id: string }) {
  const { info, join, error: sessionError } = useSession();
  const me = info?.session ?? null;
  const [st, setSt] = useState<State | null>(null);
  const [missing, setMissing] = useState(false);
  const [tab, setTab] = useState<"room" | "board">("room");
  const [joining, setJoining] = useState(false);
  const [joinErr, setJoinErr] = useState<string | null>(null);
  const [liveStatus, setLiveStatus] = useState<"connecting" | "live" | "offline">("connecting");
  const [people, setPeople] = useState<number | null>(null);
  const [chat, setChat] = useState<ChatLine[]>([]);
  const [floats, setFloats] = useState<Floating[]>([]);
  const [delay, setDelay] = useState(0);
  const [muted, setMuted] = useState(false);
  const [lockFlash, setLockFlash] = useState(0);
  const [late, setLate] = useState<string | null>(null);
  const [celebrate, setCelebrate] = useState<Celebrate | null>(null);
  const [myCalls, setMyCalls] = useState<Record<string, string>>({});
  const [results, setResults] = useState<ResultCard[]>([]);
  const [stats, setStats] = useState({ cards: 0, chats: 0, forged: 0, blocked: 0 });
  const offset = useRef(0);
  const liveRef = useRef<Live | null>(null);
  const shownMid = useRef<string | null>(null);
  const firstLoad = useRef(true);
  const refetchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const toast = useToast();
  const now = useNow(150);
  const serverNow = now + offset.current;

  // ---------- state ----------
  const fetchState = useCallback(async () => {
    const t0 = Date.now();
    const r = await api<State>(`/api/rooms/${id}`);
    if (r.status === 404) return setMissing(true);
    if (!r.ok) return;
    const rtt = Date.now() - t0;
    offset.current = r.data.serverNow + rtt / 2 - Date.now();
    setSt(r.data);
    if (r.data.moment && r.data.myCall) setMyCalls((m) => ({ ...m, [r.data.moment!.mid]: r.data.myCall! }));
    if (r.data.lastResult) {
      const lr = r.data.lastResult;
      setResults((rs) => (rs.some((x) => x.mid === lr.mid) ? rs : [...rs, lr].slice(-30)));
    }
  }, [id]);

  const refetchSoon = useCallback(() => {
    if (refetchTimer.current) clearTimeout(refetchTimer.current);
    refetchTimer.current = setTimeout(fetchState, 60);
  }, [fetchState]);

  useEffect(() => {
    fetchState();
  }, [fetchState]);

  // poll as a safety net; the live channel does the real work
  useEffect(() => {
    const t = setInterval(fetchState, liveStatus === "live" ? 5000 : 1500);
    return () => clearInterval(t);
  }, [fetchState, liveStatus]);

  // replay driver: nudge the server at its own deadline
  useEffect(() => {
    const rp = st?.replay;
    if (!rp || rp.phase === "done") return;
    const wait = Math.max(0, rp.nextAt - (Date.now() + offset.current)) + 120;
    const t = setTimeout(async () => {
      await api(`/api/rooms/${id}/tick`, {});
      fetchState();
    }, Math.min(wait, 15000));
    return () => clearTimeout(t);
  }, [st?.replay, id, fetchState]);

  // ---------- live channel ----------
  const nameOf = useCallback(
    (uid: string) => (uid === BOT_ID ? "Called It" : st?.names[uid]?.name ?? "Someone"),
    [st?.names],
  );

  const delayRef = useRef(0);
  delayRef.current = delay;

  const onEvent = useCallback(
    (e: LiveEvent) => {
      switch (e.kind) {
        case "status":
          setLiveStatus(e.status);
          break;
        case "participants":
          setPeople(e.count);
          break;
        case "muted":
          setMuted(true);
          break;
        case "blocked":
          setStats((s) => ({ ...s, blocked: s.blocked + 1 }));
          toast.show(e.reason, "red");
          break;
        case "deleted":
          setChat((c) => c.filter((l) => !e.ids.includes(l.id)));
          break;
        case "metadata":
          break;
        case "msg": {
          const m = e.msg;
          if (CARD_TYPES.includes(m.type) || m.type === MT.Tally) {
            if (m.from !== BOT_ID) {
              setStats((s) => ({ ...s, forged: s.forged + 1 }));
              log("guard", `ignored a ${m.type} card not sent by the server`);
              return;
            }
            setStats((s) => ({ ...s, cards: s.cards + 1 }));
            if (m.type === MT.Tally) {
              const t = m.content as unknown as TallyCard;
              setSt((x) => (x && x.moment?.mid === t.mid ? { ...x, tally: t } : x));
              return;
            }
            if (m.type === MT.Lock) setLockFlash(Date.now());
            log("onMessageReceived", `${m.type} (priority card)`);
            refetchSoon();
            return;
          }
          if (m.type === MT.React) {
            const emo = String((m.content as { e?: string }).e ?? "");
            if ((REACTIONS as readonly string[]).includes(emo)) {
              setFloats((f) => [...f.slice(-14), { id: Math.random(), e: emo, x: 10 + Math.random() * 80 }]);
            }
            return;
          }
          if (m.type === "RC:TxtMsg" && m.text) {
            setStats((s) => ({ ...s, chats: s.chats + 1 }));
            const mine = m.from === me?.userId;
            setChat((c) =>
              c.some((l) => l.id === m.id)
                ? c
                : [
                    ...c.slice(-120),
                    { id: m.id, from: m.from, text: m.text!, at: m.at, showAt: mine ? 0 : Date.now() + delayRef.current * 1000, sys: m.from === BOT_ID },
                  ],
            );
          }
          break;
        }
      }
    },
    [me?.userId, refetchSoon, toast],
  );

  useEffect(() => {
    if (!me || !info?.token || !info.appKey || !st?.room.channelId) return;
    let cancelled = false;
    let live: Live | null = null;
    (async () => {
      await api(`/api/rooms/${id}/join`, {});
      fetchState();
      try {
        live = await joinLive({ appKey: info.appKey!, token: info.token!, userId: me.userId, channelId: st.room.channelId, onEvent });
        if (cancelled) return void live.leave();
        liveRef.current = live;
      } catch (err) {
        setLiveStatus("offline");
        log("error", String(err));
      }
    })();
    return () => {
      cancelled = true;
      liveRef.current = null;
      void live?.leave();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [me?.userId, info?.token, st?.room.channelId]);

  // ---------- derived ----------
  const shownResult = useMemo(() => {
    for (let i = results.length - 1; i >= 0; i--) if (results[i].at + delay * 1000 <= serverNow) return results[i];
    return null;
  }, [results, delay, serverNow]);

  const moment = st?.moment ?? null;
  const resultHidden = !!moment && moment.state === "settled" && (!shownResult || shownResult.mid !== moment.mid);
  const phase = !moment ? "waiting" : resultHidden ? "locked" : moment.state;
  const lockIn = moment?.lockAt ? moment.lockAt - serverNow : null;
  const clientLocked = phase === "open" && lockIn !== null && lockIn <= 0;
  const myPick = moment ? myCalls[moment.mid] ?? null : null;
  const board = delay > 0 && shownResult ? shownResult.board : st?.board ?? [];
  const myRank = me ? board.findIndex((b) => b.id === me.userId) : -1;
  const myPoints = myRank >= 0 ? board[myRank].points : 0;
  const streak = useMemo(() => {
    let s = 0;
    for (let i = results.length - 1; i >= 0; i--) {
      const pick = myCalls[results[i].mid];
      if (!pick) continue;
      if (pick === results[i].outcome) s++;
      else break;
    }
    return s;
  }, [results, myCalls]);

  // celebration when a (spoiler-delayed) result appears
  useEffect(() => {
    if (!shownResult) return;
    if (shownMid.current === shownResult.mid) return;
    shownMid.current = shownResult.mid;
    if (firstLoad.current) {
      firstLoad.current = false;
      return;
    }
    const pick = myCalls[shownResult.mid];
    const right = !!pick && pick === shownResult.outcome;
    setCelebrate({ key: shownResult.mid, result: shownResult, pick: pick ?? null, right, sport: st?.room.sport ?? "other" });
    const t = setTimeout(() => setCelebrate(null), 2900);
    return () => clearTimeout(t);
  }, [shownResult, myCalls, st?.room.sport]);

  useEffect(() => {
    if (results.length && firstLoad.current && shownResult) {
      firstLoad.current = false;
      shownMid.current = shownResult.mid;
    }
  }, [results.length, shownResult]);

  useEffect(() => {
    if (!lockFlash) return;
    const t = setTimeout(() => setLockFlash(0), 1400);
    return () => clearTimeout(t);
  }, [lockFlash]);

  // ---------- actions ----------
  async function call(option: string) {
    if (!moment || !me) return;
    if (phase !== "open" || clientLocked) {
      setLate("Locked");
      setTimeout(() => setLate(null), 1200);
      return;
    }
    const prev = myPick;
    setMyCalls((m) => ({ ...m, [moment.mid]: option }));
    const r = await api<{ status: string; tally?: TallyCard; at?: number; lockAt?: number }>(`/api/rooms/${id}/call`, { mid: moment.mid, option });
    if (!r.ok) {
      setMyCalls((m) => {
        const n = { ...m };
        if (prev) n[moment.mid] = prev;
        else delete n[moment.mid];
        return n;
      });
      if (r.data.status === "locked") {
        const lateBy = r.data.at && r.data.lockAt ? Math.max(0, r.data.at - r.data.lockAt) : 0;
        setLate(lateBy > 0 ? `Locked · ${(lateBy / 1000).toFixed(2)}s late` : "Locked");
        setTimeout(() => setLate(null), 1600);
      } else toast.show(r.data.error ?? "Couldn't place that call", "red");
      return;
    }
    if (r.data.tally) setSt((x) => (x && x.moment?.mid === moment.mid ? { ...x, tally: r.data.tally!, myCall: option } : x));
  }

  async function sendChat(text: string) {
    const why = blockReason(text);
    if (why) {
      setStats((s) => ({ ...s, blocked: s.blocked + 1 }));
      toast.show(`${why}. Keep it about the match.`, "red");
      log("guard", `client check: ${why}`);
      return false;
    }
    if (!liveRef.current) {
      toast.show("Still connecting to the room…");
      return false;
    }
    const r = await liveRef.current.send(text);
    if (!r.ok) {
      if (r.reason?.includes("muted")) setMuted(true);
      toast.show(r.reason ?? "Not sent", "red");
      return false;
    }
    return true;
  }

  async function react(e: string) {
    setFloats((f) => [...f.slice(-14), { id: Math.random(), e, x: 10 + Math.random() * 80 }]);
    await liveRef.current?.react(e);
  }

  async function invite() {
    const url = `${location.origin}/r/${id}`;
    const text = `Watching ${st?.room.name ?? "the match"}? Come call it with us on Called It: ${url}`;
    if (navigator.share) {
      try {
        await navigator.share({ title: "Called It", text, url });
        return;
      } catch {
        /* fall through to copy */
      }
    }
    await navigator.clipboard.writeText(url);
    toast.show("Room link copied", "mint");
  }

  // ---------- render ----------
  if (missing) {
    return (
      <main className="grid min-h-screen place-items-center bg-blue p-6 text-center text-white">
        <div>
          <Art src="b3/sleep" className="mx-auto w-40" />
          <h1 className="font-display mt-4 text-3xl font-extrabold">This room has closed</h1>
          <p className="mt-2 text-white/80">Rooms close after a day of quiet. Start a fresh one.</p>
          <Link href="/" className="btn mt-6">
            Back home
          </Link>
        </div>
      </main>
    );
  }

  const room = st?.room;
  const sport = room?.sport ?? "cricket";
  const bolo =
    phase === "waiting"
      ? "b3/sleep"
      : phase === "open" && !clientLocked
        ? myPick
          ? "b3/wave"
          : "b3/pumped"
        : phase === "pending"
          ? "b3/review"
          : phase === "settled"
            ? shownResult && myCalls[shownResult.mid]
              ? myCalls[shownResult.mid] === shownResult.outcome
                ? streak >= 3
                  ? "b3/onfire"
                  : "b3/celebrate"
                : "b3/facepalm"
              : "b3/wave"
            : "b3/locked";

  return (
    <main className="min-h-screen overflow-x-hidden bg-[linear-gradient(180deg,#e4dcff_0%,#f3ecff_14%,var(--cream)_40%)] pb-24">
      {/* top bar */}
      <header className="relative mx-auto flex max-w-6xl items-center justify-between px-4 pt-5">
        <Brand dark />
        <div className="flex items-center gap-2">
          <span className="brut-sm hidden items-center gap-2 rounded-full bg-white px-3 py-1.5 text-xs font-bold sm:inline-flex">
            {liveStatus === "live" ? <span className="live-dot" /> : <span className="h-2.5 w-2.5 rounded-full bg-[#bbb]" />}
            {liveStatus === "live" ? `LIVE · ${people ?? "…"} in room` : liveStatus === "connecting" ? "Connecting…" : "Offline · refreshing"}
          </span>
          <button className="btn btn-sm" onClick={invite}>
            Invite friends
          </button>
        </div>
        <Sparkle className="absolute -bottom-6 right-[30%] h-4 w-4" color="#111" />
      </header>

      {/* tabs */}
      <div className="mt-6 flex justify-center">
        <div className="brut-sm inline-flex rounded-full bg-white p-1">
          {(["room", "board"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`rounded-full px-6 py-2 text-sm font-bold transition-all ${tab === t ? "bg-ink text-white" : "hover:bg-t-butter"}`}
            >
              {t === "room" ? "Match room" : "Leaderboard"}
            </button>
          ))}
        </div>
      </div>

      <div className="mx-auto mt-6 max-w-6xl px-4">
        <h1 className="font-display text-center text-3xl font-extrabold sm:text-4xl">
          {phase === "open" && !clientLocked
            ? "Calls are open. Make yours."
            : phase === "pending"
              ? "Under review. Hold your nerve."
              : phase === "settled"
                ? shownResult && myCalls[shownResult.mid] === shownResult.outcome
                  ? "You called it."
                  : "Settled. Next one's yours."
                : phase === "locked" || clientLocked
                  ? "Locked. Here it comes…"
                  : st?.amHost
                    ? "You're the host. Open the first call."
                    : "Waiting for the host to open a call."}
        </h1>
        <p className="mt-1 text-center text-sm text-muted">
          {room ? `${SPORT_LABEL[sport]} · ${room.name}` : "Loading the room…"}
          {room?.demo && " · demo bots are labelled 🤖"}
        </p>

        {/* status card */}
        <section className="brut-lg mt-6 grid grid-cols-1 gap-5 rounded-3xl bg-white p-5 sm:p-6 md:grid-cols-[1.25fr_1fr_1fr] [&>*]:min-w-0 md:divide-x-2 md:divide-dashed md:divide-ink/20">
          <div className="flex items-center gap-4">
            <div className="min-w-0 flex-1">
              <p className="text-xs text-muted">Your room</p>
              <p className="font-display truncate text-2xl font-extrabold sm:text-3xl">{room?.name ?? "…"}</p>
              <p className="mt-1 text-sm font-bold">{st?.scoreline ?? (room?.mode === "replay" ? st?.replay?.setup : "Score shows here once the host adds it")}</p>
              {st?.replay && (
                <p className="mt-1 text-xs text-muted">
                  Ball {Math.min(st.replay.index + 1, st.replay.total)} of {st.replay.total} · real Cricsheet data
                </p>
              )}
            </div>
            <div className="brut-sm grid h-20 w-20 shrink-0 rotate-3 sm:h-24 sm:w-24 place-items-center rounded-2xl bg-[#7cc4ff] transition-transform hover:rotate-0 hover:scale-105">
              <Art src={SPORT_ART[sport].bolo} className="h-16 w-16 sm:h-20 sm:w-20" />
            </div>
          </div>
          <div className="flex flex-col justify-center gap-2.5 md:pl-5">
            <Check done={!!me} label="You're in" sub={me ? `as ${me.name}` : "pick a nickname"} />
            <Check done={liveStatus === "live"} label="Live on Nexconn" sub={liveStatus === "live" ? `${people ?? "…"} watching` : "connecting…"} />
            <Check done={!!myPick || results.some((r) => myCalls[r.mid])} label="First call made" sub="tap an answer when calls open" />
          </div>
          <div className="md:pl-5">
            <p className="text-xs text-muted">Your points</p>
            <div className="flex items-end gap-3">
              <p className="font-display text-5xl font-extrabold">{myPoints}</p>
              {streak >= 2 && (
                <span className="pop-in mb-2 inline-flex items-center gap-1 rounded-full border-2 border-ink bg-[#ffb27a] px-2 py-0.5 text-xs font-extrabold">
                  <Art src="b2/flame" className="h-4 w-4" /> {streak} streak
                </span>
              )}
            </div>
            <div className="mt-2 h-3 overflow-hidden rounded-full border-2 border-ink bg-t-lav">
              <div
                className="h-full rounded-full bg-lav transition-all duration-700"
                style={{ width: `${board[0]?.points ? Math.max(4, (myPoints / board[0].points) * 100) : 4}%` }}
              />
            </div>
            <p className="mt-2 text-sm font-bold">{myRank >= 0 ? `#${myRank + 1} in this room` : "Not on the board yet"}</p>
            <p className="text-xs text-muted">Right calls score. Two in a row adds +5 each.</p>
          </div>
        </section>

        {tab === "board" ? (
          <BoardPage board={board} names={st?.names ?? {}} meId={me?.userId} results={results} myCalls={myCalls} />
        ) : (
          <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-[1.45fr_1fr] [&>*]:min-w-0">
            <div className="flex flex-col gap-6">
              {/* MOMENT */}
              <section
                className={`brut-lg relative overflow-hidden rounded-3xl p-5 transition-colors duration-500 sm:p-6 ${
                  phase === "open" && !clientLocked
                    ? "bg-t-mint"
                    : phase === "pending"
                      ? "bg-t-butter"
                      : phase === "settled"
                        ? "bg-t-lav"
                        : phase === "waiting"
                          ? "bg-white"
                          : "bg-t-pink"
                }`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="badge-pts bg-white !h-8 !min-w-0 px-3 text-xs">
                        {phase === "waiting" ? "WAITING" : phase === "open" && !clientLocked ? "CALLS OPEN" : phase === "pending" ? "UNDER REVIEW" : phase === "settled" ? "SETTLED" : "LOCKED"}
                      </span>
                      {moment?.ball && (
                        <span className="rounded-full border-2 border-ink bg-white px-3 py-1 font-mono text-xs font-bold">
                          Over {moment.ball.over} · {moment.ball.bowler} to {moment.ball.batter}
                        </span>
                      )}
                    </div>
                    <h2 className="font-display mt-3 text-3xl font-extrabold leading-tight sm:text-4xl">
                      {moment?.q ?? (st?.amHost ? "Ask the room something" : "The host is picking the moment")}
                    </h2>
                    {moment?.ball?.need && <p className="mt-1 text-sm font-bold">{moment.ball.need}</p>}
                  </div>
                  <Art key={bolo} src={bolo} className="pop-in h-24 w-24 shrink-0 sm:h-32 sm:w-32" />
                </div>

                {/* countdown */}
                {phase === "open" && lockIn !== null && (
                  <div className="mt-4">
                    <div className="flex items-center justify-between text-xs font-bold">
                      <span className="inline-flex items-center gap-1">
                        <Art src="b2/stopwatch" className="h-5 w-5" /> Locks in
                      </span>
                      <span className="font-mono text-base">{Math.max(0, lockIn / 1000).toFixed(1)}s</span>
                    </div>
                    <div className="mt-1.5 h-4 overflow-hidden rounded-full border-2 border-ink bg-white">
                      <div
                        className={`h-full transition-[width] duration-150 ease-linear ${lockIn < 2000 ? "bg-red" : "bg-mint"}`}
                        style={{ width: `${Math.max(0, Math.min(100, (lockIn / Math.max(1, (moment!.lockAt ?? 0) - moment!.openAt)) * 100))}%` }}
                      />
                    </div>
                  </div>
                )}
                {phase === "open" && lockIn === null && (
                  <p className="mt-3 inline-flex items-center gap-2 text-sm font-bold">
                    <span className="live-dot" /> Open until the host taps Lock
                  </p>
                )}

                {/* options */}
                {moment && (
                  <div className={`mt-5 grid gap-3 ${moment.options.length > 4 ? "grid-cols-2 sm:grid-cols-3" : "grid-cols-2"} ${late ? "shake" : ""}`}>
                    {moment.options.map((o, i) => {
                      const count = st?.tally?.mid === moment.mid ? st.tally.counts[o.id] ?? 0 : 0;
                      const total = st?.tally?.mid === moment.mid ? st.tally.total : 0;
                      const pct = total ? Math.round((count / total) * 100) : 0;
                      const picked = myPick === o.id;
                      const isResult = phase === "settled" && shownResult?.mid === moment.mid && shownResult.outcome === o.id;
                      const closed = phase !== "open" || clientLocked;
                      return (
                        <button
                          key={o.id}
                          onClick={() => call(o.id)}
                          disabled={!me}
                          className={`group relative overflow-hidden rounded-2xl border-[2.5px] border-ink p-3.5 text-left transition-all duration-150 ${
                            isResult
                              ? "bg-mint shadow-[5px_5px_0_#111]"
                              : picked
                                ? "bg-yellow shadow-[5px_5px_0_#111] -translate-x-0.5 -translate-y-0.5"
                                : `${OPTION_COLORS[i % OPTION_COLORS.length]} shadow-[3px_3px_0_#111]`
                          } ${closed ? (isResult || picked ? "" : "opacity-60") : "hover:-translate-x-0.5 hover:-translate-y-1 hover:shadow-[6px_6px_0_#111] active:translate-x-0.5 active:translate-y-0.5 active:shadow-[1px_1px_0_#111]"}`}
                        >
                          <div
                            className="absolute inset-y-0 left-0 bg-ink/[0.07] transition-[width] duration-500"
                            style={{ width: `${pct}%` }}
                            aria-hidden
                          />
                          <div className="relative flex items-center gap-3">
                            <span className={`badge-pts ${BADGE_COLORS[i % BADGE_COLORS.length]} !h-10 !min-w-10 shrink-0 transition-transform group-hover:rotate-[-8deg] group-hover:scale-110`}>
                              +{o.points}
                            </span>
                            <div className="min-w-0 flex-1">
                              <p className="font-display truncate text-lg font-extrabold leading-tight">{o.label}</p>
                              <p className="text-xs font-semibold text-muted">
                                {total ? `${count} call${count === 1 ? "" : "s"} · ${pct}%` : "no calls yet"}
                              </p>
                            </div>
                            {picked && !isResult && <Art src="b2/check" className="pop-in h-8 w-8" />}
                            {isResult && <Art src={picked ? "b2/crown" : "b2/check"} className="pop-in h-9 w-9" />}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}

                {!moment && (
                  <div className="mt-6 rounded-2xl border-2 border-dashed border-ink/40 bg-white/60 p-5 text-center text-sm text-muted">
                    {st?.amHost
                      ? "Use the host controls below: pick a question, tap Go, then tap Lock the moment it happens."
                      : room?.mode === "replay"
                        ? "The replay starts in a moment…"
                        : "Calls appear here the moment the host opens them. Chat while you wait."}
                  </div>
                )}

                {phase === "pending" && (
                  <div className="mt-4 flex items-center gap-3 rounded-2xl border-2 border-ink bg-white p-3">
                    <Art src="b2/replay" className="h-10 w-10" />
                    <p className="text-sm font-bold">Points wait for the decision. Nobody scores until it&apos;s confirmed.</p>
                  </div>
                )}
                {phase === "settled" && shownResult?.mid === moment?.mid && shownResult && (
                  <div className="rise mt-4 flex flex-wrap items-center gap-3 rounded-2xl border-2 border-ink bg-white p-3">
                    <Art src="b2/scoreboard" className="h-10 w-10" />
                    <p className="flex-1 text-sm">
                      <b>{shownResult.label}.</b> {shownResult.detail} · {shownResult.winners.length} of {shownResult.total} called it
                    </p>
                    {myCalls[shownResult.mid] === shownResult.outcome && (
                      <ShareCalled label={shownResult.label} room={room?.name ?? "the match"} id={id} toast={toast.show} />
                    )}
                  </div>
                )}
                {delay > 0 && resultHidden && (
                  <p className="mt-3 text-xs font-bold text-muted">🛡 Spoiler shield is holding this result for {delay}s</p>
                )}

                {/* lock stamp */}
                {(lockFlash > 0 || late) && (
                  <div className="pointer-events-none absolute inset-0 grid place-items-center">
                    <div className="stamp text-center">
                      <Art src="d2/locked" className="w-64 drop-shadow-[6px_6px_0_rgba(0,0,0,.25)]" />
                      {late && late !== "Locked" && <p className="mt-1 rounded-full bg-ink px-3 py-1 text-sm font-bold text-white">{late}</p>}
                    </div>
                  </div>
                )}
              </section>

              {st?.amHost && room?.mode === "host" && <HostPanel id={id} sport={sport} st={st} onDone={fetchState} toast={toast.show} />}

              {/* recent moments */}
              {results.length > 0 && (
                <section className="brut rounded-3xl bg-white p-5">
                  <div className="flex items-center justify-between">
                    <h3 className="font-display text-xl font-extrabold">Recent moments</h3>
                    <span className="badge-pts !h-8 bg-white text-xs">{results.length}</span>
                  </div>
                  <div className="mt-3 flex gap-2.5 overflow-x-auto pb-2 scroll-thin">
                    {[...results]
                      .filter((r) => r.at + delay * 1000 <= serverNow)
                      .reverse()
                      .map((r) => {
                        const pick = myCalls[r.mid];
                        const right = pick === r.outcome;
                        return (
                          <div
                            key={r.mid}
                            className={`rise min-w-[8.5rem] rounded-2xl border-2 border-ink p-3 transition-transform hover:-translate-y-1 ${pick ? (right ? "bg-t-mint" : "bg-t-pink") : "bg-t-butter"}`}
                          >
                            <div className="flex items-center justify-between">
                              <p className="font-display text-lg font-extrabold">{r.label}</p>
                              {pick && <Art src={right ? "b2/check" : "b2/cross"} className="h-6 w-6" />}
                            </div>
                            <p className="line-clamp-2 text-[11px] text-muted">{r.detail ?? ""}</p>
                            <p className="mt-1 text-[11px] font-bold">
                              {r.winners.length}/{r.total} called it
                            </p>
                          </div>
                        );
                      })}
                  </div>
                </section>
              )}
            </div>

            {/* right column */}
            <div className="flex flex-col gap-6">
              <MiniBoard board={board} names={st?.names ?? {}} meId={me?.userId} isHost={!!st?.amHost && room?.mode === "host"} roomId={id} toast={toast.show} onMore={() => setTab("board")} />
              <ChatBox
                chat={chat}
                now={now}
                meId={me?.userId}
                nameOf={nameOf}
                names={st?.names ?? {}}
                onSend={sendChat}
                onReact={react}
                delay={delay}
                setDelay={setDelay}
                muted={muted}
                live={liveStatus === "live"}
              />
            </div>
          </div>
        )}
      </div>

      {/* floating reactions */}
      <div className="pointer-events-none fixed inset-x-0 bottom-24 z-40 h-0">
        {floats.map((f) => (
          <span key={f.id} className="float-up absolute text-4xl" style={{ left: `${f.x}%`, ["--r" as string]: `${(f.x - 50) / 3}deg` }}>
            {f.e}
          </span>
        ))}
      </div>

      {celebrate && <Celebration c={celebrate} />}
      <NexconnPanel stats={stats} people={people} live={liveStatus} channelId={room?.channelId} />
      {toast.node}

      <Modal open={!!info && !me} onClose={() => (location.href = "/")}>
        <JoinSheet
          title={room ? `Join ${room.name}` : "Join the room"}
          cta="Join the room"
          busy={joining}
          error={joinErr ?? sessionError}
          onJoin={async (n, a) => {
            setJoining(true);
            setJoinErr(null);
            try {
              await join(n, a, !!room?.demo);
            } catch (e) {
              setJoinErr((e as Error).message);
            }
            setJoining(false);
          }}
        />
      </Modal>
    </main>
  );
}

function Check({ done, label, sub }: { done: boolean; label: string; sub: string }) {
  return (
    <div className="flex items-start gap-2.5">
      <span
        className={`mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full border-2 border-ink text-xs font-black transition-colors ${done ? "bg-mint" : "bg-white"}`}
      >
        {done ? "✓" : ""}
      </span>
      <div>
        <p className="text-sm font-bold leading-tight">{label}</p>
        <p className="text-xs text-muted">{sub}</p>
      </div>
    </div>
  );
}

type BoardRow = { id: string; name: string; points: number };
type Names = Record<string, { name: string; avatar: string }>;

function MiniBoard({
  board,
  names,
  meId,
  isHost,
  roomId,
  toast,
  onMore,
}: {
  board: BoardRow[];
  names: Names;
  meId?: string;
  isHost: boolean;
  roomId: string;
  toast: (t: string, tone?: "ink" | "red" | "mint") => void;
  onMore: () => void;
}) {
  async function mute(uid: string, name: string) {
    const r = await api(`/api/rooms/${roomId}/host`, { action: "mute", userId: uid, minutes: 10 });
    toast(r.ok ? `${name} is muted for 10 minutes` : (r.data as { error?: string }).error ?? "Mute failed", r.ok ? "mint" : "red");
  }
  return (
    <section className="brut rounded-3xl bg-yellow p-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Art src="b2/trophy" className="h-9 w-9" />
          <h3 className="font-display text-xl font-extrabold">Leaderboard</h3>
        </div>
        <button onClick={onMore} className="text-xs font-bold underline decoration-2 underline-offset-2 hover:text-blue">
          See all
        </button>
      </div>
      <div className="mt-3 flex flex-col gap-2">
        {board.length === 0 && <p className="rounded-xl border-2 border-dashed border-ink/40 bg-white/60 p-3 text-sm text-muted">No points yet. First right call takes the crown.</p>}
        {board.slice(0, 6).map((b, i) => (
          <div
            key={b.id}
            className={`group flex items-center gap-3 rounded-xl border-2 border-ink px-3 py-2 transition-transform hover:-translate-y-0.5 ${b.id === meId ? "bg-ink text-white" : "bg-white"}`}
          >
            <span className="w-5 font-mono text-sm font-bold">{i + 1}</span>
            <Avatar id={names[b.id]?.avatar} size={30} />
            <span className="flex-1 truncate font-bold">
              {b.name}
              {b.id === meId && " (you)"}
            </span>
            {i === 0 && b.points > 0 && <Art src="b2/crown" className="h-6 w-6" />}
            {isHost && b.id !== meId && !b.id.startsWith("bot_") && (
              <button
                onClick={() => mute(b.id, b.name)}
                className="hidden rounded-full border-2 border-ink bg-t-pink px-2 py-0.5 text-[10px] font-bold group-hover:inline"
                title="Mute for 10 minutes"
              >
                mute
              </button>
            )}
            <span className="font-display text-lg font-extrabold">{b.points}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

function BoardPage({ board, names, meId, results, myCalls }: { board: BoardRow[]; names: Names; meId?: string; results: ResultCard[]; myCalls: Record<string, string> }) {
  const podium = [board[1], board[0], board[2]];
  const mine = results.filter((r) => myCalls[r.mid]);
  const right = mine.filter((r) => myCalls[r.mid] === r.outcome).length;
  return (
    <div className="mt-6 grid gap-6 lg:grid-cols-[1.4fr_1fr]">
      <section className="brut-lg rounded-3xl bg-white p-6">
        <h3 className="font-display text-2xl font-extrabold">Who called it best</h3>
        <div className="mt-6 grid grid-cols-3 items-end gap-3">
          {podium.map((p, i) => (
            <div key={i} className="text-center">
              {p ? (
                <>
                  <div className="relative mx-auto w-fit">
                    {i === 1 && <Art src="b2/crown" className="absolute -top-8 left-1/2 h-10 w-10 -translate-x-1/2 -rotate-6" />}
                    <Avatar id={names[p.id]?.avatar} size={i === 1 ? 72 : 56} className="border-2 border-ink" />
                  </div>
                  <p className="mt-2 truncate font-bold">{p.name}</p>
                </>
              ) : (
                <div className="h-20" />
              )}
              <div
                className={`brut-sm mt-2 grid place-items-center rounded-t-2xl font-display text-2xl font-extrabold ${i === 1 ? "h-32 bg-yellow" : i === 0 ? "h-24 bg-lav" : "h-16 bg-pink"}`}
              >
                {p ? p.points : "–"}
              </div>
            </div>
          ))}
        </div>
        <div className="mt-6 flex flex-col gap-2">
          {board.map((b, i) => (
            <div key={b.id} className={`flex items-center gap-3 rounded-xl border-2 border-ink px-3 py-2 ${b.id === meId ? "bg-ink text-white" : "bg-cream"}`}>
              <span className="w-6 font-mono font-bold">{i + 1}</span>
              <Avatar id={names[b.id]?.avatar} size={32} />
              <span className="flex-1 truncate font-bold">{b.name}</span>
              <span className="font-display text-lg font-extrabold">{b.points}</span>
            </div>
          ))}
        </div>
      </section>
      <section className="flex flex-col gap-4">
        <div className="brut rounded-3xl bg-t-mint p-5">
          <p className="text-xs text-muted">Your calls</p>
          <p className="font-display text-5xl font-extrabold">
            {right}/{mine.length}
          </p>
          <p className="text-sm font-bold">right this session</p>
        </div>
        <div className="brut rounded-3xl bg-t-lav p-5">
          <p className="font-display text-lg font-extrabold">How scoring works</p>
          <ul className="mt-2 flex flex-col gap-1.5 text-sm">
            <li>• Each answer shows its points. Rarer outcomes pay more.</li>
            <li>• Two right in a row: +5 on every right call after.</li>
            <li>• Calls lock on the server clock. Late taps never count.</li>
            <li>• Reviews hold points until the decision is in.</li>
          </ul>
        </div>
      </section>
    </div>
  );
}

function ChatBox({
  chat,
  now,
  meId,
  nameOf,
  names,
  onSend,
  onReact,
  delay,
  setDelay,
  muted,
  live,
}: {
  chat: ChatLine[];
  now: number;
  meId?: string;
  nameOf: (uid: string) => string;
  names: Names;
  onSend: (t: string) => Promise<boolean>;
  onReact: (e: string) => void;
  delay: number;
  setDelay: (n: number) => void;
  muted: boolean;
  live: boolean;
}) {
  const [text, setText] = useState("");
  const [warn, setWarn] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const visible = chat.filter((l) => l.showAt <= now);
  const held = chat.length - visible.length;

  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [visible.length]);

  return (
    <section className="brut flex h-[30rem] flex-col rounded-3xl bg-white">
      <div className="flex items-center justify-between border-b-2 border-ink px-5 py-3">
        <div className="flex items-center gap-2">
          <Art src="b2/megaphone" className="h-8 w-8" />
          <h3 className="font-display text-xl font-extrabold">Banter</h3>
        </div>
        <label className="flex items-center gap-1.5 text-xs font-bold" title="Hold results and chat to match a delayed stream">
          🛡 Spoiler shield
          <select
            className="rounded-full border-2 border-ink bg-t-butter px-2 py-1 text-xs font-bold outline-none transition hover:bg-yellow"
            value={delay}
            onChange={(e) => setDelay(Number(e.target.value))}
          >
            {[0, 5, 10, 20, 30, 45].map((d) => (
              <option key={d} value={d}>
                {d ? `${d}s` : "off"}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div ref={listRef} className="scroll-thin flex flex-1 flex-col gap-2.5 overflow-y-auto px-4 py-3">
        {visible.length === 0 && (
          <div className="m-auto text-center text-sm text-muted">
            <Art src="b5/heart" className="mx-auto mb-2 h-12 w-12" />
            {live ? "Say hi. Links, numbers and betting talk are blocked." : "Connecting to the room…"}
          </div>
        )}
        {visible.map((l) =>
          l.sys ? (
            <div key={l.id} className="rise mx-auto max-w-[90%] rounded-full border-2 border-ink bg-t-butter px-3 py-1 text-center text-xs font-bold">
              {l.text}
            </div>
          ) : (
            <div key={l.id} className={`rise flex items-end gap-2 ${l.from === meId ? "flex-row-reverse" : ""}`}>
              <Avatar id={names[l.from]?.avatar} size={28} />
              <div className={`max-w-[78%] rounded-2xl border-2 border-ink px-3 py-1.5 ${l.from === meId ? "rounded-br-sm bg-yellow" : "rounded-bl-sm bg-t-sky"}`}>
                {l.from !== meId && <p className="text-[11px] font-bold text-muted">{nameOf(l.from)}</p>}
                <p className="break-words text-sm">{l.text}</p>
              </div>
            </div>
          ),
        )}
        {held > 0 && <p className="text-center text-[11px] font-bold text-muted">🛡 {held} message{held > 1 ? "s" : ""} held for your stream delay</p>}
      </div>
      <div className="flex gap-1.5 border-t-2 border-ink px-4 pt-2.5">
        {REACTIONS.map((e) => (
          <button
            key={e}
            onClick={() => onReact(e)}
            className="grid h-9 w-9 place-items-center rounded-full border-2 border-ink bg-cream text-lg transition-transform hover:-translate-y-1 hover:rotate-12 hover:scale-110 active:scale-90"
            aria-label={`React ${e}`}
          >
            {e}
          </button>
        ))}
      </div>
      <form
        className="flex gap-2 p-4 pt-2.5"
        onSubmit={async (e) => {
          e.preventDefault();
          const t = text.trim();
          if (!t) return;
          if (await onSend(t)) setText("");
        }}
      >
        <input
          className={`input !rounded-full !py-2.5 ${warn ? "!border-red" : ""}`}
          placeholder={muted ? "The host muted you for a bit" : "Say something about the match…"}
          value={text}
          maxLength={200}
          disabled={muted}
          onChange={(e) => {
            setText(e.target.value);
            setWarn(blockReason(e.target.value));
          }}
        />
        <button className="btn btn-dark !px-4" disabled={muted || !text.trim()}>
          Send
        </button>
      </form>
      {warn && <p className="-mt-2 px-5 pb-3 text-xs font-bold text-red">⛔ {warn}. It won&apos;t be delivered.</p>}
    </section>
  );
}

function ShareCalled({ label, room, id, toast }: { label: string; room: string; id: string; toast: (t: string, tone?: "ink" | "red" | "mint") => void }) {
  return (
    <button
      className="btn btn-sm"
      onClick={async () => {
        const url = `${location.origin}/r/${id}`;
        const text = `I called it 😎 "${label}" in ${room}. Think you can beat me? ${url}`;
        if (navigator.share) {
          try {
            await navigator.share({ title: "I called it", text, url });
            return;
          } catch {
            /* copy instead */
          }
        }
        await navigator.clipboard.writeText(text);
        toast("Brag copied. Paste it anywhere.", "mint");
      }}
    >
      Brag: I called it
    </button>
  );
}
