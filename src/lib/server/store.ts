import "server-only";
import { Redis } from "@upstash/redis";

/**
 * Tiny storage layer. Upstash Redis in production; an in-memory map for local
 * development when the Upstash variables are missing. The one operation that
 * must be atomic (accepting a call only while the moment is open) is a Lua
 * script in Redis and a synchronous function in memory.
 */

const hasRedis = !!(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN);
// Raw strings in, raw strings out: auto-deserialisation would turn hex ids like "12e45" into numbers.
const redis = hasRedis
  ? new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL!,
      token: process.env.UPSTASH_REDIS_REST_TOKEN!,
      automaticDeserialization: false,
    })
  : null;

type Mem = { kv: Map<string, unknown>; exp: Map<string, number> };
const g = globalThis as unknown as { __ciMem?: Mem };
const mem: Mem = (g.__ciMem ??= { kv: new Map(), exp: new Map() });

function memGet<T>(k: string): T | undefined {
  const e = mem.exp.get(k);
  if (e && e < Date.now()) {
    mem.kv.delete(k);
    mem.exp.delete(k);
    return undefined;
  }
  return mem.kv.get(k) as T | undefined;
}

export const storeKind = hasRedis ? "upstash-redis" : "memory (dev only)";

export async function getJSON<T>(key: string): Promise<T | null> {
  if (redis) {
    const raw = await redis.get<string>(key);
    if (raw === null || raw === undefined) return null;
    try {
      return JSON.parse(raw) as T;
    } catch {
      return raw as unknown as T;
    }
  }
  return (memGet<T>(key) ?? null) as T | null;
}

export async function setJSON(key: string, value: unknown, ttlSec = 60 * 60 * 24 * 14) {
  if (redis) return void (await redis.set(key, JSON.stringify(value), { ex: ttlSec }));
  mem.kv.set(key, structuredClone(value));
  mem.exp.set(key, Date.now() + ttlSec * 1000);
}

export async function hset(key: string, field: string, value: string) {
  if (redis) return void (await redis.hset(key, { [field]: value }));
  const h = (memGet<Record<string, string>>(key) ?? {}) as Record<string, string>;
  h[field] = value;
  mem.kv.set(key, h);
}

export async function hgetall(key: string): Promise<Record<string, string>> {
  if (redis) {
    const raw = (await redis.hgetall<Record<string, unknown>>(key)) as unknown;
    const out: Record<string, string> = {};
    if (Array.isArray(raw)) {
      for (let i = 0; i + 1 < raw.length; i += 2) out[String(raw[i])] = String(raw[i + 1]);
      return out;
    }
    for (const [k, v] of Object.entries((raw ?? {}) as Record<string, unknown>)) out[k] = typeof v === "string" ? v : JSON.stringify(v);
    return out;
  }
  return { ...((memGet<Record<string, string>>(key) ?? {}) as Record<string, string>) };
}

export async function zincr(key: string, member: string, by: number) {
  if (redis) return void (await redis.zincrby(key, by, member));
  const z = (memGet<Record<string, number>>(key) ?? {}) as Record<string, number>;
  z[member] = (z[member] ?? 0) + by;
  mem.kv.set(key, z);
}

export async function ztop(key: string, n: number): Promise<{ member: string; score: number }[]> {
  if (redis) {
    const raw = (await redis.zrange(key, 0, n - 1, { rev: true, withScores: true })) as (string | number)[];
    const out: { member: string; score: number }[] = [];
    for (let i = 0; i < raw.length; i += 2) out.push({ member: String(raw[i]), score: Number(raw[i + 1]) });
    return out;
  }
  const z = (memGet<Record<string, number>>(key) ?? {}) as Record<string, number>;
  return Object.entries(z)
    .map(([member, score]) => ({ member, score }))
    .sort((a, b) => b.score - a.score)
    .slice(0, n);
}

export async function incr(key: string, by = 1): Promise<number> {
  if (redis) return Number(await redis.incrby(key, by));
  const v = ((memGet<number>(key) ?? 0) as number) + by;
  mem.kv.set(key, v);
  return v;
}

export async function sadd(key: string, member: string): Promise<number> {
  if (redis) return Number(await redis.sadd(key, member));
  const s = new Set((memGet<string[]>(key) ?? []) as string[]);
  const before = s.size;
  s.add(member);
  mem.kv.set(key, [...s]);
  return s.size - before;
}

