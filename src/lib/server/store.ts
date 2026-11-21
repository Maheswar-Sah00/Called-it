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

export async function scard(key: string): Promise<number> {
  if (redis) return Number(await redis.scard(key));
  return ((memGet<string[]>(key) ?? []) as string[]).length;
}

/** Short lease so that only one request advances a room at a time. */
export async function lease(key: string, ms: number): Promise<boolean> {
  if (redis) return (await redis.set(key, "1", { nx: true, px: ms })) === "OK";
  if (memGet(key)) return false;
  mem.kv.set(key, "1");
  mem.exp.set(key, Date.now() + ms);
  return true;
}

export async function release(key: string) {
  if (redis) return void (await redis.del(key));
  mem.kv.delete(key);
}

/**
 * THE LOCK. Accept (or change) a user's call only if this moment is still open
 * and the server clock is before the lock time. Runs atomically.
 * Returns "ok", "locked" or "stale".
 */
const CALL_SCRIPT = `
local state = redis.call('HGET', KEYS[1], 'state')
local mid = redis.call('HGET', KEYS[1], 'mid')
local lockAt = tonumber(redis.call('HGET', KEYS[1], 'lockAt') or '0')
if mid ~= ARGV[1] then return 'stale' end
if state ~= 'open' then return 'locked' end
if lockAt > 0 and tonumber(ARGV[4]) >= lockAt then return 'locked' end
redis.call('HSET', KEYS[2], ARGV[2], ARGV[3])
redis.call('EXPIRE', KEYS[2], 1209600)
return 'ok'
`;

export async function callIfOpen(
  momentKey: string,
  callsKey: string,
  mid: string,
  userId: string,
  payload: string,
  now: number,
): Promise<"ok" | "locked" | "stale"> {
  if (redis) {
    return (await redis.eval(CALL_SCRIPT, [momentKey, callsKey], [mid, userId, payload, String(now)])) as
      | "ok"
      | "locked"
      | "stale";
  }
  const m = (memGet<Record<string, string>>(momentKey) ?? {}) as Record<string, string>;
  if (m.mid !== mid) return "stale";
  if (m.state !== "open") return "locked";
  if (Number(m.lockAt || 0) > 0 && now >= Number(m.lockAt)) return "locked";
  const c = (memGet<Record<string, string>>(callsKey) ?? {}) as Record<string, string>;
  c[userId] = payload;
  mem.kv.set(callsKey, c);
  return "ok";
}

/** Replace the whole moment hash (host actions are serialised by the room lease). */
export async function setMoment(momentKey: string, fields: Record<string, string>) {
  if (redis) {
    await redis.del(momentKey);
    await redis.hset(momentKey, fields);
    await redis.expire(momentKey, 1209600);
    return;
  }
  mem.kv.set(momentKey, { ...fields });
}

export async function patchMoment(momentKey: string, fields: Record<string, string>) {
  if (redis) return void (await redis.hset(momentKey, fields));
  const m = (memGet<Record<string, string>>(momentKey) ?? {}) as Record<string, string>;
  mem.kv.set(momentKey, { ...m, ...fields });
}
