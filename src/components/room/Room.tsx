"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  CARD_TYPES,
  MT,
  REACTIONS,
  REACTION_ART,
  type Reaction,
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
import { Art, Avatar, Brand, Modal, useToast } from "@/components/ui";
import { ThemeToggle } from "@/components/Theme";
import { HostPanel } from "./HostPanel";
import { NexconnPanel } from "./NexconnPanel";
import { Celebration, type Celebrate } from "./Celebration";
import { Huddle } from "./Huddle";

const BOT_ID = "calledit_bot";
type State = RoomState & { serverNow: number };
type ChatLine = { id: string; from: string; text: string; at: number; showAt: number; sys?: boolean };
type Floating = { id: number; e: string; x: number };

const KEY_FACES = ["bg-k-peach", "bg-k-leaf", "bg-k-butter", "bg-k-rose", "bg-k-sand", "bg-k-lime"];

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
  const [tab, setTab] = useState<"play" | "board" | "chat">("play");
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
  /** live score pushed by Nexconn channel metadata (beats the polled copy) */
  const [pushed, setPushed] = useState<{ s: string; d: string; t: [string, string, string][]; at: number } | null>(null);
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

  // real-match rooms: nudge the server to check the feed; any change arrives as a metadata push
  const followsMatch = !!st?.room.match;
  useEffect(() => {
    if (!followsMatch) return;
    const nudge = () => void api(`/api/rooms/${id}/score`, {});
    nudge();
    const t = setInterval(nudge, 30_000);
    return () => clearInterval(t);
  }, [followsMatch, id]);

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
          if (e.data.live) {
            try {
              const v = JSON.parse(e.data.live) as { s: string; d: string; t: [string, string, string][] };
              setPushed({ ...v, at: Date.now() });
            } catch {
              /* ignore a malformed value */
            }
          }
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
      <main className="flood grid min-h-screen place-items-center p-6 text-center">
        <div>
          <Art src="b3/sleep" className="mx-auto w-40" />
          <h1 className="font-arcade mt-4 text-3xl">This room has closed</h1>
          <p className="mt-2 text-on-muted">Rooms close after a day of quiet. Start a fresh one.</p>
          <Link href="/" className="key mt-6">
            Back home
          </Link>
        </div>
      </main>
    );
  }

  const room = st?.room;
  const sport = room?.sport ?? "cricket";
  const liveView =
    room?.match && sport !== "f1"
      ? pushed
        ? { status: pushed.s, detail: pushed.d, teams: pushed.t.map(([abbr, score, logo]) => ({ abbr, score, logo })) }
        : st?.live
          ? { status: st.live.status, detail: st.live.detail || st.live.statusText, teams: st.live.teams.map((t) => ({ abbr: t.abbr, score: t.score, logo: t.logo })) }
          : null
      : null;
  const open = phase === "open" && !clientLocked;
  const bolo =
    phase === "waiting"
      ? "b3/sleep"
      : open
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
  const phaseLabel = phase === "waiting" ? "WARM-UP" : open ? "CALLS OPEN" : phase === "pending" ? "UNDER REVIEW" : phase === "settled" ? "SETTLED" : "LOCKED";
  const headline = open
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
            : "Waiting for the host to open a call.";
  const visibleResults = results.filter((r) => r.at + delay * 1000 <= serverNow);
  const rightCount = visibleResults.filter((r) => myCalls[r.mid] && myCalls[r.mid] === r.outcome).length;
  const calledCount = visibleResults.filter((r) => myCalls[r.mid]).length;

  return (
    <main className="min-h-screen pb-28 lg:pb-16">
      {/* ===== top bar ===== */}
      <header className="flood">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 pt-4">
          <Brand />
          <div className="flex items-center gap-2">
            <div className="hidden sm:block"><ThemeToggle /></div>
            <button className="key key-sm" onClick={invite}>
              Invite
            </button>
          </div>
        </div>

        {/* ===== LED scoreboard ===== */}
        <div className="mx-auto max-w-7xl px-4 pb-6 pt-5">
          <div className="led scanlines grid gap-4 rounded-[20px] p-4 text-paper sm:grid-cols-[auto_1fr_auto] sm:items-center sm:p-5">
            <div className="flex min-w-0 items-center gap-3">
              <span className="grid h-16 w-16 shrink-0 place-items-center rounded-xl border-2 border-ink bg-orange shadow-[0_4px_0_var(--shadow)]">
                <Art src={SPORT_ART[sport].bolo} className="h-14 w-14" />
              </span>
              <div className="min-w-0">
                <p className="font-led text-lg text-paper/60">
                  {SPORT_LABEL[sport].toUpperCase()} · {room?.mode === "replay" ? "REPLAY" : "HOST MODE"}
                  {room?.demo && " · WITH DEMO BOTS"}
                </p>
                <p className="font-arcade truncate text-xl sm:text-2xl">{room?.name ?? "Loading…"}</p>
              </div>
            </div>
            <div className="min-w-0 text-left sm:text-center">
              {liveView && liveView.teams.length === 2 ? (
                <>
                  <div key={pushed?.at ?? 0} className={`flex flex-wrap items-center gap-x-4 gap-y-1 sm:justify-center ${pushed ? "pop-in" : ""}`} style={{ animationDuration: "0.35s" }}>
                    {liveView.teams.map((t, i) => (
                      <span key={t.abbr + i} className="flex items-center gap-2">
                        {i === 1 && <span className="font-led text-2xl text-paper/40">v</span>}
                        {t.logo && (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={t.logo} alt="" className="h-7 w-7 object-contain" />
                        )}
                        <span className="font-led led-text text-[1.6rem] leading-none sm:text-3xl">
                          {t.abbr} {t.score}
                        </span>
                      </span>
                    ))}
                  </div>
                  <p className="font-led mt-1 truncate text-lg text-paper/60">
                    {liveView.status === "live" ? "● LIVE · " : ""}
                    {liveView.detail.toUpperCase()}
                    {pushed && <span className="text-paper/40"> · PUSHED BY NEXCONN</span>}
                  </p>
                </>
              ) : (
                <p className="font-led led-text text-[1.7rem] leading-none sm:truncate sm:text-4xl">
                  {st?.scoreline ?? (room?.mode === "replay" ? st?.replay?.setup : "SCORE LINE APPEARS HERE")}
                </p>
              )}
              {st?.replay && (
                <p className="font-led mt-1 text-lg text-paper/55">
                  BALL {Math.min(st.replay.index + 1, st.replay.total)}/{st.replay.total} · REAL CRICSHEET DATA
                </p>
              )}
            </div>
            <div className="flex items-center gap-4 sm:justify-end">
              <div className="flex items-center gap-2 rounded-lg border-2 border-white/15 px-2.5 py-1">
                {liveStatus === "live" ? <span className="live-dot" /> : <span className="h-2.5 w-2.5 rounded-full bg-white/30" />}
                <span className="font-led text-xl">{liveStatus === "live" ? `LIVE · ${people ?? "…"}` : liveStatus === "connecting" ? "TUNING IN" : "RECONNECTING"}</span>
              </div>
              <div className="text-right">
                <p className="font-led text-lg leading-none text-paper/55">YOU</p>
                <p className="font-led led-text text-4xl leading-none">{myPoints}</p>
              </div>
            </div>
          </div>
        </div>
      </header>

      <div className="mx-auto mt-6 max-w-7xl px-4">
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[17rem_minmax(0,1fr)_21rem] [&>*]:min-w-0">
          {/* ===== LEFT: you + table ===== */}
          <aside className={`flex flex-col gap-6 ${tab === "board" ? "" : "max-lg:hidden"}`}>
            <section className="brut rounded-[20px] bg-paper p-4 text-ink">
              <div className="flex items-center gap-3">
                <Avatar id={me?.avatar ?? st?.names[me?.userId ?? ""]?.avatar} size={48} className="border-2 border-ink" />
                <div className="min-w-0">
                  <p className="font-arcade truncate text-lg">{me?.name ?? "Guest"}</p>
                  <p className="text-xs font-bold text-muted">{myRank >= 0 ? `#${myRank + 1} in this room` : "Not on the table yet"}</p>
                </div>
              </div>
              <div className="mt-4 grid grid-cols-3 gap-2 text-center">
                {[
                  ["PTS", myPoints],
                  ["RIGHT", `${rightCount}/${calledCount}`],
                  ["STREAK", streak],
                ].map(([k, v]) => (
                  <div key={k} className="rounded-xl border-2 border-ink bg-k-butter py-1.5">
                    <p className="font-led text-3xl leading-none">{v}</p>
                    <p className="font-led text-sm text-muted">{k}</p>
                  </div>
                ))}
              </div>
              {streak >= 2 && (
                <p className="pop-in mt-3 flex items-center gap-1.5 rounded-lg border-2 border-ink bg-orange px-2 py-1 text-xs font-extrabold">
                  <Art src="b2/flame" className="h-5 w-5" /> On a {streak}-call streak: +5 on every right call
                </p>
              )}
            </section>
            <TableCard board={board} names={st?.names ?? {}} meId={me?.userId} isHost={!!st?.amHost && room?.mode === "host"} roomId={id} toast={toast.show} />
          </aside>

          {/* ===== CENTRE: the moment ===== */}
          <div className={`flex flex-col gap-6 ${tab === "play" ? "" : "max-lg:hidden"}`}>
            <section className={`brut-lg relative overflow-hidden rounded-[24px] bg-paper text-ink ${late ? "shake" : ""}`}>
              {/* pitch strip */}
              <div className="turf relative flex h-28 items-end justify-between border-b-[3px] border-ink px-4 pb-2 sm:h-32 sm:px-5">
                <div className="flex flex-col items-start gap-1.5 pb-1">
                  <span
                    className={`font-led rounded-md border-2 border-ink px-2 text-xl shadow-[0_3px_0_var(--shadow)] ${
                      open ? "bg-lime" : phase === "pending" ? "bg-yellow" : phase === "settled" ? "bg-paper" : phase === "waiting" ? "bg-sand" : "bg-red text-white"
                    }`}
                  >
                    {phaseLabel}
                  </span>
                  {moment?.ball && (
                    <span className="font-led rounded-md bg-black/55 px-2 text-lg text-paper">
                      OVER {moment.ball.over} · {moment.ball.bowler} → {moment.ball.batter}
                    </span>
                  )}
                </div>
                <Art key={bolo} src={bolo} className="pop-in -mb-6 h-28 w-28 drop-shadow-[3px_4px_0_rgba(0,0,0,.35)] sm:h-36 sm:w-36" />
              </div>

              <div className="p-5 sm:p-6">
                <p className="text-sm font-bold text-muted">{headline}</p>
                <h2 className="font-arcade mt-1 text-3xl leading-tight sm:text-4xl">
                  {moment?.q ?? (st?.amHost ? "Ask the room something" : "The host is picking the moment")}
                </h2>
                {moment?.ball?.need && <p className="font-led mt-1 text-2xl text-orange-d">{moment.ball.need.toUpperCase()}</p>}

                {/* lock fuse */}
                {phase === "open" && lockIn !== null && (
                  <div className="mt-4 flex items-center gap-2">
                    <Art src="b2/stopwatch" className="h-7 w-7" />
                    <div className="flex flex-1 gap-[3px]">
                      {Array.from({ length: 24 }).map((_, k) => {
                        const frac = Math.max(0, lockIn / Math.max(1, (moment!.lockAt ?? 0) - moment!.openAt));
                        return <span key={k} className={`h-4 flex-1 rounded-[3px] border border-ink/40 ${k / 24 < frac ? (lockIn < 2000 ? "bg-red" : "bg-orange") : "bg-sand"}`} />;
                      })}
                    </div>
                    <span className="font-led w-16 text-right text-3xl">{Math.max(0, lockIn / 1000).toFixed(1)}s</span>
                  </div>
                )}
                {phase === "open" && lockIn === null && (
                  <p className="mt-3 inline-flex items-center gap-2 text-sm font-bold">
                    <span className="live-dot" /> Open until the host taps Lock
                  </p>
                )}

                {/* options: arcade keycaps */}
                {moment && (
                  <div className={`mt-6 grid gap-3.5 ${moment.options.length > 4 ? "grid-cols-2 sm:grid-cols-3" : "grid-cols-2"}`}>
                    {moment.options.map((o, i) => {
                      const count = st?.tally?.mid === moment.mid ? st.tally.counts[o.id] ?? 0 : 0;
                      const total = st?.tally?.mid === moment.mid ? st.tally.total : 0;
                      const pct = total ? Math.round((count / total) * 100) : 0;
                      const picked = myPick === o.id;
                      const isResult = phase === "settled" && shownResult?.mid === moment.mid && shownResult.outcome === o.id;
                      const closed = !open;
                      return (
                        <button
                          key={o.id}
                          onClick={() => call(o.id)}
                          disabled={!me}
                          className={`group relative overflow-hidden rounded-2xl border-[2.5px] border-ink text-left transition-all duration-100 ${
                            isResult ? "bg-lime" : picked ? "bg-orange" : KEY_FACES[i % KEY_FACES.length]
                          } ${
                            picked || isResult
                              ? "translate-y-[4px] shadow-[0_2px_0_var(--shadow)]"
                              : closed
                                ? "opacity-55 shadow-[0_6px_0_var(--shadow)]"
                                : "shadow-[0_6px_0_var(--shadow)] hover:-translate-y-0.5 hover:shadow-[0_8px_0_var(--shadow)] active:translate-y-[5px] active:shadow-[0_1px_0_var(--shadow)]"
                          }`}
                        >
                          <div className="flex items-center gap-3 px-3.5 pb-3 pt-3">
                            <span className="font-led grid h-11 min-w-11 shrink-0 place-items-center rounded-xl border-2 border-ink bg-paper px-1 text-2xl transition-transform group-hover:-rotate-6">
                              +{o.points}
                            </span>
                            <div className="min-w-0 flex-1">
                              <p className="font-arcade text-[15px] leading-[1.05] [overflow-wrap:anywhere] sm:text-base">{o.label}</p>
                              <p className="font-led text-lg leading-none text-ink/60">{total ? `${count} · ${pct}%` : "–"}</p>
                            </div>
                            {picked && !isResult && <Art src="b2/check" className="pop-in h-9 w-9" />}
                            {isResult && <Art src={picked ? "b2/crown" : "b2/check"} className="pop-in h-10 w-10" />}
                          </div>
                          <div className="h-2 border-t-2 border-ink bg-black/10">
                            <div className="h-full bg-ink/70 transition-[width] duration-500" style={{ width: `${pct}%` }} />
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}

                {!moment && (
                  <div className="mt-5 rounded-2xl border-2 border-dashed border-ink/35 bg-k-butter/50 p-5 text-center text-sm text-muted">
                    {st?.amHost
                      ? "Use the host controls: pick a question, tap Go, then tap Lock the moment it happens."
                      : room?.mode === "replay"
                        ? "The first ball is coming up…"
                        : "Calls appear here the moment the host opens them. Chat in the dugout while you wait."}
                  </div>
                )}

                {phase === "pending" && (
                  <div className="mt-5 flex items-center gap-3 rounded-2xl border-2 border-ink bg-yellow p-3">
                    <Art src="b2/replay" className="h-10 w-10" />
                    <p className="text-sm font-bold">Points wait for the decision. Nobody scores until it&apos;s confirmed.</p>
                  </div>
                )}
                {phase === "settled" && shownResult?.mid === moment?.mid && shownResult && (
                  <div className="rise mt-5 flex flex-wrap items-center gap-3 rounded-2xl border-2 border-ink bg-k-leaf p-3">
                    <Art src="b2/scoreboard" className="h-10 w-10" />
                    <p className="flex-1 text-sm">
                      <b>{shownResult.label}.</b> {shownResult.detail} · {shownResult.winners.length} of {shownResult.total} called it
                    </p>
                    {myCalls[shownResult.mid] === shownResult.outcome && <ShareCalled label={shownResult.label} room={room?.name ?? "the match"} id={id} toast={toast.show} />}
                  </div>
                )}
                {delay > 0 && resultHidden && <p className="font-led mt-3 flex items-center gap-1.5 text-lg text-muted"><Art src="b2/lock" className="h-6 w-6" /> SPOILER SHIELD HOLDING THIS RESULT FOR {delay}S</p>}
              </div>

              {(lockFlash > 0 || late) && (
                <div className="pointer-events-none absolute inset-0 grid place-items-center">
                  <div className="stamp text-center">
                    <Art src="d2/locked" className="w-64 drop-shadow-[6px_6px_0_rgba(0,0,0,.3)]" />
                    {late && late !== "Locked" && <p className="font-led mt-1 rounded-lg bg-ink px-3 py-0.5 text-2xl text-paper">{late.toUpperCase()}</p>}
                  </div>
                </div>
              )}
            </section>

            {st?.amHost && room?.mode === "host" && <HostPanel id={id} sport={sport} st={st} onDone={fetchState} toast={toast.show} />}

            {/* ball-by-ball strip */}
            <section className="brut rounded-[20px] bg-stage-2 p-4">
              <div className="flex items-center justify-between">
                <p className="font-led text-2xl">THIS SESSION</p>
                <p className="font-led text-xl text-on-muted">
                  {rightCount} RIGHT · {calledCount} CALLED
                </p>
              </div>
              <div className="scroll-thin mt-3 flex gap-2.5 overflow-x-auto pb-2">
                {visibleResults.length === 0 && <p className="text-sm text-on-muted">Every settled moment lands here as a ball: green if you called it.</p>}
                {visibleResults.map((r) => {
                  const pick = myCalls[r.mid];
                  const right = !!pick && pick === r.outcome;
                  return (
                    <div key={r.mid} className="group relative shrink-0">
                      <div
                        className={`rise grid h-12 w-12 place-items-center rounded-full border-[2.5px] border-ink text-sm font-black shadow-[0_3px_0_var(--shadow)] transition-transform group-hover:-translate-y-1 ${
                          pick ? (right ? "bg-lime text-ink" : "bg-k-rose text-ink") : "bg-sand text-ink"
                        }`}
                      >
                        {short(r.label)}
                      </div>
                      <div className="pointer-events-none absolute bottom-full left-1/2 z-20 mb-2 hidden w-44 -translate-x-1/2 rounded-xl border-2 border-ink bg-paper p-2 text-xs text-ink shadow-[0_3px_0_var(--shadow)] group-hover:block">
                        <b>{r.label}</b> · {r.detail ?? ""}
                        <br />
                        {r.winners.length}/{r.total} called it{pick ? (right ? " · you too ✓" : " · not you") : ""}
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>

          </div>

          {/* ===== RIGHT: the dugout ===== */}
          <div className={`flex flex-col gap-6 ${tab === "chat" ? "" : "max-lg:hidden"}`}>
            <Huddle
              roomId={id}
              meId={me?.userId}
              meAvatar={me?.avatar ?? st?.names[me?.userId ?? ""]?.avatar}
              names={st?.names ?? {}}
              huddle={st?.huddle ?? null}
              ready={liveStatus === "live"}
              toast={toast.show}
              onChange={fetchState}
            />
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
      </div>

      {/* mobile tab bar */}
      <nav className="fixed inset-x-3 bottom-3 z-40 grid grid-cols-3 gap-1 rounded-2xl border-[2.5px] border-ink bg-stage-2 p-1.5 shadow-[0_5px_0_var(--shadow)] lg:hidden">
        {(
          [
            ["play", "Play", "b2/foam-finger"],
            ["board", "Table", "b2/trophy"],
            ["chat", "Dugout", "b2/megaphone"],
          ] as const
        ).map(([k, label, art]) => (
          <button
            key={k}
            onClick={() => setTab(k)}
            className={`flex items-center justify-center gap-1.5 rounded-xl py-2 text-sm font-extrabold transition-all ${tab === k ? "bg-orange text-ink shadow-[0_3px_0_var(--shadow)]" : "text-on-muted"}`}
          >
            <Art src={art} className="h-6 w-6" /> {label}
          </button>
        ))}
      </nav>

      <div className="pointer-events-none fixed inset-x-0 bottom-28 z-40 h-0">
        {floats.map((f) => (
          <span key={f.id} className="float-up absolute" style={{ left: `${f.x}%`, ["--r" as string]: `${(f.x - 50) / 3}deg` }}>
            <Art src={REACTION_ART[f.e as Reaction]?.art ?? "b5/heart"} className="h-14 w-14 drop-shadow-[2px_3px_0_rgba(0,0,0,.35)]" />
          </span>
        ))}
      </div>

      {celebrate && <Celebration c={celebrate} />}
      <NexconnPanel stats={stats} people={people} live={liveStatus} channelId={room?.channelId} />
      {toast.node}

      <Modal open={!!info && !me} onClose={() => (location.href = "/")}>
        <JoinSheet
          title={room ? `Join ${room.name}` : "Join the room"}
          cta="Walk in"
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

function BotTag() {
  return <span className="font-led ml-1.5 inline-block rounded border border-current px-1 align-middle text-[13px] leading-[1.1] opacity-70">BOT</span>;
}

function short(label: string) {
  const m: Record<string, string> = { Dot: "•", "1–3 runs": "1-3", Four: "4", Six: "6", Wicket: "W", Extra: "X" };
  return m[label] ?? label.slice(0, 3).toUpperCase();
}

type BoardRow = { id: string; name: string; points: number };
type Names = Record<string, { name: string; avatar: string }>;

function TableCard({
  board,
  names,
  meId,
  isHost,
  roomId,
  toast,
}: {
  board: BoardRow[];
  names: Names;
  meId?: string;
  isHost: boolean;
  roomId: string;
  toast: (t: string, tone?: "ink" | "red" | "mint") => void;
}) {
  async function mute(uid: string, name: string) {
    const r = await api(`/api/rooms/${roomId}/host`, { action: "mute", userId: uid, minutes: 10 });
    toast(r.ok ? `${name} is muted for 10 minutes` : (r.data as { error?: string }).error ?? "Mute failed", r.ok ? "mint" : "red");
  }
  return (
    <section className="led rounded-[20px] p-4 text-paper">
      <div className="flex items-center justify-between">
        <p className="font-led led-text text-2xl">THE TABLE</p>
        <Art src="b2/trophy" className="h-9 w-9" />
      </div>
      <div className="mt-3 flex flex-col gap-1.5">
        {board.length === 0 && <p className="font-led text-lg text-paper/55">NO POINTS YET. FIRST RIGHT CALL TAKES THE CROWN.</p>}
        {board.slice(0, 10).map((b, i) => (
          <div
            key={b.id}
            className={`group flex items-center gap-2.5 rounded-lg px-2 py-1.5 transition-colors ${b.id === meId ? "bg-orange text-ink" : "hover:bg-white/5"}`}
          >
            <span className={`font-led w-6 text-2xl ${b.id === meId ? "" : "text-yellow"}`}>{i + 1}</span>
            <Avatar id={names[b.id]?.avatar} size={28} className="border border-ink" />
            <span className="flex-1 truncate text-sm font-bold">
              {b.name}
              {b.id === meId && " (you)"}
              {b.id.startsWith("bot_") && <BotTag />}
            </span>
            {i === 0 && b.points > 0 && <Art src="b2/crown" className="h-5 w-5" />}
            {isHost && b.id !== meId && !b.id.startsWith("bot_") && (
              <button
                onClick={() => mute(b.id, b.name)}
                className="hidden rounded-md border border-paper/40 px-1.5 text-[10px] font-bold hover:bg-red group-hover:inline"
                title="Mute for 10 minutes"
              >
                MUTE
              </button>
            )}
            <span className="font-led text-2xl">{b.points}</span>
          </div>
        ))}
      </div>
    </section>
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
    <section className="brut flex h-[34rem] flex-col overflow-hidden rounded-[20px] bg-stage-2 lg:h-[36rem]">
      <div className="flex items-center justify-between gap-2 border-b-2 border-ink bg-stage-3 px-4 py-3">
        <div className="flex items-center gap-2">
          <Art src="b2/megaphone" className="h-8 w-8" />
          <p className="font-arcade text-lg">Dugout</p>
        </div>
        <label className="flex items-center gap-1.5 text-xs font-bold" title="Hold results and chat to match a delayed stream">
          <Art src="b2/stopwatch" className="h-6 w-6" /> Shield
          <select
            className="font-led rounded-lg border-2 border-ink bg-paper px-1.5 text-lg text-ink outline-none transition hover:bg-yellow"
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
          <div className="m-auto text-center text-sm text-on-muted">
            <Art src="b5/heart" className="mx-auto mb-2 h-12 w-12" />
            {live ? "Say hi. Links, numbers and betting talk are blocked." : "Tuning in to the room…"}
          </div>
        )}
        {visible.map((l) =>
          l.sys ? (
            <div key={l.id} className="font-led rise mx-auto max-w-[92%] rounded-lg border-2 border-ink bg-yellow px-3 py-0.5 text-center text-lg text-ink">
              {l.text}
            </div>
          ) : (
            <div key={l.id} className={`rise flex items-end gap-2 ${l.from === meId ? "flex-row-reverse" : ""}`}>
              <Avatar id={names[l.from]?.avatar} size={28} className="border border-ink" />
              <div
                className={`max-w-[78%] rounded-2xl border-2 border-ink px-3 py-1.5 text-ink shadow-[0_2px_0_var(--shadow)] ${l.from === meId ? "rounded-br-sm bg-orange" : "rounded-bl-sm bg-paper"}`}
              >
                {l.from !== meId && (
                  <p className="text-[11px] font-extrabold text-orange-d">
                    {nameOf(l.from)}
                    {l.from.startsWith("bot_") && <BotTag />}
                  </p>
                )}
                <p className="break-words text-sm">{l.text}</p>
              </div>
            </div>
          ),
        )}
        {held > 0 && <p className="font-led flex items-center justify-center gap-1.5 text-lg text-on-muted"><Art src="b2/stopwatch" className="h-5 w-5" /> {held} HELD FOR YOUR STREAM DELAY</p>}
      </div>
      <div className="flex justify-between gap-1 border-t-2 border-ink px-3 pt-2.5">
        {REACTIONS.map((e) => (
          <button
            key={e}
            onClick={() => onReact(e)}
            className="grid h-11 w-11 place-items-center rounded-xl border-2 border-ink bg-paper shadow-[0_3px_0_var(--shadow)] transition-all hover:-translate-y-1 hover:rotate-12 active:translate-y-[2px] active:shadow-none"
            aria-label={REACTION_ART[e].label}
            title={REACTION_ART[e].label}
          >
            <Art src={REACTION_ART[e].art} className="h-8 w-8" />
          </button>
        ))}
      </div>
      <form
        className="flex gap-2 p-3"
        onSubmit={async (e) => {
          e.preventDefault();
          const t = text.trim();
          if (!t) return;
          if (await onSend(t)) {
            setText("");
            setWarn(null);
          }
        }}
      >
        <input
          className={`input !py-2.5 ${warn ? "!border-red" : ""}`}
          placeholder={muted ? "The host muted you for a bit" : "Say something about the match…"}
          value={text}
          maxLength={200}
          disabled={muted}
          onChange={(e) => {
            setText(e.target.value);
            setWarn(blockReason(e.target.value));
          }}
        />
        <button className="key !px-4" disabled={muted || !text.trim()}>
          Send
        </button>
      </form>
      {warn && <p className="-mt-1 flex items-center gap-1.5 px-4 pb-3 text-xs font-bold text-red"><Art src="b2/cross" className="h-5 w-5" /> {warn}. It won&apos;t be delivered.</p>}
    </section>
  );
}

function ShareCalled({ label, room, id, toast }: { label: string; room: string; id: string; toast: (t: string, tone?: "ink" | "red" | "mint") => void }) {
  return (
    <button
      className="key key-sm"
      onClick={async () => {
        const url = `${location.origin}/r/${id}`;
        const text = `I called it! "${label}" in ${room}. Think you can beat me? ${url}`;
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