/** Sorted-set helpers (channel registry). */
export async function zadd(key: string, member: string, score: number) {
  if (redis) return void (await redis.zadd(key, { score, member }));
  const z = (memGet<Record<string, number>>(key) ?? {}) as Record<string, number>;
  z[member] = score;
  mem.kv.set(key, z);
}

/** Update a member's score only if it is already in the set (never re-adds a recycled channel). */
export async function ztouch(key: string, member: string, score: number) {
  if (redis) return void (await redis.zadd(key, { xx: true }, { score, member }));
  const z = (memGet<Record<string, number>>(key) ?? {}) as Record<string, number>;
  if (member in z) {
    z[member] = score;
    mem.kv.set(key, z);
  }
}

export async function hget(key: string, field: string): Promise<string | null> {
  if (redis) {
    const v = await redis.hget<string>(key, field);
    return v === null || v === undefined ? null : String(v);
  }
  const h = (memGet<Record<string, string>>(key) ?? {}) as Record<string, string>;
  return h[field] ?? null;
}

/** Push a JSON value to the front of a capped list (newest first). */
export async function pushList(key: string, value: unknown, max: number, ttlSec = 60 * 60 * 24 * 14) {
  const v = JSON.stringify(value);
  if (redis) {
    await redis.lpush(key, v);
    await redis.ltrim(key, 0, max - 1);
    await redis.expire(key, ttlSec);
    return;
  }
  const l = (memGet<string[]>(key) ?? []) as string[];
  mem.kv.set(key, [v, ...l].slice(0, max));
}

/** Newest first. */
export async function readList<T>(key: string, n: number): Promise<T[]> {
  const raw = redis ? ((await redis.lrange(key, 0, n - 1)) as unknown[]) : ((memGet<string[]>(key) ?? []) as string[]).slice(0, n);
  const out: T[] = [];
  for (const r of raw) {
    try {
      out.push((typeof r === "string" ? JSON.parse(r) : r) as T);
    } catch {
      /* skip a bad entry */
    }
  }
  return out;
}

/** Oldest first. */
export async function zoldest(key: string, n: number): Promise<string[]> {
  if (redis) return ((await redis.zrange(key, 0, n - 1)) as unknown[]).map(String);
  const z = (memGet<Record<string, number>>(key) ?? {}) as Record<string, number>;
  return Object.entries(z)
    .sort((a, b) => a[1] - b[1])
    .slice(0, n)
    .map(([m]) => m);
}

export async function zrem(key: string, ...members: string[]) {
  if (!members.length) return;
  if (redis) return void (await redis.zrem(key, ...members));
  const z = (memGet<Record<string, number>>(key) ?? {}) as Record<string, number>;
  for (const m of members) delete z[m];
  mem.kv.set(key, z);
}

export async function zcount(key: string): Promise<number> {
  if (redis) return Number(await redis.zcard(key));
  return Object.keys((memGet<Record<string, number>>(key) ?? {}) as Record<string, number>).length;
}

/** Members whose score is at or below maxScore, oldest first (idle channels). */
export async function zolder(key: string, maxScore: number, n: number): Promise<string[]> {
  if (redis) return ((await redis.zrange(key, "-inf", maxScore, { byScore: true, offset: 0, count: n })) as unknown[]).map(String);
  const z = (memGet<Record<string, number>>(key) ?? {}) as Record<string, number>;
  return Object.entries(z)
    .filter(([, sc]) => sc <= maxScore)
    .sort((a, b) => a[1] - b[1])
    .slice(0, n)
    .map(([m]) => m);
}

export async function zscore(key: string, member: string): Promise<number | null> {
  if (redis) {
    const v = await redis.zscore(key, member);
    return v === null || v === undefined ? null : Number(v);
  }
  const z = (memGet<Record<string, number>>(key) ?? {}) as Record<string, number>;
  return member in z ? z[member] : null;
}

const HIT_SCRIPT = `local n = redis.call('INCR', KEYS[1]) if n == 1 then redis.call('PEXPIRE', KEYS[1], ARGV[1]) end return n`;

