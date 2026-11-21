"use client";

import { useEffect, useMemo, useState } from "react";
import { SPORT_ART, SPORT_LABEL, type LiveMatch, type Sport } from "@/lib/game";
import { api } from "@/lib/client/session";
import { Art } from "./ui";

/** Sports with a live feed, in tab order. */
export const FEED_TABS: (Sport | "all")[] = ["all", "cricket", "football", "tennis", "basketball", "hockey", "f1"];
export const HAS_FEED = new Set<Sport>(["cricket", "football", "tennis", "basketball", "hockey", "f1"]);

export function useLive(sport: Sport | "all", enabled = true) {
  const [matches, setMatches] = useState<LiveMatch[] | null>(null);
  useEffect(() => {
    if (!enabled) return;
    let stop = false;
    // paint the last list this browser saw at once, then refresh
    let remembered: LiveMatch[] | null = null;
    try {
      const raw = localStorage.getItem(`ci-live-${sport}`);
      if (raw) {
        const v = JSON.parse(raw) as { at: number; m: LiveMatch[] };
        if (Date.now() - v.at < 15 * 60_000) remembered = v.m;
      }
    } catch {
      /* private mode */
    }
    setMatches(remembered);
    const load = () =>
      api<{ matches: LiveMatch[] }>(`/api/live?sport=${sport}`).then((r) => {
        if (!stop && r.ok) {
          setMatches(r.data.matches);
          try {
            localStorage.setItem(`ci-live-${sport}`, JSON.stringify({ at: Date.now(), m: r.data.matches }));
          } catch {
            /* full or blocked */
          }
        }
      });
    load();
    const t = setInterval(load, 30_000);
    return () => {
      stop = true;
      clearInterval(t);
    };
  }, [sport, enabled]);
  return matches;
}

function when(m: LiveMatch) {
  if (m.status === "live") return m.statusText || "Live";
  const d = new Date(m.startsAt);
  const today = new Date().toDateString() === d.toDateString();
  return `${today ? "Today" : d.toLocaleDateString([], { weekday: "short" })} ${d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`;
}

