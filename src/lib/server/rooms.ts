import "server-only";
import { randomBytes } from "node:crypto";
import {
  CRICKET_BALL,
  MT,
  PRESETS,
  STREAK_BONUS,
  type MomentCard,
  type Option,
  type ResultCard,
  type RoomPublic,
  type RoomState,
  type Sport,
  type TallyCard,
} from "@/lib/game";
import replayData from "@/data/t20wc2024final.json";
import { createOpenChannel, sendToRoom, setRoomMetadata } from "./nexconn";
import {
  callIfOpen,
  getJSON,
  hgetall,
  hset,
  incr,
  lease,
  patchMoment,
  release,
  sadd,
  setJSON,
  setMoment,
  zincr,
  ztop,
} from "./store";
import { BOT_NAMES, botCall, botLine } from "./bots";

type ReplayBall = {
  over: number;
  bowler: string;
  batter: string;
  runs: number;
  outcome: string;
  score: string;
  wicket: string | null;
};
const REPLAY = replayData as { title: string; setup: string; target: number; balls: ReplayBall[]; source: string };

const K = {
  room: (id: string) => `room:${id}`,
  moment: (id: string) => `room:${id}:m`,
  calls: (id: string, mid: string) => `room:${id}:c:${mid}`,
  names: (id: string) => `room:${id}:names`,
  board: (id: string) => `room:${id}:board`,
  streak: (id: string) => `room:${id}:streak`,
  result: (id: string) => `room:${id}:last`,
  replay: (id: string) => `room:${id}:replay`,
  tickLease: (id: string) => `room:${id}:tick`,
  hostLease: (id: string) => `room:${id}:hostop`,
};

// Replay timing (ms). Long enough to call, short enough for a 60-second judge demo.
const OPEN_MS = 6500;
const REVIEW_MS = 2200;
const GAP_MS = 3200;

export function newRoomId() {
  return randomBytes(4).toString("base64url").replace(/[^a-zA-Z0-9]/g, "k").slice(0, 6).toLowerCase();
}

export async function createRoom(opts: {
  name: string;
  sport: Sport;
  mode: "host" | "replay";
  hostId: string;
  hostName: string;
  demo: boolean;
}) {
  const id = newRoomId();
  const channelId = `ci_${id}`;
  const room: RoomPublic = {
    id,
    name: opts.name,
    sport: opts.sport,
    mode: opts.mode,
    hostId: opts.hostId,
    channelId,
    demo: opts.demo,
    createdAt: Date.now(),
  };
  const r = await createOpenChannel(channelId, { phase: "waiting", room: opts.name });
  if (r.code !== 0) throw new Error(`open channel create failed: ${r.code} ${r.errorMessage ?? ""}`);
  await setJSON(K.room(id), room);
  await hset(K.names(id), opts.hostId, opts.hostName);
  if (opts.mode === "replay") {
    await setJSON(K.replay(id), { index: 0, phase: "idle", nextAt: Date.now() + 2500 });
  }
  if (!opts.demo) {
    await sadd("impact:rooms", id);
  }
  if (opts.demo) {
    for (const [botId, botName] of Object.entries(BOT_NAMES)) await hset(K.names(id), botId, botName);
  }
  return { room, channelMs: r.ms };
}

export async function getRoom(id: string) {
  return getJSON<RoomPublic>(K.room(id));
}

export async function rememberName(roomId: string, userId: string, name: string) {
  await hset(K.names(roomId), userId, name);
}

async function board(roomId: string) {
  const [top, names] = await Promise.all([ztop(K.board(roomId), 10), hgetall(K.names(roomId))]);
  return top.map((t) => ({ name: names[t.member] ?? "Someone", points: t.score }));
}

