"use client";

import { useEffect, useState } from "react";
import { PRESETS, SPORT_ART, SPORT_LABEL, SPORTS, type Sport } from "@/lib/game";
import { Art, Brand, Faq, Floodlight, Marquee, Pitch, Star, Wordmark } from "@/components/ui";
import { StartRoom } from "@/components/StartRoom";
import { HeroScoreboard } from "@/components/HeroScoreboard";
import { ThemeToggle } from "@/components/Theme";

const BAND: Record<Sport, string> = {
  cricket: "bg-k-leaf",
  football: "bg-k-lime",
  basketball: "bg-k-peach",
  tennis: "bg-k-butter",
  badminton: "bg-k-rose",
  kabaddi: "bg-k-sand",
  hockey: "bg-k-leaf",
  f1: "bg-k-rose",
  esports: "bg-k-peach",
  other: "bg-yellow",
};

const FAQS = [
  { q: "Is this betting?", a: "No. Called It is points only, never money. No stakes, no wallets, no odds. Betting talk, links and phone numbers are blocked before they reach the room." },
  { q: "Do I need to sign up?", a: "No. Pick a nickname and a face. Share the room link and your friends are in within seconds." },
  { q: "Where do we watch the match?", a: "Wherever you already do: TV, a streaming app, the radio. Called It is the second screen that sits next to it." },
  { q: "How does the lock work?", a: "The server stamps every call when it arrives. Once the host taps Lock (or the timer runs out), a late call is refused, with proof of how late it was." },
  { q: "My stream is behind my friends'. Spoilers?", a: "Turn on the spoiler shield in the room. It holds back results and chat for you by the delay you pick." },
  { q: "What about DRS and VAR?", a: "The host marks the moment 'under review'. Points wait until the decision is in, so nobody celebrates early." },
  { q: "Which sports work?", a: "Any live sport. Cricket, football, basketball, tennis, badminton, kabaddi, hockey, F1 and esports have ready-made questions. For anything else, type your own." },
  { q: "Can I try it with nobody online?", a: "Yes. The 60-second demo replays the last five overs of the 2024 T20 World Cup final, ball by ball, with labelled demo bots." },
];

const CHANNELS = [
  { a: "a3/hostel", t: "Hostel, block C", who: "Arjun · on his phone" },
  { a: "a3/bus", t: "Night bus home", who: "Sana · 4G, 30s behind" },
  { a: "a3/living-room", t: "Family TV", who: "Nani · loudest in the room" },
  { a: "a3/balcony", t: "Balcony chai", who: "Kabir & Dev · one screen" },
];

/** The eleven Nexconn features Called It uses, laid out as a 4-3-3. */
const NEXCONN_XI = [
  { k: "Server API + tokens", pos: "GK", art: "b2/lock", x: 50, y: 88, d: "Signed server calls (SHA1 signature) with automatic failover to the backup domain; mints each player's access token from just a nickname." },
  { k: "Open channels", pos: "LB", art: "b2/scoreboard", x: 16, y: 68, d: "Every match room is a Nexconn open channel, made for live crowds and created on the fly." },
  { k: "Web SDK connect", pos: "CB", art: "b1/controller", x: 38, y: 72, d: "NCEngine connects each browser to the North America data centre; one shared connection per player." },
  { k: "Custom message types", pos: "CB", art: "b2/check", x: 62, y: 72, d: "CI:Moment, CI:Lock, CI:Pending and CI:Result game cards, registered before connect." },
  { k: "High-priority messages", pos: "RB", art: "b2/megaphone", x: 84, y: 68, d: "Lock and result cards go out at priority 2, so they cut through a busy chat." },
  { k: "Status messages", pos: "CM", art: "b2/foam-finger", x: 28, y: 47, d: "Live tallies and sticker reactions travel as status messages: instant, never stored." },
  { k: "Channel metadata", pos: "CM", art: "b2/replay", x: 50, y: 50, d: "Room phase and score mirrored into open-channel metadata, so a late joiner catches up at once." },
  { k: "Participant events", pos: "CM", art: "c1/student", x: 72, y: 47, d: "onParticipantChanged powers the live head count on the scoreboard." },
  { k: "Pre-messaging webhook", pos: "LW", art: "b2/cross", x: 20, y: 24, d: "open_channel:pre_messaging refuses betting spam, links, phone numbers and forged result cards before delivery ({pass: 0})." },
  { k: "Mute + message delete", pos: "ST", art: "b1/whistle", x: 50, y: 18, d: "The host mutes a participant; the message:send webhook deletes anything that slips through." },
  { k: "Open-channel chat", pos: "RW", art: "b5/heart", x: 80, y: 24, d: "The dugout: real-time banter with message history for anyone who walks in mid-match." },
];

