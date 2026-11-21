"use client";

import { useState } from "react";
import { PRESETS, SPORT_ART, SPORT_LABEL, SPORTS, type Sport } from "@/lib/game";
import { Art, Brand, Clouds, Faq, Sparkle, Ticker, Wordmark } from "@/components/ui";
import { StartRoom } from "@/components/StartRoom";

const SKY: Record<string, string> = {
  cricket: "#7cc4ff",
  football: "#8fe3b2",
  basketball: "#ffb27a",
  tennis: "#d8f07a",
  badminton: "#ffc2e0",
  kabaddi: "#ffd36e",
  hockey: "#a9e7ff",
  f1: "#ff9a8a",
  esports: "#c9b6ff",
  other: "#ffe45c",
};

const FAQS = [
  { q: "Is this betting?", a: "No. Called It is points only, never money. There are no stakes, no wallets, no odds. Betting talk, links and phone numbers are blocked before they reach the room." },
  { q: "Do I need to sign up?", a: "No. Pick a nickname and a face. That's it. Share the room link and your friends are in within seconds." },
  { q: "Which sports work?", a: "Any live sport. Cricket, football, basketball, tennis, badminton, kabaddi, hockey, F1 and esports have ready-made questions. For anything else, the host types a question and up to four answers." },
  { q: "How does the lock work?", a: "The server stamps every call when it arrives. Once the host taps Lock (or the timer runs out), a late call is refused. Nobody can call it after seeing it." },
  { q: "What about DRS and VAR?", a: "The host can mark a moment as 'under review'. Points wait until the decision is confirmed, so nobody celebrates too early." },
  { q: "My stream is behind my friends'. Spoilers?", a: "Turn on the spoiler shield. It holds back results and chat for you by the delay you choose, so the room never ruins the moment." },
  { q: "Where do we watch the match?", a: "Wherever you already do: TV, a streaming app, the radio. Called It is the second screen that sits next to it." },
  { q: "How many people can join a room?", a: "Rooms are Nexconn open channels, built for live crowds. A hostel common room or a 500-person fan group both work." },
  { q: "Can I try it without friends online?", a: "Yes. The 60-second demo replays the last five overs of the 2024 T20 World Cup final, ball by ball, with labelled demo bots in the room." },
  { q: "Who keeps the score?", a: "The server. It settles every moment, adds streak bonuses, and pushes the leaderboard to everyone at once." },
];