async function tallyOf(roomId: string, mid: string, options: Option[]): Promise<TallyCard> {
  const calls = await hgetall(K.calls(roomId, mid));
  const counts: Record<string, number> = Object.fromEntries(options.map((o) => [o.id, 0]));
  for (const v of Object.values(calls)) counts[v] = (counts[v] ?? 0) + 1;
  return { mid, counts, total: Object.keys(calls).length };
}

export async function roomState(roomId: string, userId: string | null): Promise<RoomState | null> {
  const room = await getRoom(roomId);
  if (!room) return null;
  const m = await hgetall(K.moment(roomId));
  let moment: RoomState["moment"] = null;
  let tally: TallyCard | null = null;
  let myCall: string | null = null;
  if (m.mid) {
    const card = JSON.parse(m.card) as MomentCard;
    moment = { ...card, state: m.state as "open" | "locked" | "pending" | "settled" };
    tally = await tallyOf(roomId, m.mid, card.options);
    if (userId) myCall = (await hgetall(K.calls(roomId, m.mid)))[userId] ?? null;
  }
  const lastResult = await getJSON<ResultCard>(K.result(roomId));
  const replay =
    room.mode === "replay"
      ? {
          index: ((await getJSON<{ index: number }>(K.replay(roomId)))?.index ?? 0),
          total: REPLAY.balls.length,
          title: REPLAY.title,
          setup: REPLAY.setup,
        }
      : null;
  return {
    room,
    moment,
    lastResult,
    tally,
    board: await board(roomId),
    myCall,
    scoreline: m.scoreline || lastResult?.scoreline || null,
    replay,
  };
}

// ---------- moment lifecycle ----------

export async function openMoment(
  room: RoomPublic,
  q: string,
  options: Option[],
  lockAt: number | null,
  ball?: MomentCard["ball"],
  scoreline?: string,
) {
  const mid = randomBytes(5).toString("hex");
  const card: MomentCard = { mid, q, options, openAt: Date.now(), lockAt, ball };
  await setMoment(K.moment(room.id), {
    mid,
    state: "open",
    lockAt: String(lockAt ?? 0),
    card: JSON.stringify(card),
    scoreline: scoreline ?? "",
  });
  const sent = await sendToRoom(room.channelId, MT.Moment, card, { priority: 2 });
  void setRoomMetadata(room.channelId, { phase: "open", mid, q, ...(scoreline ? { score: scoreline } : {}) });
  if (room.demo) await seedBotCalls(room, card);
  return { card, ms: sent.ms };
}

async function seedBotCalls(room: RoomPublic, card: MomentCard) {
  const ids = Object.keys(BOT_NAMES);
  for (const id of ids) {
    const pick = botCall(card.options, id);
    await hset(K.calls(room.id, card.mid), id, pick);
  }
  const t = await tallyOf(room.id, card.mid, card.options);
  await sendToRoom(room.channelId, MT.Tally, t, { persist: false });
}

/** A player's call. The Lua script refuses anything after the lock. */
export async function placeCall(room: RoomPublic, userId: string, mid: string, optionId: string, now = Date.now()) {
  const m = await hgetall(K.moment(room.id));
  if (!m.mid) return { status: "stale" as const };
  const card = JSON.parse(m.card) as MomentCard;
  if (!card.options.some((o) => o.id === optionId)) return { status: "bad" as const };
  const status = await callIfOpen(K.moment(room.id), K.calls(room.id, mid), mid, userId, optionId, now);
  if (status === "ok") {
    const t = await tallyOf(room.id, mid, card.options);
    void sendToRoom(room.channelId, MT.Tally, t, { persist: false });
    if (!room.demo) {
      await incr("impact:calls");
      await sadd("impact:callers", userId);
    }
    return { status, tally: t };
  }
  return { status, lockAt: Number(m.lockAt) || Date.now() };
}

