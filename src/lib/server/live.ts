import "server-only";
import { after } from "next/server";
import type { LiveMatch, Sport } from "@/lib/game";
import { getJSON, setJSON } from "./store";

/**
 * Live matches from ESPN's public scoreboard feed (no key). Cached in memory
 * for 30 s per feed, so any number of rooms and visitors cost one fetch.
 */
const FEEDS: Partial<Record<Sport, { q: string; label?: string }[]>> = {
  cricket: [{ q: "sport=cricket" }],
  football: [{ q: "sport=soccer" }],
  tennis: [{ q: "sport=tennis" }],
  basketball: [{ q: "sport=basketball&league=nba" }, { q: "sport=basketball&league=wnba" }],
  hockey: [{ q: "sport=hockey", label: "Ice hockey" }],
  f1: [{ q: "sport=racing&league=f1" }],
};
export const FEED_SPORTS = Object.keys(FEEDS) as Sport[];

type Cache = { at: number; data: LiveMatch[] };
const g = globalThis as unknown as { __ciLive?: Map<string, Cache>; __ciLiveInflight?: Map<string, Promise<LiveMatch[]>> };
const cache = (g.__ciLive ??= new Map());
const inflight = (g.__ciLiveInflight ??= new Map());
const TTL = 30_000;

type EspnCompetitor = { displayName?: string; name?: string; abbreviation?: string; score?: string; logo?: string; winner?: boolean; homeAway?: string };
type EspnEvent = {
  id: string;
  name?: string;
  shortName?: string;
  date?: string;
  status?: string;
  summary?: string;
  location?: string;
  description?: string;
  title?: string;
  fullStatus?: { longSummary?: string; summary?: string; session?: string; type?: { shortDetail?: string; detail?: string; state?: string; description?: string } };
  competitors?: EspnCompetitor[];
};

function normalise(sport: Sport, league: string, e: EspnEvent): LiveMatch {
  const statusText = [
    e.summary,
    e.fullStatus?.longSummary,
    e.fullStatus?.summary,
    e.fullStatus?.type?.description,
    e.fullStatus?.type?.detail,
    e.fullStatus?.type?.shortDetail,
  ]
    .filter(Boolean)
    .join(" ");
  const paused = /\b(stumps|lunch|tea|drinks|innings break|rain|bad light|delayed|interrupted|half ?time)\b/i.test(statusText);
  // ESPN sometimes marks a match "in" before the first ball ("Match scheduled to begin at 08:00"): that's not live yet
  const notStarted = /\b(scheduled to begin|yet to begin|match starts|toss (?:at|delayed))\b/i.test(statusText);
  const st = e.status === "in" && !notStarted ? "live" : e.status === "pre" || (e.status === "in" && notStarted) ? "soon" : "done";
  const teams = (e.competitors ?? []).slice(0, 2).map((c) => ({
    name: c.displayName || c.name || c.abbreviation || "TBC",
    abbr: c.abbreviation || (c.displayName ?? "").slice(0, 3).toUpperCase(),
    score: c.score || "",
    logo: c.logo || "",
    winner: !!c.winner,
  }));
  const title =
    teams.length === 2 && teams[0].name && teams[1].name && sport !== "f1"
      ? `${teams[0].name} v ${teams[1].name}`
      : e.name || e.shortName || league;
  return {
    id: String(e.id),
    sport,
    league,
    title,
    short: e.shortName || title,
    status: st,
    statusText: e.fullStatus?.type?.shortDetail && st !== "live" ? e.fullStatus.type.shortDetail : e.summary || e.fullStatus?.type?.detail || "",
    detail: e.fullStatus?.longSummary || e.description || e.title || "",
    startsAt: e.date ? Date.parse(e.date) : 0,
    paused: st === "live" && paused,
    venue: e.location || "",
    teams,
  };
}

const STALE_OK = 10 * 60_000; // serve up to 10-minute-old data instantly while refreshing

