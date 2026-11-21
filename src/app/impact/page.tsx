"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/client/session";
import { Art, Brand } from "@/components/ui";

type Impact = { users: number; rooms: number; calls: number; callers: number; blocked: number; at: number };

/** Real usage only. Demo rooms and bots are excluded from every number. */
export default function ImpactPage() {
  const [d, setD] = useState<Impact | null>(null);
  useEffect(() => {
    const load = () => api<Impact>("/api/impact").then((r) => r.ok && setD(r.data));
    load();
    const t = setInterval(load, 10000);
    return () => clearInterval(t);
  }, []);

  const tiles = [
    { k: "People who joined", v: d?.users, art: "c1/student", bg: "bg-yellow" },
    { k: "Real match rooms", v: d?.rooms, art: "b2/megaphone", bg: "bg-mint" },
    { k: "Calls made", v: d?.calls, art: "b2/foam-finger", bg: "bg-pink" },
    { k: "People who called", v: d?.callers, art: "b2/check", bg: "bg-lav" },
    { k: "Spam & forged cards stopped", v: d?.blocked, art: "b2/lock", bg: "bg-[#7cc4ff]" },
  ];

  return (
    <main className="min-h-screen bg-cream pb-20">
      <div className="bg-blue pb-16">
        <div className="mx-auto max-w-6xl px-4 pt-5">
          <Brand />
        </div>
        <div className="mx-auto max-w-6xl px-4 pt-12 text-white">
          <h1 className="font-display text-5xl font-extrabold text-cream">Live impact</h1>
          <p className="mt-2 max-w-xl text-white/85">
            Real people, real rooms. Demo rooms and 🤖 bots are never counted. Refreshes every 10 seconds.
          </p>
        </div>
      </div>
      <div className="mx-auto -mt-10 grid max-w-6xl gap-5 px-4 sm:grid-cols-2 lg:grid-cols-5">
        {tiles.map((t, i) => (
          <div key={t.k} className={`brut lift rise rounded-3xl ${t.bg} p-5`} style={{ animationDelay: `${i * 60}ms` }}>
            <Art src={t.art} className="h-14 w-14 rounded-full" />
            <p className="font-display mt-3 text-5xl font-extrabold">{t.v ?? "…"}</p>
            <p className="mt-1 text-sm font-bold">{t.k}</p>
          </div>
        ))}
      </div>
      <p className="mx-auto mt-8 max-w-6xl px-4 text-xs text-muted">
        {d ? `Updated ${new Date(d.at).toLocaleTimeString()}` : "Loading…"} · Counted on the server from Nexconn tokens issued and calls accepted.
      </p>
    </main>
  );
}