export async function lockMoment(room: RoomPublic) {
  const m = await hgetall(K.moment(room.id));
  if (!m.mid || m.state !== "open") return null;
  const at = Date.now();
  await patchMoment(K.moment(room.id), { state: "locked", lockAt: String(at) });
  const r = await sendToRoom(room.channelId, MT.Lock, { mid: m.mid, at }, { priority: 2 });
  void setRoomMetadata(room.channelId, { phase: "locked", mid: m.mid });
  return { mid: m.mid, at, ms: r.ms };
}

export async function markPending(room: RoomPublic, reason: string) {
  const m = await hgetall(K.moment(room.id));
  if (!m.mid || (m.state !== "locked" && m.state !== "open")) return null;
  if (m.state === "open") await lockMoment(room);
  await patchMoment(K.moment(room.id), { state: "pending" });
  await sendToRoom(room.channelId, MT.Pending, { mid: m.mid, reason }, { priority: 2 });
  void setRoomMetadata(room.channelId, { phase: "pending", mid: m.mid });
  return { mid: m.mid };
}

export async function settle(room: RoomPublic, outcome: string, detail?: string, scoreline?: string) {
  const m = await hgetall(K.moment(room.id));
  if (!m.mid || m.state === "settled") return null;
  if (m.state === "open") await lockMoment(room);
  const card = JSON.parse(m.card) as MomentCard;
  const opt = card.options.find((o) => o.id === outcome);
  if (!opt) throw new Error("unknown outcome");
  const [calls, names, streaks] = await Promise.all([
    hgetall(K.calls(room.id, m.mid)),
    hgetall(K.names(room.id)),
    hgetall(K.streak(room.id)),
  ]);
  const winners: string[] = [];
  for (const [uid, pick] of Object.entries(calls)) {
    if (pick === outcome) {
      const s = Number(streaks[uid] ?? 0) + 1;
      await hset(K.streak(room.id), uid, String(s));
      await zincr(K.board(room.id), uid, opt.points + (s >= 2 ? STREAK_BONUS : 0));
      winners.push(names[uid] ?? "Someone");
    } else {
      await hset(K.streak(room.id), uid, "0");
      await zincr(K.board(room.id), uid, 0);
    }
  }
  await patchMoment(K.moment(room.id), { state: "settled", scoreline: scoreline ?? m.scoreline ?? "" });
  const result: ResultCard = {
    mid: m.mid,
    outcome,
    label: opt.label,
    detail,
    winners,
    total: Object.keys(calls).length,
    board: await board(room.id),
    scoreline: scoreline || m.scoreline || undefined,
    at: Date.now(),
  };
  await setJSON(K.result(room.id), result);
  const r = await sendToRoom(room.channelId, MT.Result, result, { priority: 2 });
  void setRoomMetadata(room.channelId, { phase: "settled", mid: m.mid, ...(result.scoreline ? { score: result.scoreline } : {}) });
  if (room.demo) {
    const line = botLine(outcome, detail);
    if (line) {
      const [botId] = Object.entries(BOT_NAMES)[Math.floor(Math.random() * 3)];
      void sendToRoom(room.channelId, "RC:TxtMsg", { content: line }, { from: botId, persist: false });
    }
  }
  return { result, ms: r.ms };
}

// ---------- replay driver ----------

function ballOutcome(b: ReplayBall) {
  return b.outcome === "WD" || b.outcome === "NB" ? "EX" : b.outcome;
}

function ballDetail(b: ReplayBall) {
  if (b.wicket) return `OUT! ${b.wicket}`;
  if (b.outcome === "WD") return "Wide";
  if (b.outcome === "NB") return "No ball";
  if (b.runs === 0) return `Dot ball. ${b.bowler} to ${b.batter}`;
  return `${b.runs} run${b.runs > 1 ? "s" : ""}. ${b.batter}`;
}

function needLine(scoreAfter: string, ballIndexAfter: number) {
  const runs = Number(scoreAfter.split("/")[0]);
  const need = REPLAY.target - runs;
  const ballsLeft = REPLAY.balls.filter((b, i) => i >= ballIndexAfter && b.outcome !== "WD" && b.outcome !== "NB").length;
  return need > 0 ? `SA need ${need} off ${ballsLeft}` : "SA win";
}