export default function Home() {
  const [open, setOpen] = useState(false);
  const [sport, setSport] = useState<Sport | undefined>();
  const start = (s?: Sport) => {
    setSport(s);
    setOpen(true);
  };

  return (
    <main className="overflow-x-hidden">
      {/* ---------- HERO ---------- */}
      <section className="relative bg-blue pb-24 text-white">
        <nav className="relative z-20 mx-auto flex max-w-6xl items-center justify-between px-4 pt-5">
          <Brand />
          <div className="flex items-center gap-2">
            <a href="/impact" className="hidden rounded-full px-4 py-2 text-sm font-bold text-cream transition hover:bg-white/15 sm:inline">
              Live impact
            </a>
            <a href="/try" className="btn btn-sm">
              Try the demo
            </a>
          </div>
        </nav>

        <Art src="b5/bolt" className="floaty absolute left-[3%] top-24 w-20 sm:w-28" style={{ ["--r" as string]: "-14deg" }} />
        <Art src="b5/invader" className="floaty absolute right-[6%] top-56 w-16 sm:w-24 [animation-delay:1.2s]" />
        <Art src="b2/foam-finger" className="floaty absolute -left-4 bottom-40 hidden w-32 md:block [animation-delay:.6s]" style={{ ["--r" as string]: "14deg" }} />
        <Art src="b2/stopwatch" className="floaty absolute bottom-48 right-[4%] hidden w-28 md:block [animation-delay:2s]" style={{ ["--r" as string]: "10deg" }} />
        <Sparkle className="absolute left-[18%] top-36 h-4 w-4" />
        <Sparkle className="absolute right-[22%] top-24 h-5 w-5 [animation-delay:.8s]" />
        <Sparkle className="absolute right-[14%] top-[26rem] h-3 w-3 [animation-delay:1.4s]" />
        <Sparkle className="absolute left-[9%] top-[24rem] h-3 w-3 [animation-delay:.3s]" />

        <div className="relative z-10 mx-auto max-w-3xl px-4 pt-10 text-center">
          <p className="font-display text-lg font-bold text-cream/90">Nexconn Live presents</p>
          <div className="relative mx-auto mt-2 w-fit">
            <Art src="b5/starburst" className="absolute -left-10 -top-6 w-24 -rotate-12 sm:-left-16 sm:w-32" />
            <Art src="b1/cricket" className="absolute -right-10 -top-8 w-20 rotate-12 sm:-right-16 sm:w-28" />
            <Wordmark size="text-[5.2rem] sm:text-[8.5rem]" className="relative" />
          </div>
          <p className="mt-3 text-sm font-semibold text-cream/80">Points only · never money</p>
          <h1 className="font-display mt-8 text-4xl font-extrabold leading-[1.05] text-cream sm:text-5xl">
            Watch apart.
            <br />
            Call it together.
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-base text-white/85 sm:text-lg">
            A private room for friends watching the same live match from different places. Call the next ball, the penalty, the
            raid. The server locks the moment it happens.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <button className="btn text-lg" onClick={() => start()}>
              Start a room
            </button>
            <a href="/try" className="btn btn-white text-lg">
              ▶ 60-second demo
            </a>
          </div>
        </div>
        <Clouds className="absolute inset-x-0 bottom-0 h-28 w-full sm:h-40" />
        <Art src="b3/pumped" className="floaty absolute bottom-3 right-[8%] z-10 w-20 sm:right-[14%] sm:w-28" />
      </section>

      <Ticker
        items={[
          "Cricket · next ball",
          "Football · penalty",
          "Kabaddi · super raid",
          "F1 · safety car",
          "Tennis · break point",
          "Esports · 1v2 clutch",
          "Hockey · referral",
          "Basketball · buzzer",
        ]}
      />

      {/* ---------- PICK YOUR SPORT ---------- */}
      <section className="mx-auto max-w-6xl px-4 py-20" id="sports">
        <h2 className="font-display text-4xl font-extrabold">Pick your sport</h2>
        <p className="mt-2 text-muted">Ready-made questions for each. Or type your own for anything live.</p>
        <div className="mt-8 grid grid-cols-2 gap-5 sm:grid-cols-3 lg:grid-cols-5">
          {SPORTS.map((s, i) => (
            <button
              key={s}
              onClick={() => start(s)}
              className="brut lift group flex flex-col rounded-[22px] bg-white p-2.5 text-left rise"
              style={{ animationDelay: `${i * 40}ms` }}
            >
              <div
                className="relative grid aspect-[4/3.4] place-items-center overflow-hidden rounded-[14px] border-2 border-ink"
                style={{ background: `linear-gradient(180deg, ${SKY[s]} 0%, #fff 140%)` }}
              >
                <Art src={SPORT_ART[s].bolo} className="relative z-10 h-[88%] w-auto transition-transform duration-300 group-hover:-rotate-6 group-hover:scale-110" />
                <svg viewBox="0 0 100 20" className="absolute bottom-0 h-6 w-full" preserveAspectRatio="none" aria-hidden>
                  <path d="M0 12 C15 2 30 4 40 10 C50 3 70 3 80 10 C88 5 96 6 100 8 L100 20 L0 20Z" fill="#fff" opacity=".9" />
                </svg>
              </div>
              <div className="px-1 pb-1 pt-3">
                <p className="font-display text-lg font-extrabold">{SPORT_LABEL[s]}</p>
                <p className="line-clamp-1 text-xs text-muted">{PRESETS[s][0].q}</p>
                <span className="btn btn-sm mt-3 w-full">Start</span>
              </div>
            </button>
          ))}
        </div>
        <p className="mt-4 text-xs text-muted">Watch on whatever you already use. Called It is the second screen.</p>
      </section>

      {/* ---------- WHAT IS IT ---------- */}
      <section className="bg-blue py-24 text-white">
        <div className="mx-auto grid max-w-6xl items-center gap-12 px-4 md:grid-cols-2">
          <div>
            <h2 className="font-display text-4xl font-extrabold text-cream sm:text-5xl">What is Called It?</h2>
            <p className="mt-4 text-lg font-bold">
              It&apos;s designed for <span className="text-yellow">friends who can&apos;t watch together.</span>
            </p>
            <p className="mt-6 font-bold">
              It&apos;s not a <s className="decoration-red decoration-2 opacity-80">betting app</s>, a{" "}
              <s className="decoration-red decoration-2 opacity-80">poll</s> or a <s className="decoration-red decoration-2 opacity-80">group chat</s>.
            </p>
            <p className="mt-4 max-w-lg leading-relaxed text-white/85">
              It&apos;s the sofa you used to share. One friend is in a hostel, one is on a night bus, one is at home with the
              family TV. Everyone calls the next moment, the server locks it, and the room finds out together who called it.
            </p>
          </div>
          <div className="flex flex-col gap-5">
            {[
              { bg: "bg-yellow", t: "The lock is real.", d: "Calls close the moment it happens. A late tap gets “Locked”, every time." },
              { bg: "bg-mint", t: "Results you can trust.", d: "Only the server posts results. Forged cards and spam are stopped before delivery." },
              { bg: "bg-pink", t: "Points, never money.", d: "Bragging rights, streaks and a leaderboard. No stakes, no odds, no wallets." },
            ].map((c, i) => (
              <div
                key={c.t}
                className={`brut lift rounded-2xl ${c.bg} p-5 text-ink ${i === 1 ? "md:ml-8" : i === 2 ? "md:ml-3" : ""}`}
              >
                <p className="font-display text-xl font-extrabold">{c.t}</p>
                <p className="mt-1 text-sm">{c.d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ---------- HOW IT WORKS ---------- */}
      <section className="mx-auto max-w-6xl px-4 py-24">
        <h2 className="font-display text-4xl font-extrabold">How does it work?</h2>
        <div className="mt-10 grid gap-8 sm:grid-cols-3 lg:grid-cols-5">
          {[
            { t: "Start a room", d: "Pick the sport. You're the host.", c: "bg-yellow" },
            { t: "Share the link", d: "Friends join with a nickname. No sign-up.", c: "bg-yellow" },
            { t: "Call it", d: "Host opens a moment. Everyone taps a call.", c: "bg-yellow" },
            { t: "Locked", d: "Calls close the instant it happens.", c: "bg-yellow" },
            { t: "Settle & brag", d: "Points, streaks, a live leaderboard.", c: "bg-mint" },
          ].map((s, i) => (
            <div key={s.t} className="group">
              <div className={`grid h-11 w-11 place-items-center rounded-full border-[2.5px] border-ink ${s.c} font-display text-lg font-extrabold shadow-[3px_3px_0_#111] transition-transform group-hover:-translate-y-1 group-hover:rotate-12`}>
                {i + 1}
              </div>
              <p className="font-display mt-4 text-lg font-extrabold">{s.t}</p>
              <p className="mt-1 text-sm text-muted">{s.d}</p>
            </div>
          ))}
        </div>

        <div className="brut-lg mt-14 grid gap-6 rounded-3xl bg-white p-6 sm:p-8 md:grid-cols-[1.3fr_1fr]">
          <div>
            <span className="rounded-md border-2 border-ink bg-yellow px-2 py-0.5 font-mono text-[11px] font-bold">STEP 4 · THE BIT THAT MATTERS</span>
            <h3 className="font-display mt-3 text-2xl font-extrabold">The lock is the game</h3>
            <p className="mt-1 font-semibold">Every call is stamped by the server when it lands, not by your phone.</p>
            <p className="mt-2 text-sm text-muted">
              Watching the same ball on a delayed stream? Your friends can&apos;t sneak a call in after it happens, and neither can you.
            </p>
            <div className="mt-5 flex flex-wrap items-center gap-2 text-xs font-bold">
              {["Host taps Go", "Calls open", "Ball is bowled", "LOCKED", "Result settles"].map((x, i, a) => (
                <span key={x} className="flex items-center gap-2">
                  <span className={`rounded-full border-2 border-ink px-3 py-1.5 ${x === "LOCKED" ? "bg-red text-white" : i === a.length - 1 ? "bg-mint" : "bg-t-butter"}`}>{x}</span>
                  {i < a.length - 1 && <span>→</span>}
                </span>
              ))}
            </div>
          </div>
          <div className="flex flex-col gap-3">
            <div className="rounded-2xl border-2 border-ink bg-t-butter p-4">
              <p className="font-mono text-[11px] font-bold">LATE TAP</p>
              <p className="mt-1 text-sm">
                <b>Refused, with the time it arrived.</b> The room sees a “Locked” stamp, not a fight.
              </p>
            </div>
            <div className="rounded-2xl border-2 border-ink bg-lime p-4">
              <p className="font-mono text-[11px] font-bold">DRS · VAR · REFERRAL</p>
              <p className="mt-1 text-sm">
                <b>Points wait for the decision.</b> The host marks it “under review” until it&apos;s confirmed.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ---------- WATCH FROM ANYWHERE ---------- */}
      <section className="bg-t-lav py-20">
        <div className="mx-auto max-w-6xl px-4">
          <h2 className="font-display text-4xl font-extrabold">Same match. Four different sofas.</h2>
          <p className="mt-2 text-muted">One room for everyone, wherever they&apos;re watching.</p>
          <div className="mt-10 grid grid-cols-2 gap-6 md:grid-cols-4">
            {[
              { a: "a3/hostel", t: "Hostel room", r: "tilt-l" },
              { a: "a3/bus", t: "Night bus", r: "tilt-r" },
              { a: "a3/living-room", t: "Family TV", r: "tilt-l" },
              { a: "a3/balcony", t: "Balcony chai", r: "tilt-r" },
            ].map((x) => (
              <figure key={x.t} className={`brut rounded-2xl bg-white p-2 ${x.r}`}>
                <Art src={x.a} className="aspect-square w-full rounded-xl border-2 border-ink object-cover" />
                <figcaption className="px-1 pb-1 pt-2 text-center font-display font-extrabold">{x.t}</figcaption>
              </figure>
            ))}
          </div>
        </div>
      </section>

      {/* ---------- WHAT'S IN IT ---------- */}
      <section className="bg-night py-24 text-white">
        <div className="mx-auto max-w-6xl px-4">
          <h2 className="font-display text-4xl font-extrabold text-yellow">What&apos;s in it for you?</h2>
          <div className="mt-12 grid grid-cols-2 gap-5 md:grid-cols-5">
            {[
              { bg: "bg-yellow", art: "b2/crown", t: "Bragging rights", d: "A live leaderboard everyone sees at once.", r: "tilt-l" },
              { bg: "bg-blue text-white", art: "b2/flame", t: "Streak bonuses", d: "Two right in a row? +5 on every call after.", r: "tilt-r" },
              { bg: "bg-lav", art: "b2/megaphone", t: "Real banter", d: "Chat and reactions that land with the moment.", r: "tilt-l" },
              { bg: "bg-mint", art: "b2/stopwatch", t: "Spoiler shield", d: "Delay results to match your slow stream.", r: "tilt-r" },
              { bg: "bg-pink", art: "b2/lock", t: "Safe rooms", d: "No betting spam, links or forged results.", r: "tilt-l" },
            ].map((c) => (
              <div key={c.t} className={`brut rounded-2xl ${c.bg} p-4 text-ink ${c.r} ${c.bg.includes("text-white") ? "!text-white" : ""}`}>
                <Art src={c.art} className="h-20 w-20" />
                <p className="font-display mt-2 text-xl font-extrabold leading-tight">{c.t}</p>
                <p className="mt-1.5 text-sm opacity-85">{c.d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ---------- FAQ ---------- */}
      <section className="mx-auto max-w-6xl px-4 py-24">
        <h2 className="font-display text-4xl font-extrabold">FAQs</h2>
        <div className="mt-8 grid gap-4 md:grid-cols-2">
          <div className="flex flex-col gap-4">
            {FAQS.filter((_, i) => i % 2 === 0).map((f) => (
              <Faq key={f.q} {...f} />
            ))}
          </div>
          <div className="flex flex-col gap-4">
            {FAQS.filter((_, i) => i % 2 === 1).map((f) => (
              <Faq key={f.q} {...f} />
            ))}
          </div>
        </div>
      </section>

      {/* ---------- FOOTER ---------- */}
      <footer className="relative bg-blue px-4 pb-10 pt-16 text-center text-white">
        <Wordmark size="text-6xl sm:text-7xl" />
        <p className="font-display mt-6 text-xl font-bold text-cream">Watch apart. Call it together.</p>
        <button className="btn mt-6 text-lg" onClick={() => start()}>
          Start a room
        </button>
        <p className="mt-10 text-xs text-white/70">
          Built on the Nexconn Chat SDK · <a className="underline hover:text-yellow" href="/impact">Live impact</a> · Points only, never money
        </p>
      </footer>

      <StartRoom open={open} onClose={() => setOpen(false)} sport={sport} />
    </main>
  );
}
