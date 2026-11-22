"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { api } from "@/lib/client/session";
import { Art, Brand } from "@/components/ui";
import { ThemeToggle } from "@/components/Theme";

type Impact = { users: number; rooms: number; calls: number; callers: number; blocked: number; at: number };

/** Real usage only. Demo rooms and bots are excluded from every number. */
export default function ImpactPage() {
  const [d, setD] = useState<Impact | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    const load = () =>
      api<Impact>("/api/impact")
        .then((r) => (r.ok ? (setD(r.data), setFailed(false)) : setFailed(true)))
        .catch(() => setFailed(true));
    load();
    const t = setInterval(load, 10000);
    return () => clearInterval(t);
  }, []);

  const tiles = [
    { k: "People who joined", v: d?.users, art: "c1/student", bg: "bg-yellow" },
    { k: "Real match rooms", v: d?.rooms, art: "b2/megaphone", bg: "bg-lime" },
    { k: "Calls made", v: d?.calls, art: "b2/foam-finger", bg: "bg-pink" },
    { k: "People who called", v: d?.callers, art: "b2/check", bg: "bg-k-leaf" },
    { k: "Spam & forged cards stopped", v: d?.blocked, art: "b2/lock", bg: "bg-k-rose" },
  ];

  return (
    <main className="min-h-screen pb-20">
      <div className="flood pb-16 sm:pb-20">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 pt-5">
          <Brand />
          <ThemeToggle />
        </div>
        <div className="mx-auto max-w-6xl px-4 pt-8 sm:pt-12">
          <p className="font-led text-xl text-orange sm:text-2xl">THE SCOREBOARD THAT MATTERS</p>
          <h1 className="font-arcade text-4xl sm:text-5xl">Live impact</h1>
          <p className="mt-2 max-w-xl text-on-muted">
            Real people, real rooms. Demo rooms and bots are never counted. Refreshes every 10 seconds.
          </p>
        </div>
      </div>
      <div className="mx-auto -mt-12 grid max-w-6xl grid-cols-2 gap-3 px-4 sm:-mt-10 sm:gap-5 lg:grid-cols-5">
        {tiles.map((t, i) => (
          <div key={t.k} className={`brut lift rise rounded-3xl ${t.bg} p-3.5 text-ink sm:p-5 ${i === 4 ? "col-span-2 lg:col-span-1" : ""}`} style={{ animationDelay: `${i * 60}ms` }}>
            <div className="flex items-center gap-2 sm:block">
              <Art src={t.art} className="h-9 w-9 shrink-0 rounded-full sm:h-14 sm:w-14" />
              <p className="font-led min-w-0 truncate text-[2.4rem] leading-none sm:mt-3 sm:text-7xl">{t.v ?? (failed ? "–" : "…")}</p>
            </div>
            <p className="mt-1.5 text-sm font-bold leading-tight">{t.k}</p>
          </div>
        ))}
      </div>
      <div className="mx-auto mt-8 max-w-6xl px-4">
        <div className="brut flex flex-col gap-3 rounded-3xl bg-stage-2 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
          <div className="flex items-center gap-3">
            <Art src="b2/stopwatch" className="h-12 w-12 shrink-0" />
            <div>
              <p className="font-display text-lg font-extrabold leading-tight">See what they&apos;re playing</p>
              <p className="text-sm text-on-muted">Call the 2024 T20 World Cup final, ball by ball. No sign-up. (Demo rooms never count here.)</p>
            </div>
          </div>
          <Link href="/try" className="key min-h-12 w-full text-base sm:w-auto">
            Try the 3-minute demo
          </Link>
        </div>
      </div>
      <p className="mx-auto mt-6 max-w-6xl px-4 text-xs text-on-muted">
        {d ? `Updated ${new Date(d.at).toLocaleTimeString()}` : failed ? "Couldn't load the numbers. Retrying every 10 seconds." : "Loading…"} · Counted on the server from Nexconn tokens issued and calls accepted.
      </p>
    </main>
  );
}