/**
 * Advance a replay room by at most one step. Any client in the room may call
 * this every second; the server only acts when the stored deadline has passed,
 * so a client cannot speed up or skip the lock.
 */
export async function tick(room: RoomPublic) {
  if (room.mode !== "replay") return { acted: false };
  if (!(await lease(K.tickLease(room.id), 1500))) return { acted: false };
  try {
    const st = (await getJSON<{ index: number; phase: string; nextAt: number }>(K.replay(room.id))) ?? {
      index: 0,
      phase: "idle",
      nextAt: 0,
    };
    const now = Date.now();
    if (now < st.nextAt) return { acted: false };
    const b = REPLAY.balls[st.index];
    if (!b) {
      if (st.phase !== "done") {
        await setJSON(K.replay(room.id), { ...st, phase: "done", nextAt: Number.MAX_SAFE_INTEGER });
        await sendToRoom(room.channelId, "RC:TxtMsg", { content: "🏆 India win by 7 runs. World champions. Final board above." }, { priority: 2 });
      }
      return { acted: false };
    }
    if (st.phase === "idle" || st.phase === "settled") {
      const prev = REPLAY.balls[st.index - 1];
      const before = prev ? prev.score : `${Number(b.score.split("/")[0]) - b.runs}/${Number(b.score.split("/")[1]) - (b.wicket ? 1 : 0)}`;
      const lockAt = now + OPEN_MS;
      await openMoment(
        room,
        "Next ball?",
        CRICKET_BALL,
        lockAt,
        { over: `${b.over}.${ballNo(st.index)}`, bowler: b.bowler, batter: b.batter, score: before, need: needLine(before, st.index) },
        `SA ${before} · ${needLine(before, st.index)}`,
      );
      await setJSON(K.replay(room.id), { index: st.index, phase: "open", nextAt: lockAt });
      return { acted: true };
    }
    if (st.phase === "open") {
      await lockMoment(room);
      if (b.wicket) {
        await markPending(room, "Checking the catch… third umpire");
        await setJSON(K.replay(room.id), { index: st.index, phase: "review", nextAt: now + REVIEW_MS });
        return { acted: true };
      }
      await settle(room, ballOutcome(b), ballDetail(b), `SA ${b.score} · ${needLine(b.score, st.index + 1)}`);
      await setJSON(K.replay(room.id), { index: st.index + 1, phase: "settled", nextAt: now + GAP_MS });
      return { acted: true };
    }
    if (st.phase === "review") {
      await settle(room, ballOutcome(b), ballDetail(b), `SA ${b.score} · ${needLine(b.score, st.index + 1)}`);
      await setJSON(K.replay(room.id), { index: st.index + 1, phase: "settled", nextAt: now + GAP_MS });
      return { acted: true };
    }
    return { acted: false };
  } finally {
    await release(K.tickLease(room.id));
  }
}

function ballNo(index: number) {
  // legal-ball number inside the over (wides and no-balls are re-bowled)
  const b = REPLAY.balls[index];
  let n = 0;
  for (let i = 0; i <= index; i++) {
    const x = REPLAY.balls[i];
    if (x.over === b.over && x.outcome !== "WD" && x.outcome !== "NB") n++;
  }
  return Math.min(Math.max(n, 1), 6);
}

export function presetsFor(sport: Sport) {
  return PRESETS[sport] ?? PRESETS.other;
}

export async function withHostLease<T>(roomId: string, fn: () => Promise<T>): Promise<T | null> {
  if (!(await lease(K.hostLease(roomId), 4000))) return null;
  try {
    return await fn();
  } finally {
    await release(K.hostLease(roomId));
  }
}

export const replayInfo = { title: REPLAY.title, setup: REPLAY.setup, balls: REPLAY.balls.length, source: REPLAY.source };