async function pull(sport: Sport, q: string, label?: string): Promise<LiveMatch[]> {
  const key = `${sport}|${q}`;
  const running = inflight.get(key);
  if (running) return running;
  const p = (async () => {
    try {
      const res = await fetch(`https://site.web.api.espn.com/apis/v2/scoreboard/header?${q}&lang=en&region=in`, {
        cache: "no-store",
        signal: AbortSignal.timeout(6000),
        headers: { "User-Agent": "CalledIt/1.0 (watch-party scoreboard)" },
      });
      const d = (await res.json()) as { sports?: { leagues?: { name?: string; shortName?: string; events?: EspnEvent[] }[] }[] };
      const out: LiveMatch[] = [];
      for (const sp of d.sports ?? [])
        for (const lg of sp.leagues ?? [])
          for (const e of lg.events ?? []) out.push(normalise(sport, label ?? lg.shortName ?? lg.name ?? "", e));
      const entry = { at: Date.now(), data: out };
      cache.set(key, entry);
      void setJSON(`live:feed:${key}`, entry, 60 * 60).catch(() => null); // shared across server instances
      return out;
    } catch {
      return cache.get(key)?.data ?? [];
    } finally {
      inflight.delete(key);
    }
  })();
  inflight.set(key, p);
  return p;
}

/**
 * Stale-while-revalidate: memory → Redis (shared by every server instance) → ESPN.
 * Anything up to 10 minutes old is served at once and refreshed in the background,
 * so a visitor never waits on the feed after the very first fetch.
 */
async function fetchFeed(sport: Sport, q: string, label?: string): Promise<LiveMatch[]> {
  const key = `${sport}|${q}`;
  let hit = cache.get(key);
  if (!hit) {
    const shared = await getJSON<Cache>(`live:feed:${key}`).catch(() => null);
    if (shared?.data) {
      hit = shared;
      cache.set(key, shared);
    }
  }
  const age = hit ? Date.now() - hit.at : Infinity;
  if (hit && age < TTL) return hit.data;
  if (hit && age < STALE_OK) {
    const refresh = pull(sport, q, label);
    try {
      after(() => refresh);
    } catch {
      /* outside a request: the promise still runs */
    }
    return hit.data;
  }
  return pull(sport, q, label);
}

const RANK = { live: 0, soon: 1, done: 2 } as const;

/** Big fixtures first: India, internationals and the major leagues. */
const BIG = /\b(india|test|odi|t20i|world cup|ipl|premier league|champions league|la ?liga|serie a|bundesliga|ligue 1|isl|atp|wta|nba|nhl|formula 1|grand prix)\b/i;
function weight(m: LiveMatch) {
  if (!m.league) return 3; // unnamed domestic fixtures go last
  if (BIG.test(`${m.title} ${m.league}`)) return 0;
  return m.status === "live" && m.teams.some((t) => t.score) ? 1 : 2;
}

/** Live first, then starting within 18 h; finished games only if nothing else. */
export async function liveMatches(sport: Sport | "all"): Promise<LiveMatch[]> {
  const sports = sport === "all" ? FEED_SPORTS : FEEDS[sport] ? [sport] : [];
  const lists = await Promise.all(sports.flatMap((s) => (FEEDS[s] ?? []).map((f) => fetchFeed(s, f.q, f.label))));
  const now = Date.now();
  const all = lists.flat().filter((m) => m.status === "live" || (m.status === "soon" && m.startsAt - now < 18 * 3600_000));
  const seen = new Set<string>();
  return all
    .filter((m) => (seen.has(m.sport + m.id) ? false : (seen.add(m.sport + m.id), true)))
    .sort((a, b) => RANK[a.status] - RANK[b.status] || weight(a) - weight(b) || a.startsAt - b.startsAt)
    .slice(0, 60);
}

/** The current state of one match (for a room bound to it). */
export async function findMatch(sport: Sport, id: string): Promise<LiveMatch | null> {
  const lists = await Promise.all((FEEDS[sport] ?? []).map((f) => fetchFeed(sport, f.q, f.label)));
  return lists.flat().find((m) => m.id === id) ?? null;
}

/** One-line score for the room scoreboard, e.g. "NZ 368 · IND 486/4 (125 ov)". */
export function scoreLine(m: LiveMatch) {
  if (m.sport === "f1" || m.teams.length < 2) return m.statusText || m.title;
  const [a, b] = m.teams;
  return `${a.abbr} ${a.score || "–"} · ${b.abbr} ${b.score || "–"}`;
}