const OVER = [
  { n: "1", t: "Start a room", d: "Pick the sport. You're the host." },
  { n: "2", t: "Share the link", d: "Friends join with a nickname. No sign-up." },
  { n: "3", t: "Call it", d: "The host opens a moment. Everyone taps an answer." },
  { n: "", art: "b2/lock", t: "Locked", d: "Calls close the instant it happens. Late taps bounce.", hot: true },
  { n: "", art: "b2/replay", t: "Under review", d: "DRS or VAR? Points wait for the decision." },
  { n: "", art: "b2/crown", t: "Settle & brag", d: "Points, streaks and a live table, all at once.", win: true },
];

export default function Home() {
  const [open, setOpen] = useState(false);
  const [sport, setSport] = useState<Sport | undefined>();
  const [ch, setCh] = useState(0);
  const [staticFx, setStaticFx] = useState(false);
  const start = (s?: Sport) => {
    setSport(s);
    setOpen(true);
  };
  const flip = (i: number) => {
    setStaticFx(true);
    setCh(i);
    setTimeout(() => setStaticFx(false), 260);
  };
  useEffect(() => {
    const id = setInterval(() => flip((Math.random() * 4) | 0), 9000);
    return () => clearInterval(id);
  }, []);

  return (
    <main className="overflow-x-hidden">
      {/* ================= HERO: the stadium ================= */}
      <section className="flood relative pb-36 sm:pb-44">
        <nav className="relative z-20 mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 pt-5">
          <Brand />
          <div className="flex items-center gap-2 sm:gap-3">
            <a href="/impact" className="hidden text-sm font-bold text-on-muted transition hover:text-orange md:inline">
              Live impact
            </a>
            <ThemeToggle />
            <a href="/try" className="key key-sm hidden sm:inline-flex">
              Try the demo
            </a>
          </div>
        </nav>

        <Floodlight className="night-only absolute left-[2%] top-16 w-14 opacity-90 sm:w-20" />
        <Floodlight className="night-only absolute right-[2%] top-16 w-14 opacity-90 sm:w-20" />
        <Star className="night-only absolute left-[24%] top-24 h-3 w-3" />
        <Star className="night-only absolute left-[46%] top-14 h-2.5 w-2.5 [animation-delay:.7s]" />
        <Star className="night-only absolute right-[30%] top-28 h-3 w-3 [animation-delay:1.3s]" />
        <Art src="b5/comet" className="night-only floaty absolute right-[38%] top-20 hidden w-16 lg:block" style={{ ["--r" as string]: "-20deg" }} />

        <div className="relative z-10 mx-auto grid max-w-6xl items-center gap-12 px-4 pt-12 lg:grid-cols-[1.05fr_1fr] lg:pt-16">
          <div>
            <div className="flex flex-wrap gap-2.5">
              <span className="led inline-flex items-center gap-2 rounded-lg px-3 py-1 !shadow-[0_3px_0_#000]">
                <span className="live-dot" />
                <span className="font-led led-text text-lg">MATCHDAY · POINTS ONLY</span>
              </span>
              <a
                href="#nexconn"
                className="inline-flex items-center gap-2 rounded-lg border-2 border-ink bg-paper px-3 py-1 text-ink shadow-[0_3px_0_#000] transition-transform hover:-translate-y-0.5"
              >
                <span className="font-led text-lg">BUILT FOR THE NEXCONN BUILD CHALLENGE 2026</span>
                <span className="font-led rounded bg-orange px-1 text-lg">→</span>
              </a>
            </div>
            <Wordmark size="text-[4.4rem] sm:text-[7.2rem]" className="mt-6" />
            <h1 className="font-display mt-6 text-3xl font-extrabold leading-tight sm:text-[2.6rem]">
              Watch apart. <span className="text-orange">Call it together.</span>
            </h1>
            <p className="mt-4 max-w-lg text-base text-on-muted sm:text-lg">
              Your friends are in a hostel, on a bus, on the family sofa. Open a room, call the next ball, the penalty, the raid. The
              server locks it the moment it happens, and the room finds out together who called it.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-4">
              <button className="key text-lg" onClick={() => start()}>
                Start a room
              </button>
              <a href="/try" className="key key-paper text-lg">
                60-second demo
              </a>
            </div>
            <div className="mt-8 flex flex-wrap gap-x-6 gap-y-2 text-sm font-bold text-on-muted">
              {[
                ["b5/bolt", "No sign-up"],
                ["b2/scoreboard", "9 sports + anything live"],
                ["b2/lock", "Server-clock lock"],
              ].map(([a, t]) => (
                <span key={t} className="flex items-center gap-1.5">
                  <Art src={a} className="h-7 w-7" /> {t}
                </span>
              ))}
            </div>
          </div>
          <HeroScoreboard />
        </div>

        <Pitch className="absolute inset-x-0 bottom-0 h-28 sm:h-36" />
        <Art src="b4/cricket" className="floaty absolute bottom-6 left-[6%] z-10 w-20 sm:w-28" />
        <Art src="b4/football" className="floaty absolute bottom-4 right-[8%] z-10 w-20 sm:w-28 [animation-delay:1.1s]" />
        <Art src="b3/review" className="absolute bottom-3 left-1/2 z-10 hidden w-24 -translate-x-1/2 md:block" />
      </section>

      <Marquee
        items={["Next ball?", "Penalty: scored or saved?", "Super raid?", "Safety car?", "Break of serve?", "1v2 clutch?", "Referral stands?", "Buzzer beater?"]}
      />

      {/* ================= ARENAS: ticket stubs ================= */}
      <section className="mx-auto max-w-6xl px-4 py-20" id="sports">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="font-led text-2xl text-orange">GATES OPEN</p>
            <h2 className="font-arcade text-4xl sm:text-5xl">Pick your arena</h2>
          </div>
          <p className="max-w-sm text-on-muted">Ready-made questions for nine sports. Or write your own for anything live, from a chess final to a cook-off.</p>
        </div>
        <div className="mt-10 grid grid-cols-2 gap-x-5 gap-y-8 sm:grid-cols-3 lg:grid-cols-5">
          {SPORTS.map((s, i) => (
            <button
              key={s}
              onClick={() => start(s)}
              className="group rise text-left transition-transform duration-300 hover:z-10 hover:-translate-y-2 hover:rotate-0"
              style={{ animationDelay: `${i * 40}ms`, transform: `rotate(${i % 2 ? 1.6 : -1.6}deg)` }}
            >
              <div className="drop-shadow-[5px_6px_0_#000]">
                <div className="ticket">
                  <div className={`relative grid h-32 place-items-center overflow-hidden rounded-t-[18px] border-b-[2.5px] border-ink ${BAND[s]}`}>
                    <span className="font-led absolute left-2.5 top-1.5 text-base text-ink/60">ADMIT ALL</span>
                    <span className="font-led absolute right-2.5 top-1.5 text-base text-ink/60">#{String(i + 1).padStart(2, "0")}</span>
                    <Art src={SPORT_ART[s].bolo} className="mt-3 h-28 w-28 transition-transform duration-300 group-hover:scale-110 group-hover:-rotate-6" />
                  </div>
                  <div className="px-3.5 pb-2 pt-3">
                    <p className="font-arcade text-lg leading-none">{SPORT_LABEL[s]}</p>
                    <p className="mt-1 line-clamp-1 text-xs text-muted">“{PRESETS[s][0].q}”</p>
                  </div>
                  <div className="perf mx-3 mt-2" />
                  <div className="flex items-center justify-between px-3.5 py-2.5">
                    <span className="font-led text-lg text-muted">GATE {String.fromCharCode(65 + i)}</span>
                    <span className="rounded-lg border-2 border-ink bg-orange px-2.5 py-0.5 text-xs font-extrabold shadow-[0_3px_0_#000] transition-transform group-hover:translate-x-1">
                      Enter →
                    </span>
                  </div>
                </div>
              </div>
            </button>
          ))}
        </div>
      </section>

      {/* ================= HOUSE RULES: tactics board ================= */}
      <section className="px-4 py-6">
        <div className="chalkboard relative mx-auto max-w-6xl overflow-hidden rounded-[28px] border-[3px] border-ink p-6 text-paper shadow-[8px_8px_0_#000] sm:p-10">
          <svg className="pointer-events-none absolute inset-0 h-full w-full opacity-[0.16]" viewBox="0 0 800 400" preserveAspectRatio="none" aria-hidden>
            <rect x="20" y="20" width="760" height="360" fill="none" stroke="#fff" strokeWidth="3" />
            <line x1="400" y1="20" x2="400" y2="380" stroke="#fff" strokeWidth="3" />
            <circle cx="400" cy="200" r="60" fill="none" stroke="#fff" strokeWidth="3" />
            <path d="M120 300 C 220 220, 300 260, 360 170" fill="none" stroke="#fff" strokeWidth="3" strokeDasharray="10 8" />
            <path d="M350 160 l18 6 -8 17" fill="none" stroke="#fff" strokeWidth="3" />
            <text x="100" y="320" fill="#fff" fontSize="34" fontFamily="sans-serif">X</text>
            <circle cx="620" cy="120" r="14" fill="none" stroke="#fff" strokeWidth="3" />
            <circle cx="680" cy="250" r="14" fill="none" stroke="#fff" strokeWidth="3" />
          </svg>
          <div className="relative grid gap-10 lg:grid-cols-[1fr_1.4fr]">
            <div>
              <p className="font-led text-2xl text-yellow">THE GAME PLAN</p>
              <h2 className="font-arcade mt-1 text-4xl sm:text-5xl">House rules</h2>
              <p className="mt-5 text-lg font-bold">
                Not a <s className="decoration-red decoration-[3px]">betting app</s>. Not a <s className="decoration-red decoration-[3px]">poll</s>. Not a{" "}
                <s className="decoration-red decoration-[3px]">group chat</s>.
              </p>
              <p className="mt-3 max-w-md text-paper/75">It&apos;s the sofa you used to share, rebuilt for friends who watch from different places.</p>
              <Art src="c2/cricket-umpire" className="mt-6 hidden w-36 lg:block" />
            </div>
            <div className="flex flex-col gap-4">
              {[
                { n: "01", t: "The lock is real.", d: "Calls close the moment it happens, on the server's clock. A late tap gets “Locked” and the exact delay.", art: "b2/lock", c: "bg-yellow" },
                { n: "02", t: "Only the server posts results.", d: "Forged result cards and betting spam are refused before they're delivered to anyone.", art: "b2/check", c: "bg-k-leaf" },
                { n: "03", t: "Points, never money.", d: "Bragging rights, streak bonuses and a live table. No stakes, no odds, no wallets.", art: "b2/crown", c: "bg-k-rose" },
              ].map((r, i) => (
                <div
                  key={r.n}
                  className={`group flex items-center gap-4 rounded-2xl border-[2.5px] border-ink ${r.c} p-4 text-ink shadow-[5px_5px_0_#000] transition-transform duration-200 hover:-translate-y-1 hover:rotate-[-0.6deg] ${i === 1 ? "lg:ml-10" : i === 2 ? "lg:ml-4" : ""}`}
                >
                  <span className="font-led text-4xl text-ink/40">{r.n}</span>
                  <div className="flex-1">
                    <p className="font-display text-xl font-extrabold">{r.t}</p>
                    <p className="mt-0.5 text-sm text-ink/75">{r.d}</p>
                  </div>
                  <Art src={r.art} className="h-14 w-14 shrink-0 transition-transform group-hover:rotate-12 group-hover:scale-110" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ================= ONE OVER: how it works ================= */}
      <section className="mx-auto max-w-6xl px-4 py-24">
        <p className="font-led text-2xl text-orange">HOW IT WORKS</p>
        <h2 className="font-arcade text-4xl sm:text-5xl">One over of Called It</h2>
        <p className="mt-2 text-on-muted">Six balls from “who&apos;s in?” to “told you so”.</p>
        <div className="relative mt-14">
          <div className="absolute left-6 right-6 top-8 hidden h-3 rounded-full border-2 border-ink bg-stage-3 lg:block" aria-hidden />
          <div className="grid gap-8 sm:grid-cols-3 lg:grid-cols-6">
            {OVER.map((b, i) => (
              <div key={b.t} className="group relative flex flex-col items-start lg:items-center lg:text-center">
                <div
                  className={`relative grid h-16 w-16 place-items-center rounded-full border-[3px] border-ink text-2xl font-black shadow-[0_5px_0_#000] transition-all duration-200 group-hover:-translate-y-2 group-hover:rotate-[24deg] ${
                    b.hot ? "bg-red text-white" : b.win ? "bg-lime text-ink" : "bg-[radial-gradient(circle_at_35%_30%,#ff8a6b,#c8321f_70%)] text-paper"
                  }`}
                >
                  {!b.hot && !b.win && <span className="absolute inset-y-1 right-2.5 w-2 rounded-full border-l-2 border-dashed border-paper/70" aria-hidden />}
                  {b.art ? <Art src={b.art} className="relative h-11 w-11" /> : <span className="font-arcade relative -ml-1 text-2xl">{b.n}</span>}
                </div>
                <p className="font-led mt-4 text-lg text-on-muted">BALL {i + 1}</p>
                <p className="font-display text-xl font-extrabold">{b.t}</p>
                <p className="mt-1 text-sm text-on-muted">{b.d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ================= RETRO TV: watch from anywhere ================= */}
      <section className="bg-stage-2 py-24">
        <div className="mx-auto grid max-w-6xl items-center gap-12 px-4 lg:grid-cols-[1fr_1.25fr]">
          <div>
            <p className="font-led text-2xl text-orange">FLIP THE CHANNEL</p>
            <h2 className="font-arcade text-4xl sm:text-5xl">Same match. Four sofas.</h2>
            <p className="mt-4 max-w-md text-on-muted">
              Streams run 5 to 40 seconds apart. Turn on the spoiler shield and the room holds results and chat back to match your
              screen, so the bus never ruins it for the hostel.
            </p>
            <div className="mt-6 grid grid-cols-2 gap-3">
              {CHANNELS.map((c, i) => (
                <button
                  key={c.t}
                  onClick={() => flip(i)}
                  className={`key key-sm justify-start !rounded-xl text-left ${ch === i ? "" : "key-dark"}`}
                  aria-pressed={ch === i}
                >
                  <span className="font-led text-lg">CH{i + 1}</span> {c.t}
                </button>
              ))}
            </div>
          </div>
          <div className="relative mx-auto w-full max-w-xl">
            {/* antenna */}
            <div className="absolute -top-14 left-1/2 h-16 w-1 origin-bottom -translate-x-6 -rotate-[28deg] rounded bg-ink" />
            <div className="absolute -top-14 left-1/2 h-16 w-1 origin-bottom translate-x-6 rotate-[28deg] rounded bg-ink" />
            <div className="relative rounded-[30px] border-[3px] border-ink bg-[#a0522d] p-4 shadow-[8px_8px_0_#000] sm:p-5">
              <div className="flex gap-4">
                <div className="scanlines relative aspect-[4/3] flex-1 overflow-hidden rounded-[22px] border-[3px] border-ink bg-black">
                  <Art key={ch} src={CHANNELS[ch].a} className="rise h-full w-full object-cover" />
                  {staticFx && <div className="absolute inset-0 bg-[repeating-linear-gradient(0deg,#fff_0_2px,#222_2px_4px)] opacity-70" />}
                  <span className="font-led led-text absolute left-3 top-2 text-2xl">CH{ch + 1}</span>
                  <span className="absolute bottom-2 left-2 rounded-md border-2 border-ink bg-paper px-2 py-0.5 text-xs font-bold text-ink">{CHANNELS[ch].who}</span>
                </div>
                <div className="hidden w-16 flex-col items-center gap-4 pt-2 sm:flex">
                  {[0, 1].map((k) => (
                    <button
                      key={k}
                      onClick={() => flip((ch + (k ? 3 : 1)) % 4)}
                      className="h-12 w-12 rounded-full border-[3px] border-ink bg-[radial-gradient(circle_at_35%_30%,#ffe7b0,#c8913f)] shadow-[0_4px_0_#000] transition-transform hover:rotate-45 active:translate-y-1 active:shadow-none"
                      aria-label={k ? "Previous channel" : "Next channel"}
                    />
                  ))}
                  <div className="mt-2 flex flex-col gap-1.5">
                    {Array.from({ length: 5 }).map((_, k) => (
                      <span key={k} className="h-1 w-10 rounded bg-ink/50" />
                    ))}
                  </div>
                </div>
              </div>
            </div>
            <div className="mx-auto flex w-3/4 justify-between">
              <span className="h-5 w-6 rounded-b-md border-2 border-t-0 border-ink bg-[#7a3d22]" />
              <span className="h-5 w-6 rounded-b-md border-2 border-t-0 border-ink bg-[#7a3d22]" />
            </div>
          </div>
        </div>
      </section>

      {/* ================= POWER-UPS ================= */}
      <section className="bg-night py-24 text-paper">
        <div className="mx-auto max-w-6xl px-4">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="font-led text-2xl text-yellow">INSERT COIN</p>
              <h2 className="font-arcade text-4xl sm:text-5xl">Your power-ups</h2>
            </div>
            <p className="font-led text-2xl text-paper/60">PLAYER 1 · READY</p>
          </div>
          <div className="mt-12 grid grid-cols-2 gap-5 md:grid-cols-5">
            {[
              { art: "b2/crown", t: "Bragging rights", d: "A live table everyone sees at once.", c: "border-yellow", k: "1UP" },
              { art: "b2/flame", t: "Streak bonus", d: "Two right in a row: +5 on every call after.", c: "border-orange", k: "x2" },
              { art: "b2/megaphone", t: "Real banter", d: "Chat and reactions that land with the moment.", c: "border-pink", k: "MIC" },
              { art: "b2/stopwatch", t: "Spoiler shield", d: "Results wait for your slower stream.", c: "border-lime", k: "SLOW" },
              { art: "b2/lock", t: "Safe room", d: "No betting spam, links or forged results.", c: "border-red", k: "SAFE" },
            ].map((p, i) => (
              <div
                key={p.t}
                className={`group relative rounded-2xl border-[3px] ${p.c} bg-night-2 p-4 shadow-[0_6px_0_#000] transition-all duration-200 hover:-translate-y-2 hover:bg-night-3 ${i % 2 ? "md:mt-8" : ""}`}
              >
                <span className="font-led absolute right-3 top-2 text-xl text-paper/50 group-hover:blink">{p.k}</span>
                <Art src={p.art} className="h-20 w-20 transition-transform duration-300 group-hover:scale-110 group-hover:-rotate-12" />
                <p className="font-arcade mt-3 text-lg leading-tight">{p.t}</p>
                <p className="mt-1.5 text-sm text-paper/70">{p.d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ================= BUILT ON NEXCONN: the team sheet ================= */}
      <section className="mx-auto max-w-6xl px-4 pt-24" id="nexconn">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="font-led text-2xl text-orange">BUILT FOR THE NEXCONN BUILD CHALLENGE 2026</p>
            <h2 className="font-arcade text-4xl sm:text-5xl">The starting XI</h2>
            <p className="mt-2 max-w-xl text-on-muted">
              Every live moment in Called It runs on Nexconn. Here&apos;s the team sheet: eleven Nexconn features, and the job each one plays.
            </p>
          </div>
          <div className="led rounded-xl px-4 py-3 text-center">
            <p className="font-led text-lg text-paper/60">POWERED BY</p>
            <p className="font-arcade text-2xl text-yellow">NEXCONN CHAT</p>
            <p className="font-led text-lg text-paper/60">WEB SDK 26.2 · SERVER API</p>
          </div>
        </div>
        <div className="mt-10 grid gap-6 lg:grid-cols-[0.9fr_1.4fr]">
          {/* formation */}
          <div className="turf relative aspect-[4/5] overflow-hidden rounded-[24px] border-[3px] border-ink shadow-[8px_8px_0_#000]">
            <svg viewBox="0 0 100 125" className="absolute inset-0 h-full w-full" aria-hidden>
              <rect x="5" y="5" width="90" height="115" fill="none" stroke="#fff" strokeOpacity=".55" strokeWidth=".8" />
              <line x1="5" y1="62.5" x2="95" y2="62.5" stroke="#fff" strokeOpacity=".55" strokeWidth=".8" />
              <circle cx="50" cy="62.5" r="11" fill="none" stroke="#fff" strokeOpacity=".55" strokeWidth=".8" />
              <rect x="30" y="5" width="40" height="16" fill="none" stroke="#fff" strokeOpacity=".55" strokeWidth=".8" />
              <rect x="30" y="104" width="40" height="16" fill="none" stroke="#fff" strokeOpacity=".55" strokeWidth=".8" />
            </svg>
            {NEXCONN_XI.map((p, i) => (
              <a
                key={p.k}
                href={`#nx-${i + 1}`}
                className="group absolute grid h-10 w-10 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border-[2.5px] border-ink bg-orange font-arcade text-sm text-ink shadow-[0_3px_0_#000] transition-transform hover:z-10 hover:scale-125"
                style={{ left: `${p.x}%`, top: `${p.y}%` }}
                title={p.k}
              >
                {i + 1}
                <span className="pointer-events-none absolute top-full mt-1 hidden whitespace-nowrap rounded-md border-2 border-ink bg-paper px-1.5 text-[11px] font-bold group-hover:block">
                  {p.k}
                </span>
              </a>
            ))}
            <span className="font-led absolute bottom-2 left-3 rounded bg-black/50 px-2 text-lg text-paper">FORMATION 4-3-3 · CALLED IT FC</span>
          </div>
          {/* team sheet */}
          <div className="paper brut-lg overflow-hidden rounded-[24px]">
            <div className="flex items-center justify-between border-b-[3px] border-ink bg-orange px-5 py-3">
              <p className="font-arcade text-lg">TEAM SHEET</p>
              <p className="font-led text-xl">NEXCONN XI</p>
            </div>
            <ol>
              {NEXCONN_XI.map((p, i) => (
                <li
                  key={p.k}
                  id={`nx-${i + 1}`}
                  className="group flex items-start gap-3 border-b-2 border-dashed border-ink/20 px-5 py-3 transition-colors last:border-0 hover:bg-k-butter/60"
                >
                  <span className="font-led w-7 shrink-0 text-3xl leading-none text-orange-d">{i + 1}</span>
                  <div className="min-w-0 flex-1">
                    <p className="font-display font-extrabold">
                      {p.k} <span className="font-led ml-1 text-lg font-normal text-muted">· {p.pos}</span>
                    </p>
                    <p className="text-sm text-muted">{p.d}</p>
                  </div>
                  <Art src={p.art} className="h-9 w-9 shrink-0 transition-transform group-hover:rotate-12 group-hover:scale-110" />
                </li>
              ))}
            </ol>
            <div className="flex items-start gap-3 border-t-[3px] border-ink bg-k-butter px-5 py-3">
              <span className="font-led shrink-0 rounded border-2 border-ink bg-orange px-1 text-xl leading-tight">SUB</span>
              <div className="min-w-0 flex-1">
                <p className="font-display font-extrabold">
                  Nexconn Call SDK <span className="font-led ml-1 text-lg font-normal text-muted">· voice + video huddles</span>
                </p>
                <p className="text-sm text-muted">
                  Multi-party voice and video in every room: one tap to start, the room gets a priority “huddle is live” card, friends pick up or join late.
                </p>
              </div>
              <Art src="b1/controller" className="h-9 w-9 shrink-0" />
            </div>
          </div>
        </div>
      </section>

      {/* ================= ASK THE UMPIRE ================= */}
      <section className="mx-auto max-w-6xl px-4 py-24">
        <div className="grid gap-10 lg:grid-cols-[0.8fr_1.6fr]">
          <div className="lg:sticky lg:top-10 lg:self-start">
            <p className="font-led text-2xl text-orange">QUESTIONS?</p>
            <h2 className="font-arcade text-4xl sm:text-5xl">Ask the umpire</h2>
            <Art src="c2/football-referee" className="mt-6 w-40" />
          </div>
          <div className="paper brut-lg overflow-hidden rounded-[24px] px-3 py-2 sm:px-6">
            {FAQS.map((f, i) => (
              <Faq key={f.q} n={i + 1} {...f} />
            ))}
          </div>
        </div>
      </section>

      {/* ================= FOOTER: final whistle ================= */}
      <footer className="flood relative overflow-hidden px-4 pb-40 pt-20 text-center">
        <p className="font-led text-2xl text-orange">FINAL WHISTLE</p>
        <div className="flex justify-center">
          <Wordmark size="text-6xl sm:text-8xl" className="mt-3" stacked={false} />
        </div>
        <p className="font-display mt-5 text-xl font-bold">Watch apart. Call it together.</p>
        <button className="key mt-8 text-lg" onClick={() => start()}>
          Start a room
        </button>
        <div className="mt-6 flex justify-center">
          <ThemeToggle />
        </div>
        <a
          href="#nexconn"
          className="led relative z-10 mx-auto mt-10 flex w-fit items-center gap-3 rounded-xl px-4 py-2 text-left transition-transform hover:-translate-y-1"
        >
          <Art src="b2/trophy" className="h-10 w-10" />
          <span>
            <span className="font-led block text-lg leading-none text-paper/60">BUILT FOR THE NEXCONN BUILD CHALLENGE 2026</span>
            <span className="font-arcade block text-base text-yellow">BUILT ON NEXCONN CHAT · 11 FEATURES</span>
          </span>
        </a>
        <p className="relative z-10 mt-4 text-xs text-on-muted">
          <a className="underline hover:text-orange" href="/impact">Live impact</a> · Points only, never money
        </p>
        <Pitch className="absolute inset-x-0 bottom-0 h-28" />
        <Art src="b4/esports" className="absolute bottom-3 left-[10%] z-10 w-20" />
        <Art src="b4/racing" className="absolute bottom-3 right-[10%] z-10 w-20" />
      </footer>

      <StartRoom open={open} onClose={() => setOpen(false)} sport={sport} />
    </main>
  );
}