/** Fixed-window counter shared by every serverless instance. Returns the count in this window. */
export async function hit(key: string, windowMs: number): Promise<number> {
  if (redis) return Number(await redis.eval(HIT_SCRIPT, [key], [String(windowMs)]));
  const now = Date.now();
  const b = memGet<{ n: number; reset: number }>(key);
  if (!b || b.reset < now) {
    mem.kv.set(key, { n: 1, reset: now + windowMs });
    return 1;
  }
  b.n++;
  return b.n;
}

export async function scard(key: string): Promise<number> {
  if (redis) return Number(await redis.scard(key));
  return ((memGet<string[]>(key) ?? []) as string[]).length;
}

/** Short lease so that only one request advances a room at a time. */
/** Short lease so only one request advances a room at a time. Returns an owner token, or null. */
export async function lease(key: string, ms: number): Promise<string | null> {
  const token = Math.random().toString(36).slice(2) + Date.now().toString(36);
  if (redis) return (await redis.set(key, token, { nx: true, px: ms })) === "OK" ? token : null;
  if (memGet(key)) return null;
  mem.kv.set(key, token);
  mem.exp.set(key, Date.now() + ms);
  return token;
}

const RELEASE_SCRIPT = `if redis.call('GET', KEYS[1]) == ARGV[1] then return redis.call('DEL', KEYS[1]) else return 0 end`;

/** Release only if we still own it (a slow holder must not free someone else's lease). */
export async function release(key: string, token: string | null) {
  if (!token) return;
  if (redis) return void (await redis.eval(RELEASE_SCRIPT, [key], [token]));
  if (memGet(key) === token) mem.kv.delete(key);
}

/**
 * THE LOCK. Accept (or change) a user's call only if this moment is still open
 * and the server clock is before the lock time. Runs atomically.
 * Returns "ok" (first call), "changed" (switched pick), "locked" or "stale".
 */
const CALL_SCRIPT = `
local state = redis.call('HGET', KEYS[1], 'state')
local mid = redis.call('HGET', KEYS[1], 'mid')
local lockAt = tonumber(redis.call('HGET', KEYS[1], 'lockAt') or '0')
if mid ~= ARGV[1] then return 'stale' end
if state ~= 'open' then return 'locked' end
if lockAt > 0 and tonumber(ARGV[4]) >= lockAt then return 'locked' end
local had = redis.call('HEXISTS', KEYS[2], ARGV[2])
redis.call('HSET', KEYS[2], ARGV[2], ARGV[3])
redis.call('EXPIRE', KEYS[2], 1209600)
if had == 1 then return 'changed' end
return 'ok'
`;

export async function callIfOpen(
  momentKey: string,
  callsKey: string,
  mid: string,
  userId: string,
  payload: string,
  now: number,
): Promise<"ok" | "changed" | "locked" | "stale"> {
  if (redis) {
    return (await redis.eval(CALL_SCRIPT, [momentKey, callsKey], [mid, userId, payload, String(now)])) as
      | "ok"
      | "changed"
      | "locked"
      | "stale";
  }
  const m = (memGet<Record<string, string>>(momentKey) ?? {}) as Record<string, string>;
  if (m.mid !== mid) return "stale";
  if (m.state !== "open") return "locked";
  if (Number(m.lockAt || 0) > 0 && now >= Number(m.lockAt)) return "locked";
  const c = (memGet<Record<string, string>>(callsKey) ?? {}) as Record<string, string>;
  const had = userId in c;
  c[userId] = payload;
  mem.kv.set(callsKey, c);
  return had ? "changed" : "ok";
}

/** Replace the whole moment hash (host actions are serialised by the room lease). */
export async function setMoment(momentKey: string, fields: Record<string, string>) {
  if (redis) {
    // one transaction: a call can never land between the delete and the write
    const tx = redis.multi();
    tx.del(momentKey);
    tx.hset(momentKey, fields);
    tx.expire(momentKey, 1209600);
    await tx.exec();
    return;
  }
  mem.kv.set(momentKey, { ...fields });
}

export async function patchMoment(momentKey: string, fields: Record<string, string>) {
  if (redis) return void (await redis.hset(momentKey, fields));
  const m = (memGet<Record<string, string>>(momentKey) ?? {}) as Record<string, string>;
  mem.kv.set(momentKey, { ...m, ...fields });
}
