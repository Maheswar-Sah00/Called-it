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
    setMatches(null);
    const load = () =>
      api<{ matches: LiveMatch[] }>(`/api/live?sport=${sport}`).then((r) => {
        if (!stop && r.ok) setMatches(r.data.matches);
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
      className={`group w-full rounded-2xl border-2 border-ink p-3 text-left text-ink transition-all ${
        selected ? "translate-y-[2px] bg-k-peach shadow-[0_1px_0_var(--shadow)]" : "bg-paper shadow-[0_4px_0_var(--shadow)] hover:-translate-y-0.5 hover:shadow-[0_6px_0_var(--shadow)]"
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="flex min-w-0 items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-muted">
          <Art src={SPORT_ART[m.sport].gear} className="h-4 w-4" />
          <span className="truncate">{m.league}</span>
        </span>
        {m.status === "live" ? (
          <span className="flex shrink-0 items-center gap-1.5 rounded-full border-2 border-ink bg-red px-2 py-0.5 text-[10px] font-extrabold text-white">
            <span className="h-1.5 w-1.5 rounded-full bg-white" /> LIVE
          </span>
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
              <span className="font-led shrink-0 text-xl leading-none">{t.score}</span>
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
      <div className={`flex flex-wrap items-center gap-2 ${fixedSport ? "hidden" : ""}`}>
        {FEED_TABS.map((t) => (
          <button key={t} className="chip" data-on={sport === t} onClick={() => setSport(t)}>
            {t === "all" ? "All sports" : t === "hockey" ? "Ice hockey" : SPORT_LABEL[t]}
          </button>
        ))}
      </div>
      <div className={`${fixedSport ? "" : "mt-3"} flex items-center gap-3`}>
        <input className="input !py-2.5" placeholder="Search a team or league, e.g. India, Arsenal, NBA" value={q} onChange={(e) => setQ(e.target.value)} />
        <span className="shrink-0 text-xs font-bold text-on-muted">{matches ? `${liveCount} live` : "…"}</span>
      </div>
      <div className={`mt-4 grid gap-3 ${compact ? "max-h-[22rem] overflow-y-auto pr-1 scroll-thin" : "sm:grid-cols-2 lg:grid-cols-3"}`}>
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