/** LIVE (red, in play) or BREAK (stumps, lunch, rain, half time). */
export function LiveBadge({ paused, small = false }: { paused?: boolean; small?: boolean }) {
  return (
    <span
      className={`flex shrink-0 items-center gap-1 rounded-full border-2 border-ink font-extrabold ${small ? "px-1.5 text-[9px]" : "px-2 py-0.5 text-[10px]"} ${
        paused ? "bg-k-butter text-ink" : "bg-red text-white"
      }`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${paused ? "bg-ink/50" : "bg-white"}`} /> {paused ? "BREAK" : "LIVE"}
    </span>
  );
}

function Logo({ src, abbr }: { src: string; abbr: string }) {
  const [bad, setBad] = useState(!src);
  return bad ? (
    <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full border-2 border-ink bg-k-sand text-[9px] font-black text-ink">{abbr.slice(0, 3)}</span>
  ) : (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt="" className="h-7 w-7 shrink-0 object-contain" onError={() => setBad(true)} loading="lazy" />
  );
}

/** One match, as a scoreboard row. */
export function MatchRow({ m, selected, onPick, cta = "Open room" }: { m: LiveMatch; selected?: boolean; onPick: (m: LiveMatch) => void; cta?: string }) {
  return (
    <button
      onClick={() => onPick(m)}
      className={`group w-full min-w-0 rounded-2xl border-2 border-ink p-3 text-left text-ink transition-all ${
        selected ? "translate-y-[2px] bg-k-peach shadow-[0_1px_0_var(--shadow)]" : "bg-paper shadow-[0_4px_0_var(--shadow)] hover:-translate-y-0.5 hover:shadow-[0_6px_0_var(--shadow)]"
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="flex min-w-0 items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-muted">
          <Art src={SPORT_ART[m.sport].gear} className="h-4 w-4" />
          <span className="truncate">{m.league}</span>
        </span>
        {m.status === "live" ? (
          <LiveBadge paused={m.paused} />
        ) : (
          <span className="shrink-0 rounded-full border-2 border-ink bg-k-sand px-2 py-0.5 text-[10px] font-extrabold">{when(m)}</span>
        )}
      </div>
      {m.teams.length === 2 && m.sport !== "f1" ? (
        <div className="mt-2 flex flex-col gap-1">
          {m.teams.map((t) => (
            <div key={t.name} className="flex items-center gap-2">
              <Logo src={t.logo} abbr={t.abbr} />
              <span className={`min-w-0 flex-1 truncate text-sm ${t.winner ? "font-extrabold" : "font-bold"}`}>{t.name}</span>
              <span className="font-led min-w-0 max-w-[58%] shrink truncate text-right text-xl leading-none">{t.score}</span>
            </div>
          ))}
        </div>
      ) : (
        <p className="mt-2 font-display text-base font-extrabold">{m.title}</p>
      )}
      <div className="mt-2 flex items-center justify-between gap-2">
        <span className="min-w-0 truncate text-xs text-muted">{m.status === "live" ? m.detail || m.venue : m.venue}</span>
        <span className="shrink-0 text-xs font-extrabold text-orange-d transition-transform group-hover:translate-x-0.5">{selected ? "Selected ✓" : `${cta} →`}</span>
      </div>
    </button>
  );
}

/** Sport tabs + search + list of real matches. */
export function LiveBrowser({
  onPick,
  selectedId,
  initialSport = "all",
  compact = false,
  limit,
  fixedSport,
}: {
  onPick: (m: LiveMatch) => void;
  selectedId?: string;
  initialSport?: Sport | "all";
  compact?: boolean;
  limit?: number;
  /** lock to one sport and hide the tabs */
  fixedSport?: Sport;
}) {
  const [picked, setSport] = useState<Sport | "all">(initialSport);
  const sport = fixedSport ?? picked;
  const [q, setQ] = useState("");
  const matches = useLive(sport);
  const shown = useMemo(() => {
    const s = q.trim().toLowerCase();
    const list = (matches ?? []).filter((m) => !s || `${m.title} ${m.league} ${m.teams.map((t) => t.abbr).join(" ")}`.toLowerCase().includes(s));
    return limit ? list.slice(0, limit) : list;
  }, [matches, q, limit]);
  const liveCount = (matches ?? []).filter((m) => m.status === "live").length;

  return (
    <div>
      <div className={`scroll-thin -mx-1 flex snap-x gap-2 overflow-x-auto px-1 pb-1 ${fixedSport ? "hidden" : ""}`}>
        {FEED_TABS.map((t) => (
          <button key={t} className="chip min-h-10 shrink-0 snap-start" data-on={sport === t} onClick={() => setSport(t)}>
            {t === "all" ? "All sports" : t === "hockey" ? "Ice hockey" : SPORT_LABEL[t]}
          </button>
        ))}
      </div>
      <div className={fixedSport ? "" : "mt-3"}>
        <input className="input !py-2.5" placeholder="Search a team or league" value={q} onChange={(e) => setQ(e.target.value)} />
        <p className="mt-1.5 text-xs font-bold text-on-muted">{matches ? `${liveCount} live now · ${matches.length - liveCount} starting soon` : "Loading matches…"}</p>
      </div>
      <div className={`mt-3 grid grid-cols-[minmax(0,1fr)] gap-3 ${compact ? "max-h-[38dvh] overflow-y-auto pr-1 scroll-thin" : "sm:grid-cols-2 lg:grid-cols-3"}`}>
        {matches === null &&
          Array.from({ length: compact ? 3 : 6 }).map((_, i) => <div key={i} className="h-[7.5rem] animate-pulse rounded-2xl border-2 border-line bg-stage-3/60" />)}
        {matches && shown.length === 0 && (
          <p className="rounded-2xl border-2 border-dashed border-line p-5 text-sm text-on-muted sm:col-span-full">
            {q ? "No match found for that search." : "Nothing live in this sport right now. Pick another, or name your own match."}
          </p>
        )}
        {shown.map((m) => (
          <MatchRow key={m.sport + m.id} m={m} selected={selectedId === m.id} onPick={onPick} />
        ))}
      </div>
    </div>
  );
}

const BANDS: Partial<Record<Sport, string>> = {
  cricket: "bg-k-leaf",
  football: "bg-k-lime",
  tennis: "bg-k-butter",
  basketball: "bg-k-peach",
  hockey: "bg-k-sand",
  f1: "bg-k-rose",
};

/** Off Campus-style tilted card for one live match (hero row). */
export function MatchTicket({ m, i, onPick }: { m: LiveMatch; i: number; onPick: (m: LiveMatch) => void }) {
  const tilt = [-2, 1.5, -1, 2, -1.5][i % 5];
  return (
    <button
      onClick={() => onPick(m)}
      className="group rise block w-full text-left transition-transform duration-300 hover:z-10 hover:!rotate-0 hover:-translate-y-2"
      style={{ transform: `rotate(${tilt}deg)`, animationDelay: `${i * 60}ms` }}
    >
      <div className="brut rounded-[22px] bg-paper p-2.5 text-ink transition-shadow group-hover:shadow-[8px_9px_0_var(--shadow)]">
        <div className={`relative grid h-32 place-items-center overflow-hidden rounded-[14px] border-2 border-ink ${BANDS[m.sport] ?? "bg-k-sand"}`}>
          <span className="absolute left-2 top-1.5 max-w-[70%] truncate text-[10px] font-extrabold uppercase tracking-wide text-ink/60">{m.league}</span>
          {m.status === "live" ? (
            <span className="absolute right-2 top-1.5">
              <LiveBadge paused={m.paused} small />
            </span>
          ) : (
            <span className="absolute right-2 top-1.5 rounded-full border-2 border-ink bg-paper px-1.5 text-[9px] font-extrabold">{when(m)}</span>
          )}
          <Art src={SPORT_ART[m.sport].bolo} className="mt-4 h-24 w-24 transition-transform duration-300 group-hover:-rotate-6 group-hover:scale-110" />
        </div>
        <div className="px-1 pb-1 pt-2.5">
          {m.teams.length === 2 && m.sport !== "f1" ? (
            m.teams.map((t) => (
              <div key={t.name} className="flex items-center gap-2 py-0.5">
                <Logo src={t.logo} abbr={t.abbr} />
                <span className="min-w-0 flex-1 truncate text-sm font-extrabold">{t.abbr || t.name}</span>
                <span className="font-led max-w-[55%] truncate text-lg leading-none">{t.score}</span>
              </div>
            ))
          ) : (
            <p className="font-display line-clamp-2 text-sm font-extrabold">{m.title}</p>
          )}
          <p className="mt-1 line-clamp-1 text-[11px] text-muted">{m.status === "live" ? m.detail || m.statusText : m.venue}</p>
          <span className="key key-sm mt-2.5 w-full">Enter →</span>
        </div>
      </div>
    </button>
  );
}

/** Off Campus-style ticker band, but with real live scores. */
export function ScoreTicker({ matches }: { matches: LiveMatch[] | null }) {
  const live = (matches ?? []).filter((m) => m.status === "live" && m.teams.length === 2 && m.sport !== "f1").slice(0, 14);
  const items = live.length
    ? live.map((m) => `${m.teams[0].abbr} ${m.teams[0].score || "-"}  v  ${m.teams[1].abbr} ${m.teams[1].score || "-"}`)
    : ["Next ball?", "Penalty: scored or saved?", "Super raid?", "Safety car?", "Break point?", "1v2 clutch?"];
  const row = [...items, ...items];
  return (
    <div className="marquee relative z-10 -rotate-1 border-y-[3px] border-ink bg-orange py-2.5 text-ink">
      <div className="marquee-track">
        {row.map((t, i) => (
          <span key={i} className="font-led mx-5 whitespace-nowrap text-[1.35rem] uppercase">
            {live.length > 0 && <span className="mr-2 inline-block h-2 w-2 rounded-full bg-ink align-middle" />}
            {t}
            <span className="ml-10 opacity-50">✦</span>
          </span>
        ))}
      </div>
    </div>
  );
}
