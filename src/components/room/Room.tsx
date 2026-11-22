"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  CALLS_ENABLED,
  CARD_TYPES,
  MT,
  REACTIONS,
  REACTION_ART,
  type Reaction,
  SPORT_ART,
  SPORT_LABEL,
  STREAK_BONUS,
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
import { HostBar } from "./HostBar";
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

/** A short haptic tick on phones that support it (silently ignored elsewhere). */
function buzz(p: number | number[]) {
  try {
    if (typeof navigator !== "undefined" && "vibrate" in navigator && !reducedMotion()) navigator.vibrate(p);
  } catch {
    /* not allowed before a user gesture: fine */
  }
}

function reducedMotion() {
  return typeof window !== "undefined" && !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
}

/**
 * Phones: the on-screen keyboard shrinks the visual viewport, not the layout one.
 * Mirror its height into --ra-vvh so the chat can fit above the keyboard, and report whether it is open.
 */
function useKeyboardOpen() {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const root = document.documentElement;
    // compare against the tallest viewport seen at this width (iOS shrinks innerHeight too, so it is no baseline)
    let base = vv.height;
    let width = window.innerWidth;
    const sync = () => {
      if (window.innerWidth !== width) {
        width = window.innerWidth;
        base = vv.height;
      }
      base = Math.max(base, vv.height);
      root.style.setProperty("--ra-vvh", `${Math.round(vv.height)}px`);
      setOpen(window.innerWidth < 1024 && vv.scale < 1.05 && vv.height < base * 0.78);
    };
    sync();
    vv.addEventListener("resize", sync);
    return () => {
      vv.removeEventListener("resize", sync);
      root.style.removeProperty("--ra-vvh");
    };
  }, []);
  return open;
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
  const [delay, setDelayState] = useState(0);
  const setDelay = useCallback((n: number) => {
    setDelayState(n);
    try {
      localStorage.setItem("ci-shield", String(n));
    } catch {
      /* private mode */
    }
  }, []);
  useEffect(() => {
    try {
      const v = Number(localStorage.getItem("ci-shield"));
      if ([5, 10, 20, 30, 45].includes(v)) setDelayState(v);
    } catch {
      /* private mode */
    }
  }, []);
  const [muted, setMuted] = useState(false);
  const muteTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [lockFlash, setLockFlash] = useState(0);
  const [late, setLate] = useState<string | null>(null);
  const [celebrate, setCelebrate] = useState<Celebrate | null>(null);
  const [myCalls, setMyCalls] = useState<Record<string, string>>({});
  const [results, setResults] = useState<ResultCard[]>([]);
  const [stats, setStats] = useState({ cards: 0, chats: 0, forged: 0, blocked: 0 });
  const [retry, setRetry] = useState(0);
  const historyLoaded = useRef(false);
  const bestRtt = useRef(Number.POSITIVE_INFINITY);
  const [unread, setUnread] = useState(0);
  const kb = useKeyboardOpen();
  const tabRef = useRef(tab);
  tabRef.current = tab;
  const keysRef = useRef<HTMLDivElement | null>(null);
  /** live score pushed by Nexconn channel metadata (beats the polled copy) */
  const [pushed, setPushed] = useState<{ s: string; p?: number; d: string; t: [string, string, string][]; at: number } | null>(null);
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
    const wantHistory = !historyLoaded.current;
    const r = await api<State>(`/api/rooms/${id}${wantHistory ? "?history=1" : ""}`);
    if (r.status === 404) return setMissing(true);
    if (!r.ok) return;
    const rtt = Date.now() - t0;
    // Clock sync: trust the fastest round trip seen (slow ones carry server work and overshoot the lock).
    bestRtt.current *= 1.03; // let the best sample age, so a slower network still resyncs
    if (rtt <= bestRtt.current * 1.25) {
      bestRtt.current = Math.min(bestRtt.current, rtt);
      offset.current = r.data.serverNow + rtt / 2 - Date.now();
    }
    if (wantHistory && r.data.history) {
      historyLoaded.current = true;
      const h = r.data.history;
      setMyCalls((m) => ({ ...h.picks, ...m }));
      setResults((rs) => {
        const seen = new Set(rs.map((x) => x.mid));
        return [...h.results.filter((x) => !seen.has(x.mid)), ...rs].sort((a, b) => a.at - b.at).slice(-40);
      });
    } else if (wantHistory) historyLoaded.current = true;
    setSt(r.data);
    // a room with no settled result yet: the very first result that lands deserves its celebration
    if (firstLoad.current && !r.data.lastResult) firstLoad.current = false;
    // only touch myCalls when the call actually changed (a fresh object each poll re-ran the celebration and cancelled its auto-close)
    if (r.data.moment && r.data.myCall) {
      const mid = r.data.moment.mid, call = r.data.myCall;
      setMyCalls((m) => (m[mid] === call ? m : { ...m, [mid]: call }));
    }
    if (r.data.lastResult) {
      const lr = r.data.lastResult;
      setResults((rs) => (rs.some((x) => x.mid === lr.mid) ? rs : [...rs, lr].slice(-40)));
    }
  }, [id]);

  const refetchSoon = useCallback(() => {
    if (refetchTimer.current) clearTimeout(refetchTimer.current);
    refetchTimer.current = setTimeout(fetchState, 60);
  }, [fetchState]);

  useEffect(() => {
    fetchState();
  }, [fetchState]);

  // poll as a safety net; the live channel does the real work.
  // Hidden tabs poll once a minute (keeps the room alive, spares the quota); catch up on return.
  useEffect(() => {
    let last = 0;
    const tick = () => {
      const every = document.hidden ? 60_000 : liveStatus === "live" ? 10_000 : 2500;
      if (Date.now() - last >= every - 50) {
        last = Date.now();
        fetchState();
      }
    };
    const t = setInterval(tick, 2500);
    const onVis = () => {
      if (!document.hidden) {
        last = Date.now();
        fetchState();
      }
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      clearInterval(t);
      document.removeEventListener("visibilitychange", onVis);
    };
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
        case "muted": {
          setMuted(true);
          if (muteTimer.current) clearTimeout(muteTimer.current);
          // Nexconn has no unmute event: lift the lock when the mute runs out (the server still enforces it).
          muteTimer.current = setTimeout(() => setMuted(false), Math.min(Math.max(e.ms ?? 10 * 60_000, 30_000), 2 * 60 * 60_000) + 1500);
          break;
        }
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
              const v = JSON.parse(e.data.live) as { s: string; p?: number; d: string; t: [string, string, string][] };
              const hold = delayRef.current * 1000;
              if (hold > 0) setTimeout(() => setPushed({ ...v, at: Date.now() }), hold);
              else setPushed({ ...v, at: Date.now() });
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
            const sys = m.from === BOT_ID;
            // Receiver-side guard: never show a friend's line that breaks the room rules, even if it
            // skipped the sender's check (raw SDK send). The pre-messaging webhook blocks it server-side too.
            const clean = sys ? m.text : m.text.replace(/[\p{Cc}\p{Cf}]/gu, "").trim().slice(0, 200);
            if (!clean) return;
            if (!sys && blockReason(clean)) {
              setStats((s) => ({ ...s, blocked: s.blocked + 1 }));
              log("guard", "hid a chat line that breaks the room rules");
              return;
            }
            setStats((s) => ({ ...s, chats: s.chats + 1 }));
            const mine = m.from === me?.userId;
            if (!mine && tabRef.current !== "chat" && delayRef.current === 0) setUnread((n) => Math.min(99, n + 1));
            setChat((c) =>
              c.some((l) => l.id === m.id)
                ? c
                : [
                    ...c.slice(-120),
                    { id: m.id, from: m.from, text: clean, at: m.at, showAt: mine ? 0 : Date.now() + delayRef.current * 1000, sys },
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
    let retryTimer: ReturnType<typeof setTimeout> | null = null;
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
        // retry with backoff: 2s, 4s, 8s … up to 20s
        if (!cancelled) retryTimer = setTimeout(() => setRetry((n) => n + 1), Math.min(20_000, 2000 * 2 ** Math.min(retry, 4)));
      }
    })();
    return () => {
      cancelled = true;
      if (retryTimer) clearTimeout(retryTimer);
      liveRef.current = null;
      void live?.leave();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [me?.userId, info?.token, st?.room.channelId, retry]);

  // phones: when a new moment opens, bring the answer keys into view
  const openMid = st?.moment?.state === "open" ? st.moment.mid : null;
  useEffect(() => {
    if (!openMid) return;
    setCelebrate(null); // a fresh call beats a lingering celebration
    if (typeof window === "undefined" || window.innerWidth >= 1024) return;
    // never yank someone out of a half-typed chat message: the Play tab badge tells them instead
    const typing = document.activeElement instanceof HTMLInputElement && !!document.activeElement.value;
    if (typing) return;
    setTab("play");
    buzz(18);
    // only scroll when the keys are not already fully on screen (no jump when they are)
    const t = setTimeout(() => {
      const el = keysRef.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      const top = 72; // sticky score bar
      const bottom = window.innerHeight - 84; // tab bar
      if (r.top >= top && r.bottom <= bottom) return;
      const dy = r.bottom > bottom ? Math.min(r.bottom - bottom, r.top - top) : r.top - top;
      window.scrollBy({ top: dy, behavior: reducedMotion() ? "auto" : "smooth" });
    }, 140);
    return () => clearTimeout(t);
  }, [openMid]);

  // switching tabs: start the new tab at the top (and clear the chat badge)
  useEffect(() => {
    if (typeof window === "undefined" || window.innerWidth >= 1024) return;
    if (tab === "chat") setUnread(0);
    window.scrollTo({ top: 0, behavior: "auto" });
  }, [tab]);

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
  // Spoiler shield: while a result is held back, freeze the table and score line as they were before it.
  const safe = useRef<{ board: NonNullable<typeof st>["board"]; scoreline: string | undefined }>({ board: [], scoreline: undefined });
  if (st && !resultHidden) safe.current = { board: delay > 0 && shownResult ? shownResult.board : st.board, scoreline: st.scoreline ?? undefined };
  const board = resultHidden ? safe.current.board : delay > 0 && shownResult ? shownResult.board : st?.board ?? [];
  const scoreline = resultHidden ? safe.current.scoreline : st?.scoreline ?? undefined;
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
    const base = right && st?.moment?.mid === shownResult.mid ? st.moment.options.find((o) => o.id === pick)?.points : undefined;
    const pts = base === undefined ? undefined : base + (streak >= 2 ? STREAK_BONUS : 0);
    setCelebrate({ key: shownResult.mid, result: shownResult, pick: pick ?? null, right, sport: st?.room.sport ?? "other", points: pts });
    if (right) buzz([20, 40, 30]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shownResult, myCalls, st?.room.sport]);

  // auto-close each celebration on its own clock (nothing else can cancel it)
  const celebrateKey = celebrate?.key;
  const celebrateRight = !!celebrate?.right;
  useEffect(() => {
    if (!celebrateKey) return;
    const t = setTimeout(() => setCelebrate((c) => (c?.key === celebrateKey ? null : c)), celebrateRight ? 2600 : 1900);
    return () => clearTimeout(t);
  }, [celebrateKey, celebrateRight]);

  useEffect(() => {
    if (results.length && firstLoad.current && shownResult) {
      firstLoad.current = false;
      shownMid.current = shownResult.mid;
    }
  }, [results.length, shownResult]);

  useEffect(() => {
    if (!lockFlash) return;
    buzz(35);
    const t = setTimeout(() => setLockFlash(0), 1100);
    return () => clearTimeout(t);
  }, [lockFlash]);

  // ---------- actions ----------
  async function call(option: string) {
    if (!moment || !me) return;
    if (phase !== "open") {
      setLate("Locked");
      setTimeout(() => setLate(null), 1200);
      return;
    }
    // if our countdown already hit zero we still ask: the server's clock decides and says how late we were
    buzz(12);
    const prev = myPick;
    if (!clientLocked) setMyCalls((m) => ({ ...m, [moment.mid]: option }));
    const r = await api<{ status: string; tally?: TallyCard; at?: number; lockAt?: number }>(`/api/rooms/${id}/call`, { mid: moment.mid, option, tapAt: Date.now() + offset.current });
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
        // The link rides in `text` only: passing `url` too makes WhatsApp show it twice.
        await navigator.share({ title: "Called It", text });
        return;
      } catch {
        /* fall through to copy */
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      toast.show("Room link copied", "mint");
    } catch {
      toast.show(url);
    }
  }

  // ---------- render ----------
  if (missing) {
    return (
      <main className="flood grid min-h-screen place-items-center p-6 text-center">
        <div>
          <Art src="b3/sleep" className="mx-auto w-40" />
          <h1 className="font-arcade mt-4 text-3xl">This room has closed</h1>
          <p className="mt-2 text-on-muted">Rooms close after a stretch of quiet (demo rooms after an hour). Start a fresh one.</p>
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
        ? { status: pushed.s, paused: !!pushed.p, detail: pushed.d, teams: pushed.t.map(([abbr, score, logo]) => ({ abbr, score, logo })) }
        : st?.live
          ? { status: st.live.status, paused: !!st.live.paused, detail: st.live.detail || st.live.statusText, teams: st.live.teams.map((t) => ({ abbr: t.abbr, score: t.score, logo: t.logo })) }
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
  const replayDone = room?.mode === "replay" && st?.replay?.phase === "done";
  const phaseLabel = replayDone ? "FULL TIME" : phase === "waiting" ? "WARM-UP" : open ? "CALLS OPEN" : phase === "pending" ? "UNDER REVIEW" : phase === "settled" ? "SETTLED" : "LOCKED";
  const headline = replayDone
    ? "That was the last ball."
    : open
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
    <main className={`min-h-screen lg:pb-16 ${st?.amHost && st.room.mode === "host" ? "pb-64" : "ra-pad"}`}>
      {/* ===== phones: compact sticky score bar (one glance: where, score, live, your points) ===== */}
      <div className="led sticky top-0 z-30 !rounded-none !border-x-0 !border-t-0 px-2.5 py-1.5 text-paper !shadow-[0_3px_0_var(--shadow)] sm:hidden">
        <div className="flex h-11 items-center gap-2">
          <Link href="/" className="grid h-11 w-11 shrink-0 place-items-center" aria-label="Home">
            <span className="grid h-9 w-9 place-items-center rounded-lg border-2 border-ink bg-orange">
              <Art src={SPORT_ART[sport].bolo} className="h-8 w-8" />
            </span>
          </Link>
          <button
            type="button"
            onClick={() => liveStatus === "offline" && setRetry((n) => n + 1)}
            className="min-w-0 flex-1 text-left"
            aria-label={liveStatus === "offline" ? "Reconnect" : room?.name ?? "Room"}
          >
            <span className="flex min-w-0 items-center gap-1.5">
              {liveStatus === "live" ? <span className="live-dot !h-2 !w-2 shrink-0" /> : <span className="h-2 w-2 shrink-0 animate-pulse rounded-full bg-white/40" />}
              <span className="font-arcade truncate text-[13px] leading-tight">{room?.name ?? "Tuning in…"}</span>
            </span>
            <span className="font-led led-text block truncate text-[16px] leading-tight">
              {liveStatus === "offline"
                ? "RECONNECTING · TAP"
                : liveView && liveView.teams.length === 2
                  ? `${liveView.paused ? "BREAK · " : ""}${liveView.teams[0].abbr} ${shortScore(liveView.teams[0].score)} · ${liveView.teams[1].abbr} ${shortScore(liveView.teams[1].score)}`
                  : scoreline ?? (room?.mode === "replay" ? st?.replay?.setup : liveStatus === "connecting" ? "TUNING IN…" : "")}
            </span>
          </button>
          <div className="shrink-0 text-right leading-none" aria-label={`${myPoints} points${people ? `, ${people} in the room` : ""}`}>
            <span key={myPoints} className="font-led led-text ra-points block text-[26px] leading-none">{myPoints}</span>
            <span className="font-led block text-[11px] leading-none text-paper/55">{people ? `PTS · ${people} IN` : "PTS"}</span>
          </div>
          <button className="key key-sm h-10 shrink-0 !px-3 !py-0 text-[13px]" onClick={invite} aria-label="Invite friends">
            Invite
          </button>
        </div>
      </div>

      {/* ===== top bar (tablet/desktop) ===== */}
      <header className="flood max-sm:hidden">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 pt-4">
          <Brand />
          <div className="flex items-center gap-2">
            <ThemeToggle />
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
                  {room ? `${SPORT_LABEL[sport].toUpperCase()} · ${room.mode === "replay" ? "REPLAY" : "HOST MODE"}` : "LOADING ROOM…"}
                  {room?.demo && " · WITH DEMO BOTS"}
                </p>
                <p className="font-arcade truncate text-xl sm:text-2xl">{room?.name ?? "Loading…"}</p>
              </div>
            </div>
            <div className="min-w-0 text-left sm:text-center">
              {liveView && liveView.teams.length === 2 ? (
                <div className="mx-auto w-full max-w-md">
                  {/* two-row scoreboard: flag · team · score (scores right-aligned) */}
                  <div key={pushed?.at ?? 0} className="score-flash overflow-hidden rounded-xl border-2 border-white/10">
                    {liveView.teams.map((t, i) => (
                      <div key={t.abbr + i} className={`flex items-center gap-3 px-3 py-1.5 ${i === 0 ? "border-b border-white/10" : ""}`}>
                        {t.logo ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={t.logo} alt="" className="h-6 w-8 shrink-0 object-contain" />
                        ) : (
                          <span className="h-6 w-8 shrink-0" />
                        )}
                        <span className="font-led w-16 shrink-0 text-left text-2xl leading-none text-paper/85 sm:text-[1.7rem]">{t.abbr}</span>
                        <span className="font-led led-text min-w-0 flex-1 truncate text-right text-2xl leading-none sm:text-[1.7rem]">{t.score || "–"}</span>
                      </div>
                    ))}
                  </div>
                  <p className="mt-2 line-clamp-2 text-left text-[13px] font-semibold leading-snug text-paper/70 sm:text-center">
                    {liveView.status === "live" && (
                      <span className={`mr-1.5 inline-block rounded px-1.5 align-middle text-[10px] font-extrabold tracking-wider ${liveView.paused ? "bg-k-butter text-ink" : "bg-red text-white"}`}>
                        {liveView.paused ? "BREAK" : "LIVE"}
                      </span>
                    )}
                    {liveView.detail}
                  </p>
                  {pushed && <p className="font-led mt-0.5 text-sm text-paper/40 sm:text-center">UPDATED VIA NEXCONN PUSH</p>}
                </div>
              ) : (
                <p className="font-led led-text text-[1.7rem] leading-none sm:truncate sm:text-4xl">
                  {scoreline ?? (room?.mode === "replay" ? st?.replay?.setup : "SCORE LINE APPEARS HERE")}
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
                <button onClick={() => liveStatus === "offline" && setRetry((n) => n + 1)} className="font-led text-xl">
                  {liveStatus === "live" ? `LIVE · ${people ?? "…"}` : liveStatus === "connecting" ? "TUNING IN" : "RECONNECTING · TAP"}
                </button>
              </div>
              <div className="text-right">
                <p className="font-led text-lg leading-none text-paper/55">YOU</p>
                <p className="font-led led-text text-4xl leading-none">{myPoints}</p>
              </div>
            </div>
          </div>
        </div>
      </header>

      <div className="mx-auto mt-3 max-w-7xl overflow-x-clip px-3 sm:mt-6 sm:px-4">
        <div className="grid grid-cols-1 gap-4 lg:gap-6 lg:grid-cols-[17rem_minmax(0,1fr)_21rem] [&>*]:min-w-0">
          {/* ===== LEFT: you + table ===== */}
          <aside className={`flex flex-col gap-4 lg:gap-6 ${tab === "board" ? "" : "max-lg:hidden"}`}>
            <section className="brut rounded-[20px] bg-paper p-4 text-ink">
              <div className="flex items-center gap-3">
                <Avatar id={me?.avatar ?? st?.names[me?.userId ?? ""]?.avatar} size={48} className="border-2 border-ink" />
                <div className="min-w-0">
                  <p className="font-arcade truncate text-lg">{me?.name ?? "Guest"}</p>
                  <p className="text-xs font-bold text-muted">{myRank >= 0 ? `#${myRank + 1} in this room` : "Make a call to get on the table"}</p>
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
            <button
              type="button"
              onClick={() => window.dispatchEvent(new Event("ci:nexconn"))}
              className="brut-sm flex min-h-12 items-center gap-2.5 rounded-2xl bg-stage-2 px-4 text-left text-sm font-bold lg:hidden"
            >
              <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${liveStatus === "live" ? "bg-lime" : "bg-[#888]"}`} />
              <span className="flex-1">Nexconn inside: live SDK log</span>
              <span className="font-led text-lg text-on-muted">{stats.cards} CARDS</span>
            </button>
          </aside>

          {/* ===== CENTRE: the moment ===== */}
          <div className={`flex flex-col gap-4 lg:gap-6 ${tab === "play" ? "" : "max-lg:hidden"}`}>
            <section className={`brut-lg relative overflow-hidden rounded-[24px] bg-paper text-ink ${late ? "shake" : ""}`}>
              {/* pitch strip */}
              <div className="turf relative flex items-center justify-between gap-2 border-b-[3px] border-ink px-3 py-1.5 sm:h-32 sm:items-end sm:px-5 sm:pb-2 sm:pt-0">
                <div className="flex min-w-0 flex-1 flex-col items-start gap-1 sm:pb-1">
                  <span
                    className={`font-led rounded-md border-2 border-ink px-2 text-lg leading-tight shadow-[0_2px_0_var(--shadow)] sm:text-xl ${
                      open ? "bg-lime" : phase === "pending" ? "bg-yellow" : phase === "settled" ? "bg-paper" : phase === "waiting" ? "bg-sand" : "bg-red text-white"
                    }`}
                  >
                    {phaseLabel}
                  </span>
                  {moment?.ball && (
                    <span className="font-led max-w-full truncate rounded-md bg-black/55 px-2 text-[15px] leading-snug text-paper sm:text-lg">
                      OVER {moment.ball.over} · {moment.ball.bowler} → {moment.ball.batter}
                    </span>
                  )}
                </div>
                <Art key={bolo} src={bolo} className="pop-in h-12 w-12 shrink-0 drop-shadow-[2px_3px_0_rgba(0,0,0,.35)] sm:-mb-6 sm:h-36 sm:w-36" />
              </div>

              <div className="px-3.5 pb-4 pt-3 sm:p-6">
                <p className="text-sm font-bold text-muted max-sm:hidden">{headline}</p>
                <p className={`text-[13px] font-extrabold sm:hidden ${open && !myPick ? "text-orange-d" : "text-muted"}`}>
                  {open ? (myPick ? "Call in. Switch until the buzzer." : "Tap a key. Calls lock at the buzzer.") : headline}
                </p>
                <h2 className="font-arcade mt-0.5 text-xl leading-tight sm:mt-1 sm:text-4xl">
                  {replayDone ? "FULL TIME" : moment?.q ?? (!room ? "Getting the room ready…" : room.mode === "replay" ? "First ball coming up…" : st?.amHost ? "Ask the room something" : "The host is picking the moment")}
                </h2>
                {moment?.ball?.need && <p className="font-led mt-1 text-2xl text-orange-d max-sm:hidden">{moment.ball.need.toUpperCase()}</p>}

                {/* lock fuse */}
                {phase === "open" && lockIn !== null && (
                  <div className="mt-2.5 flex items-center gap-2 sm:mt-4" role="timer" aria-label={`${Math.ceil(Math.max(0, lockIn) / 1000)} seconds to lock`}>
                    <Art src="b2/stopwatch" className={`h-7 w-7 ${lockIn > 0 && lockIn < 2000 ? "shake" : ""}`} />
                    <div className="flex flex-1 gap-[3px]">
                      {Array.from({ length: 24 }).map((_, k) => {
                        const frac = Math.max(0, lockIn / Math.max(1, (moment!.lockAt ?? 0) - moment!.openAt));
                        return <span key={k} className={`h-3.5 flex-1 rounded-[3px] border border-ink/40 sm:h-4 ${k / 24 < frac ? (lockIn < 2000 ? "bg-red" : "bg-orange") : "bg-sand"}`} />;
                      })}
                    </div>
                    <span className={`font-led w-14 text-right text-[28px] leading-none sm:w-16 sm:text-3xl ${lockIn < 2000 ? "text-red" : ""}`}>{Math.max(0, lockIn / 1000).toFixed(1)}s</span>
                  </div>
                )}
                {phase === "open" && lockIn === null && (
                  <p className="mt-3 inline-flex items-center gap-2 text-sm font-bold">
                    <span className="live-dot" /> Open until the host taps Lock
                  </p>
                )}

                {/* options: arcade keycaps */}
                {moment && (
                  <div ref={keysRef} className={`mt-3 grid scroll-mt-20 gap-2.5 sm:mt-6 sm:gap-3.5 ${moment.options.length > 4 ? "grid-cols-2 sm:grid-cols-3" : "grid-cols-2"}`}>
                    {moment.options.map((o, i) => {
                      const count = st?.tally?.mid === moment.mid ? st.tally.counts[o.id] ?? 0 : 0;
                      const total = st?.tally?.mid === moment.mid ? st.tally.total : 0;
                      const pct = total ? Math.round((count / total) * 100) : 0;
                      const picked = myPick === o.id;
                      const settledHere = phase === "settled" && shownResult?.mid === moment.mid;
                      const isResult = settledHere && shownResult!.outcome === o.id;
                      const missed = settledHere && picked && !isResult;
                      const hostView = !!st?.amHost && room?.mode === "host";
                      const closed = !open || hostView;
                      const dim = closed && !picked && !isResult;
                      return (
                        <button
                          key={o.id}
                          data-key={o.id}
                          onClick={() => !hostView && call(o.id)}
                          disabled={!me || hostView}
                          aria-pressed={picked}
                          aria-label={`${o.label}, ${o.points} points${picked ? ", your call" : ""}${isResult ? ", the result" : ""}`}
                          className={`ra-key group relative overflow-hidden rounded-2xl border-[2.5px] border-ink text-left transition-all duration-100 ${
                            isResult ? "bg-lime" : missed ? "bg-k-rose" : picked ? "bg-orange" : KEY_FACES[i % KEY_FACES.length]
                          } ${
                            picked || isResult
                              ? "translate-y-[4px] shadow-[0_2px_0_var(--shadow)]"
                              : dim
                                ? "opacity-50 shadow-[0_4px_0_var(--shadow)]"
                                : "shadow-[0_6px_0_var(--shadow)] hover:-translate-y-0.5 hover:shadow-[0_8px_0_var(--shadow)]"
                          } ${isResult ? "ring-[3px] ring-ink ring-offset-2 ring-offset-paper" : ""}`}
                        >
                          <div className="flex min-h-[3.9rem] items-center gap-2 px-2.5 pb-2 pt-3 sm:gap-3 sm:px-3.5 sm:pb-3 sm:pt-3">
                            <span className="font-led grid h-9 min-w-9 shrink-0 place-items-center rounded-lg border-2 border-ink bg-paper px-1 text-xl transition-transform group-hover:-rotate-6 sm:h-11 sm:min-w-11 sm:rounded-xl sm:text-2xl">
                              +{o.points}
                            </span>
                            <div className="min-w-0 flex-1">
                              <p className="font-arcade text-[14px] leading-[1.05] sm:text-base">{o.label}</p>
                              <p className="font-led text-[17px] leading-none text-ink/60">{total ? `${count} · ${pct}%` : "–"}</p>
                            </div>
                            {isResult && <Art src={picked ? "b2/crown" : "b2/check"} className="pop-in h-10 w-10 shrink-0 max-sm:hidden" />}
                            {missed && <Art src="b2/cross" className="pop-in h-9 w-9 shrink-0 max-sm:hidden" />}
                          </div>
                          <div className={`relative border-t-2 border-ink bg-black/10 ${picked || isResult ? "h-5" : "h-2"}`}>
                            <div className={`h-full transition-[width] duration-500 ${picked || isResult ? "bg-ink/25" : "bg-ink/70"}`} style={{ width: `${pct}%` }} />
                            {(picked || isResult) && (
                              <span
                                className={`font-led pop-in absolute inset-0 grid place-items-center text-[15px] leading-none tracking-wider ${
                                  isResult || !missed ? "bg-ink text-paper" : "bg-paper/70 text-ink"
                                }`}
                              >
                                {isResult ? (picked ? "YOU CALLED IT" : "RESULT") : missed ? "YOUR CALL" : open ? "YOUR CALL" : "LOCKED IN"}
                              </span>
                            )}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}

                {!moment && (
                  <div className="mt-4 rounded-2xl border-2 border-dashed border-ink/35 bg-k-butter/50 p-4 text-center text-sm text-muted sm:mt-5 sm:p-5">
                    {!room
                      ? "Tuning in to the room…"
                      : st?.amHost
                      ? "Use the host controls: pick a question, tap Go, then tap Lock the moment it happens."
                      : room?.mode === "replay"
                        ? "The first ball is coming up…"
                        : "Calls appear here the moment the host opens them. Chat in the dugout while you wait."}
                  </div>
                )}

                {phase === "pending" && (
                  <div className="mt-4 flex items-center gap-3 rounded-2xl border-2 border-ink bg-yellow p-3 sm:mt-5">
                    <Art src="b2/replay" className="h-10 w-10" />
                    <p className="text-sm font-bold">Points wait for the decision. Nobody scores until it&apos;s confirmed.</p>
                  </div>
                )}
                {phase === "settled" && shownResult?.mid === moment?.mid && shownResult && (
                  <div className="rise mt-4 flex flex-wrap items-center gap-x-3 gap-y-2 rounded-2xl border-2 border-ink bg-k-leaf p-3 sm:mt-5">
                    <Art src="b2/scoreboard" className="h-9 w-9 shrink-0 sm:h-10 sm:w-10" />
                    <p className="min-w-[12rem] flex-1 text-sm leading-snug">
                      <b>{shownResult.label}.</b> {shownResult.detail} · {shownResult.winners.length} of {shownResult.total} called it
                    </p>
                    {myCalls[shownResult.mid] === shownResult.outcome && <ShareCalled label={shownResult.label} room={room?.name ?? "the match"} id={id} toast={toast.show} />}
                  </div>
                )}
                {room?.mode === "replay" && st?.replay?.phase === "done" && !resultHidden && (
                  <FullTime
                    right={rightCount}
                    called={calledCount}
                    total={st.replay.total}
                    points={myPoints}
                    board={board}
                    meId={me?.userId}
                    toast={toast.show}
                  />
                )}
                {delay > 0 && resultHidden && <p className="font-led mt-3 flex items-center gap-1.5 text-lg text-muted"><Art src="b2/lock" className="h-6 w-6" /> SPOILER SHIELD HOLDING THIS RESULT FOR {delay}S</p>}
              </div>

              {(lockFlash > 0 || late) && (
                <div className="pointer-events-none absolute inset-0 grid place-items-center">
                  <div className="stamp text-center">
                    <span className="font-arcade inline-flex items-center gap-2 rounded-2xl border-[3px] border-ink bg-red px-4 py-2 text-3xl text-white shadow-[5px_5px_0_var(--shadow)] sm:text-5xl">
                      <Art src="b2/lock" className="h-9 w-9 sm:h-12 sm:w-12" /> LOCKED
                    </span>
                    {late && late !== "Locked" && <p className="font-led mt-1 rounded-lg bg-ink px-3 py-0.5 text-2xl text-paper">{late.toUpperCase()}</p>}
                  </div>
                </div>
              )}
            </section>

            {st?.amHost && room?.mode === "host" && (
              <>
                <HostBar
                  id={id}
                  sport={sport}
                  st={st}
                  onDone={fetchState}
                  toast={toast.show}
                  onOptimistic={(state) => {
                    if (state === null) return void fetchState();
                    setSt((x) => (x && x.moment ? { ...x, moment: { ...x.moment, state: state as "open" | "locked" | "pending" | "settled" } } : x));
                  }}
                />
                <div id="host-more">
                  <HostPanel id={id} sport={sport} st={st} onDone={fetchState} toast={toast.show} />
                </div>
              </>
            )}

            {/* ball-by-ball strip */}
            <section className="brut rounded-[20px] bg-stage-2 p-3.5 sm:p-4">
              <div className="flex items-center justify-between gap-2">
                <p className="font-led text-xl sm:text-2xl">THIS SESSION</p>
                <p className="font-led text-lg text-on-muted sm:text-xl">
                  {rightCount} RIGHT · {calledCount} CALLED
                </p>
              </div>
              <div className="scroll-thin ra-strip mt-2.5 flex gap-2.5 overflow-x-auto pb-2 pt-1">
                {visibleResults.length === 0 && <p className="text-sm text-on-muted">Every settled moment lands here as a ball: bright if you called it right, crossed if you missed.</p>}
                {visibleResults.map((r) => {
                  const pick = myCalls[r.mid];
                  const right = !!pick && pick === r.outcome;
                  return (
                    <button key={r.mid} type="button" className="group relative shrink-0 outline-none" aria-label={`${r.label}: ${r.detail ?? ""}`}>
                      <div
                        className={`rise grid h-12 w-12 place-items-center rounded-full border-[2.5px] border-ink text-sm font-black shadow-[0_3px_0_var(--shadow)] transition-transform group-hover:-translate-y-1 ${
                          pick ? (right ? "bg-lime text-ink" : "bg-k-rose text-ink") : "border-dashed bg-sand text-ink opacity-60"
                        }`}
                      >
                        {short(r.label)}
                        {pick && !right && (
                          <span aria-hidden className="absolute -right-1 -top-1 grid h-5 w-5 place-items-center rounded-full border-2 border-ink bg-red text-[11px] font-black leading-none text-paper">
                            ✕
                          </span>
                        )}
                      </div>
                      <div className="pointer-events-none absolute bottom-full left-1/2 z-20 mb-2 hidden w-44 -translate-x-1/2 rounded-xl border-2 border-ink bg-paper p-2 text-xs text-ink shadow-[0_3px_0_var(--shadow)] group-hover:block group-focus:block">
                        <b>{r.label}</b> · {r.detail ?? ""}
                        <br />
                        {r.winners.length}/{r.total} called it{pick ? (right ? " · you too ✓" : " · not you") : ""}
                      </div>
                    </button>
                  );
                })}
              </div>
            </section>

          </div>

          {/* ===== RIGHT: the dugout ===== */}
          <div className={`flex flex-col gap-4 lg:gap-6 ${tab === "chat" ? "" : "max-lg:hidden"}`}>
            {CALLS_ENABLED && (
            <div className="max-lg:order-2">
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
            </div>
            )}
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
              kb={kb}
              active={tab === "chat"}
              canMute={!!st?.amHost && room?.mode === "host"}
              roomId={id}
              toast={toast.show}
            />
          </div>
        </div>
      </div>

      {/* mobile tab bar */}
      <nav
        aria-label="Room"
        className={`ra-tabbar fixed inset-x-3 z-40 grid grid-cols-3 gap-1 rounded-2xl border-[2.5px] border-ink bg-stage-2 p-1 shadow-[0_4px_0_var(--shadow)] lg:hidden ${kb ? "hidden" : ""}`}
      >
        {(
          [
            ["play", "Play", "b2/foam-finger"],
            ["board", "Table", "b2/trophy"],
            ["chat", "Dugout", "b2/megaphone"],
          ] as const
        ).map(([k, label, art]) => {
          // the host's thumb bar lives on Play: when a call needs the host, the Play tab says what to tap
          const hostNeed =
            st?.amHost && room?.mode === "host" && moment
              ? moment.state === "open"
                ? "LOCK"
                : moment.state === "locked" || moment.state === "pending"
                  ? "RESULT"
                  : null
              : null;
          const badge =
            k === "chat" && tab !== "chat" && unread > 0
              ? String(unread > 9 ? "9+" : unread)
              : k === "play" && tab !== "play" && hostNeed
                ? hostNeed
                : k === "play" && tab !== "play" && open && !myPick
                  ? "!"
                  : null;
          return (
            <button
              key={k}
              onClick={() => setTab(k)}
              aria-current={tab === k ? "page" : undefined}
              aria-label={badge ? `${label} (${k === "chat" ? `${unread} new` : badge === "LOCK" ? "lock the call" : badge === "RESULT" ? "call the result" : "a call is open"})` : label}
              className={`relative flex h-12 flex-col items-center justify-center rounded-xl text-[12px] font-extrabold leading-none transition-all ${
                tab === k ? "bg-orange text-ink shadow-[0_3px_0_var(--shadow)]" : "text-on-muted active:bg-stage-3"
              }`}
            >
              <Art src={art} className={`h-6 w-6 ${tab === k ? "" : "opacity-80"}`} />
              <span className="mt-0.5">{label}</span>
              {badge && <span className={`ra-badge ${badge === "!" || badge === "LOCK" || badge === "RESULT" ? "ra-nudge" : ""} ${badge.length > 2 ? "!w-auto !px-1.5 text-[10px]" : ""}`}>{badge}</span>}
            </button>
          );
        })}
      </nav>

      <div className="pointer-events-none fixed inset-x-0 bottom-28 z-40 h-0 overflow-visible">
        {floats.map((f) => (
          <span key={f.id} className="float-up absolute" style={{ left: `${f.x}%`, ["--r" as string]: `${(f.x - 50) / 3}deg` }}>
            <Art src={REACTION_ART[f.e as Reaction]?.art ?? "b5/heart"} className="h-14 w-14 drop-shadow-[2px_3px_0_rgba(0,0,0,.35)]" />
          </span>
        ))}
      </div>

      {celebrate && <Celebration c={celebrate} onClose={() => setCelebrate(null)} />}
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
                className="min-h-11 min-w-11 rounded-lg border-2 border-paper/40 px-2 text-xs font-bold hover:bg-red lg:hidden lg:group-hover:inline"
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
  kb,
  active,
  canMute,
  roomId,
  toast,
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
  kb: boolean;
  active: boolean;
  canMute: boolean;
  roomId: string;
  toast: (t: string, tone?: "ink" | "red" | "mint") => void;
}) {
  const [text, setText] = useState("");
  const [muteFor, setMuteFor] = useState<string | null>(null);
  const [warn, setWarn] = useState<string | null>(null);
  const [below, setBelow] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);
  const atBottom = useRef(true);
  const seen = useRef(0);
  const visible = chat.filter((l) => l.showAt <= now);
  const held = chat.length - visible.length;

  // stay pinned to the newest line only while the reader is already at the bottom
  useEffect(() => {
    const el = listRef.current;
    const added = visible.length - seen.current;
    seen.current = visible.length;
    if (!el || added <= 0) return;
    const mine = visible[visible.length - 1]?.from === meId;
    if (atBottom.current || mine) {
      el.scrollTo({ top: el.scrollHeight, behavior: reducedMotion() ? "auto" : "smooth" });
      setBelow(0);
    } else setBelow((n) => n + added);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible.length]);

  // phones: the Dugout was hidden while lines arrived; land on the newest when it opens
  useEffect(() => {
    const el = listRef.current;
    if (!active || !el) return;
    requestAnimationFrame(() => {
      el.scrollTop = el.scrollHeight;
      atBottom.current = true;
      setBelow(0);
    });
  }, [active]);

  async function muteUser(uid: string) {
    setMuteFor(null);
    const r = await api(`/api/rooms/${roomId}/host`, { action: "mute", userId: uid, minutes: 10 });
    toast(r.ok ? `${nameOf(uid)} is muted for 10 minutes` : (r.data as { error?: string }).error ?? "Mute failed", r.ok ? "mint" : "red");
  }

  // keyboard opened: keep the newest lines in view above it
  useEffect(() => {
    const el = listRef.current;
    if (kb && el && atBottom.current) el.scrollTop = el.scrollHeight;
  }, [kb]);

  const jump = () => {
    const el = listRef.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
    setBelow(0);
  };

  return (
    <section
      className={`ra-chat brut relative flex min-h-[16rem] flex-col overflow-hidden rounded-[20px] bg-stage-2 max-lg:order-1 ${kb ? "ra-kb" : ""}`}
    >
      <div className={`flex items-center justify-between gap-2 border-b-2 border-ink bg-stage-3 px-3 sm:px-4 ${kb ? "py-1" : "py-1.5 sm:py-3"}`}>
        <div className="flex min-w-0 items-center gap-2">
          <Art src="b2/megaphone" className="h-7 w-7 shrink-0 sm:h-8 sm:w-8" />
          <p className="font-arcade truncate text-base sm:text-lg">Dugout</p>
        </div>
        <label className="flex min-h-11 shrink-0 items-center gap-1.5 text-xs font-bold" title="Hold results and chat to match a delayed stream">
          <Art src="b2/stopwatch" className="h-6 w-6" /> Spoiler shield
          <select
            aria-label="Spoiler shield delay"
            className="font-led h-10 rounded-lg border-2 border-ink bg-paper px-1.5 text-lg text-ink outline-none transition hover:bg-yellow"
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
      <div
        ref={listRef}
        onScroll={(e) => {
          const el = e.currentTarget;
          atBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 48;
          if (atBottom.current && below) setBelow(0);
        }}
        className="scroll-thin ra-chatlist flex min-h-0 flex-1 flex-col gap-2.5 overflow-y-auto px-3 py-3 sm:px-4"
      >
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
                {l.from !== meId &&
                  (canMute && !l.from.startsWith("bot_") ? (
                    <button
                      type="button"
                      className="-my-1 flex min-h-7 items-center gap-1 text-[11px] font-extrabold text-orange-d"
                      aria-label={`${nameOf(l.from)}: host options`}
                      onClick={() => setMuteFor((v) => (v === l.id ? null : l.id))}
                    >
                      <bdi>{nameOf(l.from)}</bdi> <span aria-hidden>▾</span>
                    </button>
                  ) : (
                    <p className="text-[11px] font-extrabold text-orange-d">
                      <bdi>{nameOf(l.from)}</bdi>
                      {l.from.startsWith("bot_") && <BotTag />}
                    </p>
                  ))}
                <p className="break-words text-sm">{l.text}</p>
                {muteFor === l.id && (
                  <button type="button" className="key key-sm mt-1.5 !min-h-9 !bg-red !text-paper" onClick={() => muteUser(l.from)}>
                    Mute 10 min
                  </button>
                )}
              </div>
            </div>
          ),
        )}
        {held > 0 && <p className="font-led flex items-center justify-center gap-1.5 text-lg text-on-muted"><Art src="b2/stopwatch" className="h-5 w-5" /> {held} HELD FOR YOUR STREAM DELAY</p>}
      </div>
      {below > 0 && (
        <button
          type="button"
          onClick={jump}
          className="brut-sm rise absolute left-1/2 z-10 -translate-x-1/2 rounded-full bg-orange px-4 py-2 text-xs font-extrabold text-ink"
          style={{ bottom: kb ? "4.25rem" : "8.25rem" }}
        >
          {below} new {below === 1 ? "message" : "messages"} below
        </button>
      )}
      <div className={`flex justify-between gap-1 border-t-2 border-ink px-3 pt-2 ${kb ? "hidden" : ""}`}>
        {REACTIONS.map((e) => (
          <button
            key={e}
            onClick={() => onReact(e)}
            className="ra-key grid h-11 w-11 place-items-center rounded-xl border-2 border-ink bg-paper shadow-[0_3px_0_var(--shadow)] transition-all hover:-translate-y-1 hover:rotate-12 active:translate-y-[2px] active:shadow-none"
            aria-label={REACTION_ART[e].label}
            title={REACTION_ART[e].label}
          >
            <Art src={REACTION_ART[e].art} className="h-8 w-8" />
          </button>
        ))}
      </div>
      <form
        className="flex gap-2 p-2.5 sm:p-3"
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
          className={`input min-w-0 !py-2.5 !text-base ${warn ? "!border-red" : ""}`}
          enterKeyHint="send"
          aria-label="Chat message"
          placeholder={muted ? "The host muted you for a bit" : "Say something about the match…"}
          value={text}
          maxLength={200}
          disabled={muted}
          onChange={(e) => {
            setText(e.target.value);
            setWarn(blockReason(e.target.value));
          }}
        />
        <button className="key min-h-11 shrink-0 !px-4" disabled={muted || !text.trim()}>
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
        await shareOrCopy("I called it", text, toast);
      }}
    >
      Brag: I called it
    </button>
  );
}

/** Phone score bar: "368 & 33/1 (11 ov)" → "368 & 33/1" so both teams fit on one line. */
function shortScore(score?: string) {
  return (score || "-").replace(/\s*\([^)]*\)/g, "").trim() || "-";
}

/** Native share sheet when there is one; otherwise copy. Cancelling the sheet does nothing. */
async function shareOrCopy(title: string, text: string, toast: (t: string, tone?: "ink" | "red" | "mint") => void) {
  if (navigator.share) {
    try {
      await navigator.share({ title, text });
      return;
    } catch (e) {
      if ((e as { name?: string })?.name === "AbortError") return;
    }
  }
  try {
    await navigator.clipboard.writeText(text);
    toast("Copied. Paste it anywhere.", "mint");
  } catch {
    toast("Couldn't copy. Long-press to select instead.", "red");
  }
}

/** End of the replay: the result, your score, the table, and a way to go again. */
function FullTime({
  right,
  called,
  total,
  points,
  board,
  meId,
  toast,
}: {
  right: number;
  called: number;
  total: number;
  points: number;
  board: { id: string; name: string; points: number }[];
  meId?: string;
  toast: (t: string, tone?: "ink" | "red" | "mint") => void;
}) {
  const top = board.slice(0, 3);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const t = setTimeout(() => ref.current?.scrollIntoView({ behavior: reducedMotion() ? "auto" : "smooth", block: "center" }), 900);
    return () => clearTimeout(t);
  }, []);
  return (
    <div ref={ref} className="rise mt-4 scroll-mb-28 rounded-2xl border-2 border-ink bg-yellow p-4 text-ink shadow-[0_3px_0_var(--shadow)] sm:mt-5">
      <p className="font-led text-xl leading-none">FULL TIME</p>
      <p className="font-display mt-1 text-xl font-extrabold leading-tight">India win by 7 runs. World champions.</p>
      <p className="mt-2 text-sm font-bold">
        You called {right} of {total} right{called < total ? ` (${called} called)` : ""} · {points} pts
      </p>
      {top.length > 0 && (
        <ol className="mt-3 flex flex-col gap-1 text-sm">
          {top.map((b, i) => (
            <li key={b.id} className={`flex items-center gap-2 rounded-lg px-2 py-1 ${b.id === meId ? "bg-orange" : "bg-paper/70"}`}>
              <span className="font-led w-5 text-lg">{i + 1}</span>
              <bdi className="flex-1 truncate font-bold">{b.name}</bdi>
              <span className="font-led text-lg">{b.points}</span>
            </li>
          ))}
        </ol>
      )}
      <div className="mt-3 flex flex-wrap gap-2">
        {/* a full page load starts a fresh demo room */}
        <a href="/try" className="key flex-1 !min-h-12 text-base" onClick={(e) => (e.preventDefault(), location.assign("/try"))}>
          Play again
        </a>
        <button
          type="button"
          className="key key-paper flex-1 !min-h-12 text-base"
          onClick={() =>
            shareOrCopy(
              "Called It",
              `I called ${right} of ${total} balls of the 2024 T20 World Cup final finish on Called It. Beat that: ${location.origin}/try`,
              toast,
            )
          }
        >
          Share my score
        </button>
      </div>
      <Link href="/" className="mt-3 block text-center text-sm font-bold underline underline-offset-4">
        Start a room for a live match
      </Link>
    </div>
  );
}
